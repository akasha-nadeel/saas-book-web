import "server-only";
import type { ListedBook } from "./apple-list";
import {
  mergeAmazon,
  parseAmazonBestSellers,
  parseAmazonDetails,
  type AmazonDetails,
} from "./amazon-list";
import type { BestsellerShelf } from "./shelves";

/**
 * Amazon's Kindle top 100 for a genre, with each book's details, from OpenWeb
 * Ninja's Real-Time Amazon Data API.
 *
 * **Every request is paid for, so everything is cached on the server and
 * shared by every Pro writer** (Next's data cache, the `next.revalidate` on
 * each fetch):
 * - the two list pages for **7 days**, the owner's choice of a weekly refresh;
 * - each book's details for **30 days**, one book per request.
 *
 * **One book per request on purpose.** OpenWeb Ninja counts each book in a
 * batched request as a request of its own — measured on 2026-10-06, see the
 * design note — so batching saves nothing. One book per request lets the cache
 * remember books one at a time, and a week's refresh then looks up only the
 * books new to the list (about 15 a genre).
 *
 * The cost is in the design note: about $6 a month weekly, at $0.003 a
 * request. It is the first writer to open a genre each week who waits while
 * up to a hundred books are looked up.
 *
 * `OPENWEBNINJA_BASE_URL` exists so the whole path can be run against
 * recorded answers locally; it is never set in production.
 */

const LIST_SECONDS = 7 * 24 * 60 * 60;
const DETAILS_SECONDS = 30 * 24 * 60 * 60;
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

async function get(path: string, seconds: number): Promise<{ json: unknown; date: string | null } | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: { "x-api-key": process.env.OPENWEBNINJA_API_KEY ?? "" },
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

export type AmazonShelf =
  | { ok: true; books: ListedBook[]; updated: string | null }
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
  const found = await pooled(listed, CONCURRENCY, (b) =>
    get(`/product-details?asin=${encodeURIComponent(b.asin)}&country=US`, DETAILS_SECONDS),
  );
  for (const answer of found) {
    if (!answer) continue;
    for (const [asin, d] of parseAmazonDetails(answer.json)) details.set(asin, d);
  }

  const date = pages[0].date ? new Date(pages[0].date) : null;
  return {
    ok: true,
    books: mergeAmazon(listed, details),
    updated: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
  };
}
