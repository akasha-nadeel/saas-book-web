import "server-only";
import type { ListedBook } from "./apple-list";
import {
  mergeAmazon,
  parseAmazonBestSellers,
  parseAmazonDetails,
  type AmazonDetails,
} from "./amazon-list";
import { LADDER_POSITIONS } from "./category-facts";
import type { BestsellerShelf } from "./shelves";

/**
 * Amazon's Kindle top 100 for a genre, with each book's details, and the
 * genre's three trend lists, from OpenWeb Ninja's Real-Time Amazon Data API.
 *
 * **Every request is paid for, so everything is cached on the server and
 * shared by every writer who reads it** (Next's data cache, the
 * `next.revalidate` on each fetch):
 * - the two list pages for **7 days**, the owner's choice of a weekly refresh;
 * - each book's details for **30 days**, one book per request;
 * - the five ladder books' details again for **7 days** (`LADDER_POSITIONS`),
 *   so the category check's store-wide ranks are no older than the list;
 * - the three trend lists (new releases, movers, most wished for) for **1
 *   day**, because a list about what changed is worth little a week late.
 *
 * **One book per request on purpose.** OpenWeb Ninja counts each book in a
 * batched request as a request of its own — measured on 2026-10-06, see the
 * design note — so batching saves nothing. One book per request lets the cache
 * remember books one at a time, and a week's refresh then looks up only the
 * books new to the list (about 15 a genre).
 *
 * **Cost grows with genres, not with writers.** A genre is about 102 requests
 * the first time, then about 17 a week for the list and the books new to it,
 * 5 a week for the ladder, and 3 a day for the trends. All 27 genres opened
 * every day come to about 5,500 a month — inside OpenWeb Ninja's $25 fixed
 * plan of 10,000 — however many writers open them. It is the first writer to
 * open a genre who waits while up to a hundred books are looked up.
 *
 * **Next's cache key includes the request headers** (checked in
 * `next/dist/server/lib/incremental-cache`, 2026-10-12), which is how the
 * ladder's 7-day copy of a book is kept apart from its 30-day one: it sends
 * `x-oc-read: ladder`. The API key is a header too, so a new key starts every
 * cache over — expect a first fill's worth of requests after rotating it.
 *
 * `OPENWEBNINJA_BASE_URL` exists so the whole path can be run against
 * recorded answers locally; it is never set in production.
 */

const LIST_SECONDS = 7 * 24 * 60 * 60;
const DETAILS_SECONDS = 30 * 24 * 60 * 60;
const LADDER_SECONDS = LIST_SECONDS;
const TREND_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 15_000;
/** How many book lookups run at once — inside the pay-as-you-go 10 a second. */
const CONCURRENCY = 8;

export function amazonDataConfigured(): boolean {
  return Boolean(process.env.OPENWEBNINJA_API_KEY);
}

function base(): string {
  return (
    process.env.OPENWEBNINJA_BASE_URL ??
    "https://api.openwebninja.com/realtime-amazon-data"
  ).replace(/\/$/, "");
}

async function get(
  path: string,
  seconds: number,
  read?: string,
): Promise<{ json: unknown; date: string | null } | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: {
        "x-api-key": process.env.OPENWEBNINJA_API_KEY ?? "",
        ...(read ? { "x-oc-read": read } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: seconds },
    });
    if (!res.ok) return null;
    return { json: await res.json(), date: res.headers.get("date") };
  } catch {
    return null;
  }
}

/** Runs `work` over `items`, `limit` at a time. */
async function pooled<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return out;
}

