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
    },
  };
}

/** One whole dollar of the chart: books priced from `from` to `from + 0.99`. */
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
    bins[at][publisherGroup(book.publisher)] += 1;
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
  return { independent: side("independent"), traditional: side("traditional") };
}
