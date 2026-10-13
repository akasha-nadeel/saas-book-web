import type { CategoryRank, ListedBook } from "./apple-list";

/**
 * Amazon's Kindle best-seller list, read from OpenWeb Ninja's Real-Time Amazon
 * Data API, into the same `ListedBook` the Apple list produces.
 *
 * **Two calls make a list** (both measured on 2026-10-06):
 * - `/best-sellers` answers 50 books a page, in Amazon's order, with price.
 * - `/product-details` answers one book per request as we call it, with what
 *   the list lacks: the Kindle Unlimited flag, publisher, pages, file size,
 *   series, the paperback's price, and the "Best Sellers Rank" line — the
 *   book's rank in the whole store and in each category it ranks in.
 *
 * **Pure and defensive, like `parseAppleList`.** Nothing here throws, and a
 * shape it does not recognise yields nothing. That reaches the screen as "no
 * list", never as a cheap one.
 */

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** "$4.99", "4.99" or 4.99 as a number of dollars; anything else is no price. */
export function dollars(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = text(value);
  if (!s) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** One entry of Amazon's list, before its details are joined on. */
export interface AmazonListed {
  asin: string;
  position: number;
  title: string;
  price: number;
  cover: string | null;
  url: string | null;
  ratings: number | null;
  stars: number | null;
  /** Movers & Shakers only: Amazon's own words for the move. */
  change: string | null;
}

/** A count of ratings: 298, "298" or "1,204"; anything else is unknown. */
function count(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : Number(text(value)?.replace(/,/g, "") ?? NaN);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** "4.9" or 4.9, between 0 and 5; anything else is unknown. */
function starsOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(text(value) ?? NaN);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

export function parseAmazonBestSellers(payload: unknown): AmazonListed[] {
  const data = obj(obj(payload)?.data);
  const raw = data?.best_sellers;
  if (!Array.isArray(raw)) return [];
  const books: AmazonListed[] = [];
  raw.forEach((item, index) => {
    const e = obj(item);
    const asin = text(e?.asin);
    const title = text(e?.product_title);
    const price = dollars(e?.product_price);
    if (!e || !asin || !title || price === null || price < 0) return;
    const rank = Number(e.rank);
    books.push({
      asin,
      position: Number.isFinite(rank) && rank > 0 ? rank : index + 1,
      title,
      price,
      cover: text(e.product_photo),
      url: text(e.product_url),
      ratings: count(e.product_num_ratings),
      stars: starsOf(e.product_star_rating),
      change: text(e.rank_change_label),
    });
  });
  return books;
}

/** What one book's page adds to the list. */
export interface AmazonDetails {
  author: string | null;
  publisher: string | null;
  /** YYYY-MM-DD. */
  released: string | null;
  kindleUnlimited: boolean;
  pages: number | null;
  fileSizeMb: number | null;
  series: { name: string; number: number; of: number } | null;
  paperbackPrice: number | null;
  /** Rank in the whole Kindle Store. */
  storeRank: number | null;
  /** The categories the page says it ranks in, Amazon's own words. */
  categoryRanks: CategoryRank[];
}

/** The whole store's name in a "Best Sellers Rank" line. */
const STORE = "Kindle Store";

/**
 * A book page's "Best Sellers Rank" line, split into the store-wide rank and
 * each category rank.
 *
 * The text, as OpenWeb Ninja returns it (2026-10-06, all 100 cozy mysteries
 * carried one):
 * `#67 in Kindle Store (See Top 100 in Kindle Store)    #1 in Cozy Mystery
 *  #1 in Cozy Mysteries (Books)   #1 in Private Investigator Mysteries
 *  (Kindle Store)`.
 *
 * The "(See Top 100 …)" link text is dropped; the store qualifiers Amazon
 * writes after a category — "(Books)", "(Kindle Store)" — are kept, because
 * "Cozy Mysteries (Books)" is the print store's category and a different one
 * from the Kindle category beside it. A category is named exactly as Amazon
 * names it, so two spellings Amazon keeps apart stay apart here.
 */
export function parseBestSellersRank(value: unknown): {
  storeRank: number | null;
  categoryRanks: CategoryRank[];
} {
  const s = text(value);
  const out = { storeRank: null as number | null, categoryRanks: [] as CategoryRank[] };
  if (!s) return out;
  for (const part of s.split(/(?=#[\d,]+\s+in\s)/)) {
    const m = part.match(/^#([\d,]+)\s+in\s+([\s\S]+)$/);
    if (!m) continue;
    const rank = Number(m[1].replace(/,/g, ""));
    const name = m[2]
      .replace(/\(See Top 100 in [^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!Number.isInteger(rank) || rank < 1 || !name) continue;
    if (name === STORE) {
      if (out.storeRank === null) out.storeRank = rank;
    } else {
      out.categoryRanks.push({ rank, name });
    }
  }
  return out;
}

/** "by Nicole Fox (Author) Format: Kindle Edition" → "Nicole Fox". */
function authorOf(byline: unknown): string | null {
  const s = text(byline);
  if (!s) return null;
  const name = s.replace(/^by\s+/i, "").replace(/\s*\((?:Author|Editor)\).*$/i, "").replace(/\s*Format:.*$/i, "");
  return name.trim() || null;
}

function isoDate(value: unknown): string | null {
  const s = text(value);
  if (!s) return null;
  const t = Date.parse(`${s} UTC`);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** "1.6 MB" → 1.6, "579 KB" → 0.579. */
function megabytes(value: unknown): number | null {
  const m = text(value)?.match(/^([\d.,]+)\s*(KB|MB)$/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return m[2].toUpperCase() === "KB" ? n / 1000 : n;
}

export function parseAmazonDetails(payload: unknown): Map<string, AmazonDetails> {
  const raw = obj(payload)?.data;
  const list: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out = new Map<string, AmazonDetails>();
  for (const item of list) {
    const e = obj(item);
    const asin = text(e?.asin);
    if (!e || !asin) continue;
    const info = obj(e.product_information) ?? {};

    const seriesKey = Object.keys(info).find((k) => /^Book \d+ of \d+$/.test(k));
    const seriesName = seriesKey ? text(info[seriesKey]) : null;
    const nums = seriesKey?.match(/^Book (\d+) of (\d+)$/);

    const formats = Array.isArray(e.book_formats) ? e.book_formats : [];
    const paperback = formats.map(obj).find((f) => f && f.format === "Paperback");

    const pages = Number(text(info["Print length"])?.match(/^(\d+)/)?.[1]);
    const ranks = parseBestSellersRank(info["Best Sellers Rank"]);

    out.set(asin, {
      author: authorOf(e.product_byline),
      publisher: text(info.Publisher),
      released: isoDate(info["Publication date"]),
      // Absent on books outside Kindle Unlimited, so anything but `true` is no.
      kindleUnlimited: e.kindle_unlimited === true,
      pages: Number.isFinite(pages) && pages > 0 ? pages : null,
      fileSizeMb: megabytes(info["File size"]),
      series:
        seriesName && nums
          ? { name: seriesName, number: Number(nums[1]), of: Number(nums[2]) }
          : null,
      paperbackPrice: paperback ? dollars(paperback.price) : null,
      storeRank: ranks.storeRank,
      categoryRanks: ranks.categoryRanks,
    });
  }
  return out;
}

/**
 * The list and its details as `ListedBook`s.
 *
 * **A book whose details did not arrive keeps `kindleUnlimited: null`.** It is
 * still listed and priced, and the screen counts it as unknown rather than as
 * outside Kindle Unlimited.
 */
export function mergeAmazon(
  books: readonly AmazonListed[],
  details: ReadonlyMap<string, AmazonDetails>,
): ListedBook[] {
  return books.map((b) => {
    const d = details.get(b.asin);
    return {
      id: b.asin,
      position: b.position,
      title: b.title,
      author: d?.author ?? "Unknown author",
      price: b.price,
      currency: "USD",
      publisher: d ? d.publisher : null,
      released: d?.released ?? null,
      cover: b.cover,
      url: b.url,
      kindleUnlimited: d ? d.kindleUnlimited : null,
      pages: d?.pages ?? null,
      series: d?.series ?? null,
      paperbackPrice: d?.paperbackPrice ?? null,
      fileSizeMb: d?.fileSizeMb ?? null,
      ratings: b.ratings,
      stars: b.stars,
      storeRank: d?.storeRank ?? null,
      categoryRanks: d?.categoryRanks ?? [],
      change: b.change,
    };
  });
}
