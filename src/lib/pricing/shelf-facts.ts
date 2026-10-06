import { MIN_PRICES, type PriceSummary } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { publisherGroup, type PublisherGroup } from "./publishers";
import { median, nearestRank } from "./stats";

/**
 * What a best-seller list says about prices, and nothing it does not.
 *
 * **Two middle prices, never one.** A genre's list usually holds two clusters:
 * self-published books near $3–5 and traditional ones near $10–13. A single
 * figure sits in the gap between them describing neither, which was the old
 * Google screen's failing. So every figure here is per side.
 *
 * **The same threshold as the Google search** (`MIN_PRICES`, six). A side with
 * fewer paid books than that is counted and listed but given no middle price.
 */

export interface GroupFacts {
  /** Paid books on this side of the list. */
  count: number;
  summary: PriceSummary | null;
}

export interface ShelfFacts {
  currency: string | null;
  /** Books on the list in that currency. The denominator for every "N of M". */
  of: number;
  /** Listed at nothing. Kept out of every figure. */
  free: number;
  groups: Record<PublisherGroup, GroupFacts>;
}

function summarise(paid: number[]): PriceSummary | null {
  if (paid.length < MIN_PRICES) return null;
  const sorted = [...paid].sort((a, b) => a - b);
  return {
    from: sorted.length,
    median: median(sorted),
    low: sorted[0],
    high: sorted[sorted.length - 1],
    middleLow: nearestRank(sorted, 0.25),
    middleHigh: nearestRank(sorted, 0.75),
  };
}

/**
 * The books in the list's first currency. A store list is one currency, so
 * this should drop nothing; if it ever does, averaging dollars with pounds
 * would be worse than leaving a book out.
 */
function inCurrency(books: readonly ListedBook[]): ListedBook[] {
  const currency = books[0]?.currency;
  return currency ? books.filter((b) => b.currency === currency) : [];
}

export function shelfFacts(books: readonly ListedBook[]): ShelfFacts {
  const kept = inCurrency(books);
  const paid = kept.filter((b) => b.price > 0);
  const side = (group: PublisherGroup): GroupFacts => {
    const prices = paid
      .filter((b) => publisherGroup(b.publisher) === group)
      .map((b) => b.price);
    return { count: prices.length, summary: summarise(prices) };
  };
  return {
    currency: kept[0]?.currency ?? null,
    of: kept.length,
    free: kept.length - paid.length,
    groups: {
      independent: side("independent"),
      traditional: side("traditional"),
      amazon: side("amazon"),
    },
  };
}

/**
 * One whole dollar of the chart: books priced from `from` to `from + 0.99`.
 *
 * Two sides only, because the chart has two halves: self-published books above
 * the line, every kind of publisher below it. Amazon’s own imprints are
 * counted below, with the houses; the tiles above the chart keep them apart.
 */
export interface PriceBin {
  from: number;
  independent: number;
  traditional: number;
}

/** Where the chart stops. The last bin holds everything at this price and over. */
export const CHART_CEILING = 20;

export function priceBins(
  books: readonly ListedBook[],
  ceiling = CHART_CEILING,
): PriceBin[] {
  const bins: PriceBin[] = Array.from({ length: ceiling + 1 }, (_, from) => ({
    from,
    independent: 0,
    traditional: 0,
  }));
  for (const book of inCurrency(books)) {
    const at = Math.min(ceiling, Math.floor(book.price));
    const side = publisherGroup(book.publisher);
    bins[at][side === "independent" ? "independent" : "traditional"] += 1;
  }
  return bins;
}

export interface Standing {
  cheaper: number;
  same: number;
  dearer: number;
}

/** How many books on the list cost less than, the same as and more than a price. */
export function standing(books: readonly ListedBook[], price: number): Standing {
  const kept = inCurrency(books);
  const same = kept.filter((b) => Math.abs(b.price - price) < 0.005).length;
  const cheaper = kept.filter((b) => b.price < price - 0.005).length;
  return { cheaper, same, dearer: kept.length - cheaper - same };
}

