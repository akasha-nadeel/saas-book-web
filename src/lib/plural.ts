/**
 * A count and its noun, agreeing.
 *
 * This lived as a private function at the bottom of `bookshelf.tsx`, where
 * nothing else could reach it — so the shelf pluralised "book" correctly and
 * about fifteen other places printed "1 words", "1 chapters", "1 days written"
 * and, on the money screen, "1 copies" the first time somebody recorded a
 * single sale. Same lesson as `Spinner` and `Menu`: the third copy is when a
 * thing moves to somewhere shared.
 *
 * **The irregular form is a parameter rather than a rule.** English plurals are
 * not derivable — "copy" is the one that matters here and naive suffixing gives
 * "copys" — and a library of rules would be a lot of machinery for a handful of
 * nouns. Anything regular takes the default.
 *
 * The count is localised, because these are figures a reader compares (6,236
 * rather than 6236) and every call site was already doing it.
 */
export function plural(count: number, one: string, many?: string): string {
  return `${count.toLocaleString()} ${nounFor(count, one, many)}`;
}

/**
 * Just the noun, for the places where the number is rendered apart from it.
 *
 * The stat cards are the reason: they take a `value` and a `label` as separate
 * props so the figure can be set large, which means the noun has to agree with
 * a number it is not next to in the source.
 */
export function nounFor(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`);
}