/** A response's own `date` header as ISO, or null. */
function isoOf(date: string | null | undefined): string | null {
  const d = date ? new Date(date) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

const detailsPath = (asin: string) =>
  `/product-details?asin=${encodeURIComponent(asin)}&country=US`;

export type AmazonShelf =
  | {
      ok: true;
      books: ListedBook[];
      updated: string | null;
      /** When the ladder books' store ranks were read — the oldest of them. */
      ranksRead: string | null;
    }
  | { ok: false };

export async function fetchAmazonShelf(shelf: BestsellerShelf): Promise<AmazonShelf> {
  const node = shelf.amazonBestsellers?.node;
  if (!node) return { ok: false };

  const category = encodeURIComponent(`digital-text/${node}`);
  const pages = await Promise.all(
    [1, 2].map((page) =>
      get(`/best-sellers?category=${category}&type=BEST_SELLERS&page=${page}&country=US`, LIST_SECONDS),
    ),
  );
  const listed = pages.flatMap((p) => (p ? parseAmazonBestSellers(p.json) : []));
  // The first page is the list; without it there is no list to show.
  if (!pages[0] || listed.length === 0) return { ok: false };

  const details = new Map<string, AmazonDetails>();
  const found = await pooled(listed, CONCURRENCY, (b) => get(detailsPath(b.asin), DETAILS_SECONDS));
  for (const answer of found) {
    if (!answer) continue;
    for (const [asin, d] of parseAmazonDetails(answer.json)) details.set(asin, d);
  }

  /* The ladder's books read again, at most a week old, over whatever the
     30-day copy said — a store rank moves daily, and the ladder sets it beside
     this week's list positions. */
  const rungs = listed.filter((b) => (LADDER_POSITIONS as readonly number[]).includes(b.position));
  const fresh = await pooled(rungs, CONCURRENCY, (b) =>
    get(detailsPath(b.asin), LADDER_SECONDS, "ladder"),
  );
  const readDates: string[] = [];
  for (const answer of fresh) {
    if (!answer) continue;
    const date = isoOf(answer.date);
    if (date) readDates.push(date);
    for (const [asin, d] of parseAmazonDetails(answer.json)) details.set(asin, d);
  }

  return {
    ok: true,
    books: mergeAmazon(listed, details),
    updated: isoOf(pages[0].date),
    // The oldest, so the screen never claims a fresher read than it had.
    ranksRead: readDates.sort()[0] ?? null,
  };
}

/** Amazon's three lists about movement, by the API's own type names. */
export const TREND_LISTS = ["NEW_RELEASES", "MOVERS_AND_SHAKERS", "MOST_WISHED_FOR"] as const;
export type TrendList = (typeof TREND_LISTS)[number];

export type AmazonTrend =
  | { ok: true; books: ListedBook[]; updated: string | null }
  /** `none`: Amazon answered with no such list for this genre. */
  | { ok: false; reason: "none" | "failed" };

/**
 * The first page (50 books) of each trend list for a genre.
 *
 * **List fields only** — price, ratings, cover and, on Movers & Shakers,
 * Amazon's own note on the move. No book's details are read, because that is
 * a request a book; the screen says what that leaves out (the publisher, so no
 * split by side, and the Kindle Unlimited flag).
 */
export async function fetchAmazonTrends(
  shelf: BestsellerShelf,
): Promise<Record<TrendList, AmazonTrend> | null> {
  const node = shelf.amazonBestsellers?.node;
  if (!node) return null;
  const category = encodeURIComponent(`digital-text/${node}`);

  const answers = await Promise.all(
    TREND_LISTS.map((type) =>
      get(`/best-sellers?category=${category}&type=${type}&page=1&country=US`, TREND_SECONDS),
    ),
  );

  const out = {} as Record<TrendList, AmazonTrend>;
  TREND_LISTS.forEach((type, i) => {
    const answer = answers[i];
    if (!answer) {
      out[type] = { ok: false, reason: "failed" };
      return;
    }
    const listed = parseAmazonBestSellers(answer.json);
    out[type] =
      listed.length === 0
        ? { ok: false, reason: "none" }
        : { ok: true, books: mergeAmazon(listed, new Map()), updated: isoOf(answer.date) };
  });
  return out;
}
