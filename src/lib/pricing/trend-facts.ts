import { MIN_PRICES } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { median, nearestRank } from "./stats";

/**
 * What Amazon's lists say about reviews and launch prices (the Market check's
 * Trends tab, Pro Plus, 2026-10-12).
 *
 * **The pains this answers**: how many reviews the books a writer is up
 * against actually have, and what new books in the genre launch at. Both are
 * read off the lists' own figures — the ratings count and the price each
 * entry carries — with no conversion into sales and no verdict.
 */

/** Ratings counts, grouped so a reader sees the spread rather than one figure. */
const RATING_BANDS: { label: string; from: number; to: number }[] = [
  { label: "No ratings yet", from: 0, to: 0 },
  { label: "1–49", from: 1, to: 49 },
  { label: "50–99", from: 50, to: 99 },
  { label: "100–999", from: 100, to: 999 },
  { label: "1,000 and over", from: 1000, to: Infinity },
];

export interface Band {
  label: string;
  count: number;
}

export interface RatingFacts {
  /** Books on the list. */
  of: number;
  /** Books whose ratings count came with the list. */
  known: number;
  /**
   * The middle ratings count, once `known` reaches `MIN_PRICES` — a count one
   * of the books actually has (nearest rank), never the average of two, since
   * no book has 1,263.5 ratings.
   */
  middle: number | null;
  bands: Band[];
  /** The middle star average, on the same threshold. */
  middleStars: number | null;
}

/** How many ratings the books on a list carry. */
export function ratingFacts(books: readonly ListedBook[]): RatingFacts {
  const counts = books
    .map((b) => b.ratings)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const stars = books
    .map((b) => b.stars)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  return {
    of: books.length,
    known: counts.length,
    middle: counts.length >= MIN_PRICES ? nearestRank(counts, 0.5) : null,
    bands: RATING_BANDS.map((band) => ({
      label: band.label,
      count: counts.filter((n) => n >= band.from && n <= band.to).length,
    })),
    middleStars: stars.length >= MIN_PRICES ? median(stars) : null,
  };
}

/**
 * Price bands rather than a middle price.
 *
 * **Why not a middle**: the price check's rule is two middle prices, never
 * one, because a genre's list holds two clusters — self-published near $3–5,
 * traditional near $10–13 — and one figure describes neither. The new-release
 * and trend lists come without each book's publisher (reading it costs a
 * request a book), so they cannot be split by side. Counts in bands are true
 * whichever side a book is on.
 */
const PRICE_BANDS: { label: string; from: number; to: number }[] = [
  { label: "Free", from: 0, to: 0 },
  { label: "Under $2.99", from: 0.01, to: 2.98 },
  { label: "$2.99–$4.99", from: 2.99, to: 4.99 },
  { label: "$5.00–$9.99", from: 5, to: 9.99 },
  { label: "$10.00 and over", from: 10, to: Infinity },
];

export interface PriceBands {
  of: number;
  bands: Band[];
}

export function priceBands(books: readonly ListedBook[]): PriceBands {
  const usd = books.filter((b) => b.currency === "USD");
  return {
    of: usd.length,
    bands: PRICE_BANDS.map((band) => ({
      label: band.label,
      count: usd.filter((b) => b.price >= band.from && b.price <= band.to).length,
    })),
  };
}
