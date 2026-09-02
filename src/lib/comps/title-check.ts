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
 * The form two titles are compared in to decide they are **the same title**.
 *
 * **`normaliseTitle` is not enough for this one test, and space is why.** It
 * keeps the gaps between words, so `grand father` and `grandfather` are
 * different strings — and a reader searching for one finds the other without
 * noticing there was ever a difference. Measured on Open Library: a check of
 * "grand father" reported *nothing under this exact name* while three published
 * books are called *Grandfather*. On the screen a writer uses to decide whether
 * to keep a title, that is the worst answer this app can give — a confident
 * all-clear that is false.
 *
 * Three foldings, and each one earned its place against the catalogue rather
 * than against an idea of tidiness:
 *
 * - **Whitespace removed.** The case above.
 * - **Diacritics stripped**, so `café` and `cafe` are one title. Worth one
 *   record in the sample and costs nothing.
 * - **`&` to `and`**, for completeness of the *comparison*. It buys no extra
 *   records — Open Library already folds it, and `title:"salt & pepper"`
 *   returns the same sixteen exact matches as `title:"salt and pepper"` — but
 *   two records that differ only by the ampersand should not be two titles.
 *
 * **Only the `exact` grade uses this.** `close` and `contains` keep comparing
 * with `normaliseTitle`, where the spaces are doing real work: *"Grand Father
 * Tree"* is close because it starts with `grand father` *and a space*, which is
 * what stops *"Grandfathering"* matching the same way. Fold the gaps out there
 * and the grades stop meaning anything.
 *
 * Nothing that is close today becomes exact: `grandfathertree` is still not
 * `grandfather`.
 */
export function titleKey(title: string): string {
  return (
    // `&` becomes a word *before* normalising, not after: `normaliseTitle`
    // turns punctuation into spaces, so by the time it has run the ampersand is
    // already gone and there is nothing left to map. Written the other way
    // round this line does nothing at all, which is how it was first written.
    normaliseTitle(title.replace(/&/g, " and "))
      .normalize("NFKD")
      // The combining marks NFKD has just split off: `é` is now `e` + U+0301.
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "")
  );
}

/**
 * How many single-character edits turn one string into another.
 *
 * Ordinary Levenshtein over two rows rather than a full matrix: the strings are
 * book titles, so this runs a few dozen characters against a few dozen, a few
 * hundred times, and the row pair keeps it linear in memory.
 *
 * Exported for its tests. Nothing outside this module should need it —
 * `suggestSpelling` is the question anybody actually has.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

/**
 * **How far wrong a title may be before it stops being the same title
 * misspelled**, as a share of its length.
 *
 * Measured against Google Books on 2026-09-03 rather than chosen by feel, and
 * the fourth row is the one that set it:
 *
 * | typed | closest published title | edits | ratio |
 * |---|---|---|---|
 * | `spidrmn` | Spider-Man | 2 | 0.29 |
 * | `hary poter` | Harry Potter | 2 | 0.22 |
 * | `the grate gatsby` | THE GREAT GATSBY | 2 | 0.18 |
 * | `zylophonic murmurations` | Murmurations | 10 | **0.45** |
 *
 * The first three are typos and want a suggestion. The last is somebody's own
 * invented title, and the nearest published thing is a different word that
 * happens to share a stem — suggesting it would be the screen arguing with a
 * writer about a name they chose on purpose. A third of the length separates
 * them with room to spare either side.
 *
 * A share rather than a fixed count, because two wrong letters in a seven-letter
 * title is a different thing from two in a forty-letter one.
 */
const NEAR_ENOUGH = 0.34;

/**
 * The published title somebody probably meant, or null.
 *
 * **Only ever a title that was actually returned by a catalogue.** It picks
 * from `titles` and hands one back verbatim; it does not assemble a correction,
 * and there is no model here. Same rule as `/api/comps/rank`, which may choose
 * only among books that were fetched.
 *
 * **Silence is the common answer and the important one.** This is offered on a
 * screen that has just told a writer their name is clear, so a wrong suggestion
 * costs more than a missing one: it tells somebody who invented a title that
 * they made a mistake. Hence `NEAR_ENOUGH`, and hence the two other refusals —
 * a suggestion identical to what was typed says nothing, and an empty typed
 * title has nothing to be near.
 *
 * Compared on `titleKey`, so spacing, case, accents and an ampersand are not
 * counted as mistakes: `spider man` is not a misspelling of `Spider-Man`.
 */
export function suggestSpelling(
  typed: string,
  titles: readonly string[],
): string | null {
  const mine = titleKey(typed);
  if (!mine) return null;

  let best: string | null = null;
  let bestDistance = Infinity;

  for (const title of titles) {
    const key = titleKey(title);
    // Nothing to suggest: this is what they typed, however it is punctuated.
    if (!key || key === mine) continue;

    const d = editDistance(mine, key);
    if (d < bestDistance) {
      bestDistance = d;
      best = title;
    }
  }

  if (!best) return null;
  return bestDistance / mine.length <= NEAR_ENOUGH ? best : null;
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

  /* Taken once rather than per book: it is the same string every time round,
     and the loop runs over several hundred records after a sweep. */
  const myKey = titleKey(title);

  const clashes: TitleClash[] = [];
  for (const book of books) {
    const theirs = normaliseTitle(book.title);
    if (!theirs) continue;

    if (titleKey(book.title) === myKey) {
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
