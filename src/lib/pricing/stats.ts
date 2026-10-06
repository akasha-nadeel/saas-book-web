/**
 * The two order statistics every price figure in OpenChapter is built from.
 *
 * Shared by the old Google price search (`comps/price-check.ts`) and the
 * best-seller shelves (`pricing/shelf-facts.ts`), so the two can never
 * disagree about what "the middle price" of the same numbers is.
 */

/** The median of a list already sorted ascending. An even list averages its two middle values. */
export function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Nearest-rank order statistic, on a list already sorted ascending. */
export function nearestRank(sorted: readonly number[], fraction: number): number {
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[at];
}
