import type { CompTitle } from "./comps";

/**
 * Is this title already taken?
 *
 * Asked constantly, and the honest answer is never yes or no — **book titles
 * are not trademarks and cannot be copyrighted**, so there is no legal sense in
 * which a title is unavailable. What a writer actually wants to know is whether
 * they are about to publish into a shadow: whether searching their title brings
 * back somebody else's book first, and whether that book is big enough that
 * theirs will never be found.
 *
 * So this reports what is already out there under the name, and grades how
 * close each one is. It does not advise. Plenty of good books share a title
 * with an obscure one and nobody minds; sharing with a bestseller in the same
 * genre is a different situation, and the writer is the one who can tell which
 * of those they are in.
 */

export type TitleMatch = "exact" | "close" | "contains";

export interface TitleClash {
  book: CompTitle;
  match: TitleMatch;
}

/**
 * Comparable form: lower-cased, punctuation gone, a leading article dropped.
 *
 * The article matters. "The Drowned Coast" and "Drowned Coast" are the same
 * title as far as a reader searching for it is concerned, and a check that
 * called them different would be missing exactly the clash it exists to find.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an)\s+/, "");
}

/**
 * Books already published under this name, closest match first.
 *
 * Three grades rather than a yes/no, because they mean different things: an
 * *exact* match is the case worth knowing about, *close* covers subtitles and
 * series suffixes on the same name, and *contains* is a title that swallows
 * yours — "The Drowned Coast" inside "Return to the Drowned Coast" — which is a
 * much weaker signal and is graded as such rather than left out.
 *
 * A book with no title survives nothing here; it never gets that far, since
 * `mergeComps` has already dropped the authorless catalogue rows.
 */
export function findClashes(title: string, books: CompTitle[]): TitleClash[] {
  const mine = normaliseTitle(title);
  if (!mine) return [];

  const clashes: TitleClash[] = [];
  for (const book of books) {
    const theirs = normaliseTitle(book.title);
    if (!theirs) continue;

    if (theirs === mine) {
      clashes.push({ book, match: "exact" });
    } else if (theirs.startsWith(`${mine} `)) {
      // "The Drowned Coast: A Novel", "The Drowned Coast Book Two".
      clashes.push({ book, match: "close" });
    } else if (theirs.includes(` ${mine} `) || theirs.endsWith(` ${mine}`)) {
      clashes.push({ book, match: "contains" });
    }
  }

  const order: Record<TitleMatch, number> = {
    exact: 0,
    close: 1,
    contains: 2,
  };
  return clashes.sort(
    (a, b) =>
      order[a.match] - order[b.match] ||
      // Recent first within a grade: a clash with a book from last year is
      // worth more of a writer's attention than one from 1961.
      (b.book.year ?? 0) - (a.book.year ?? 0),
  );
}