/**
 * The same comparison, once for each side of the trade.
 *
 * **The useful comparison for most writers here is with the self-published
 * side alone**: comparing a $4.99 indie novel with all hundred books mixes it
 * with $12.99 trade editions it is not competing against. Both sides are
 * returned, so the screen can say each in its own line.
 */
export function standingBySide(
  books: readonly ListedBook[],
  price: number,
): Record<PublisherGroup, Standing> {
  const kept = inCurrency(books);
  const side = (group: PublisherGroup) =>
    standing(
      kept.filter((b) => publisherGroup(b.publisher) === group),
      price,
    );
  return {
    independent: side("independent"),
    traditional: side("traditional"),
    amazon: side("amazon"),
  };
}

/*
 * The facts below need Amazon’s data. On Apple’s list every field they read is
 * absent, so each answers with zero counts and no summaries — never a guess.
 */

export interface KindleUnlimitedCount {
  /** Books flagged as in Kindle Unlimited. */
  inIt: number;
  /** Books whose flag arrived at all. Fewer than `of` when some details failed. */
  known: number;
  of: number;
}

export function kindleUnlimitedCount(books: readonly ListedBook[]): KindleUnlimitedCount {
  const kept = inCurrency(books);
  return {
    inIt: kept.filter((b) => b.kindleUnlimited === true).length,
    known: kept.filter((b) => typeof b.kindleUnlimited === "boolean").length,
    of: kept.length,
  };
}

const paidPrices = (books: readonly ListedBook[]) =>
  books.filter((b) => b.price > 0).map((b) => b.price);

const factsOf = (prices: number[]): GroupFacts => ({
  count: prices.length,
  summary: summarise(prices),
});

export interface SeriesSplit {
  /** Book 1 of a series. */
  firsts: GroupFacts;
  /** Book 2 and on. */
  later: GroupFacts;
  /** Books the details named no series for. */
  standalone: number;
}

/**
 * What first books in a series charge against later ones — the "make book 1
 * cheap" question, answered with what the list actually charges rather than
 * with advice.
 */
export function seriesSplit(books: readonly ListedBook[]): SeriesSplit {
  const kept = inCurrency(books);
  const inSeries = kept.filter((b) => b.series);
  return {
    firsts: factsOf(paidPrices(inSeries.filter((b) => b.series!.number === 1))),
    later: factsOf(paidPrices(inSeries.filter((b) => b.series!.number > 1))),
    standalone: kept.filter((b) => b.series === null).length,
  };
}

export interface LengthBand extends GroupFacts {
  label: string;
}

const BANDS: { label: string; from: number; to: number }[] = [
  { label: "Under 200 pages", from: 0, to: 199 },
  { label: "200–399 pages", from: 200, to: 399 },
  { label: "400 pages and over", from: 400, to: Infinity },
];

/** What short, standard and long books on the list charge. Amazon’s print length. */
export function lengthBands(books: readonly ListedBook[]): LengthBand[] {
  const kept = inCurrency(books).filter((b) => typeof b.pages === "number");
  return BANDS.map((band) => ({
    label: band.label,
    ...factsOf(paidPrices(kept.filter((b) => b.pages! >= band.from && b.pages! <= band.to))),
  }));
}

/** What the paperbacks of each side’s books cost, where there is one. */
export function paperbackBySide(
  books: readonly ListedBook[],
): Record<PublisherGroup, GroupFacts> {
  const kept = inCurrency(books);
  const side = (group: PublisherGroup) =>
    factsOf(
      kept
        .filter((b) => publisherGroup(b.publisher) === group)
        .map((b) => b.paperbackPrice)
        .filter((p): p is number => typeof p === "number" && p > 0),
    );
  return {
    independent: side("independent"),
    traditional: side("traditional"),
    amazon: side("amazon"),
  };
}
