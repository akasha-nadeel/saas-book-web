/**
 * Turning the page counts of comparable books into a word target.
 *
 * `book-kinds.ts` already suggests a target — 110,000 words for a fantasy
 * novel, 80,000 for a thriller — and those numbers are folklore. They are the
 * figures everybody repeats, they are roughly right, and nobody can tell you
 * which books they came from. This module answers the same question from books
 * that exist.
 *
 * **The conversion is an estimate and the module is built around admitting
 * it.** Catalogues record pages, and a page is not a fixed quantity of words:
 * it depends on trim size, type size, leading and how much white space the
 * designer wanted. A trade paperback runs somewhere around 250 to 300 words a
 * page, so this returns a *range* rather than a number. A single figure derived
 * from a page count would be a guess wearing the costume of a measurement, and
 * this product's whole position is not doing that.
 */

/**
 * Words per page in a trade paperback, low and high.
 *
 * Wide on purpose. A tightly-set literary novel and an airy young-adult one sit
 * at opposite ends of this, and narrowing the band to look precise would be
 * inventing precision we do not have.
 */
export const WORDS_PER_PAGE = { low: 250, high: 300 } as const;

export interface LengthTarget {
  /** The median page count the range was derived from. */
  medianPages: number;
  /** How many books carried a page count. */
  from: number;
  low: number;
  high: number;
  /** The middle of the range — for setting a target, which needs one number. */
  middle: number;
}

/** Rounded to the nearest thousand: a target of 87,431 words is a false promise. */
function round(words: number): number {
  return Math.round(words / 1000) * 1000;
}

/**
 * A word range from a median page count, or nothing.
 *
 * Returns null rather than a range when too few books carried a page count.
 * Three books is not a genre, and a target drawn from three books that a writer
 * then spends a year working towards is worse than no target at all — they
 * already have folklore, and folklore is at least drawn from more than three
 * books.
 */
export function lengthFromPages(
  medianPages: number | undefined,
  from: number,
): LengthTarget | null {
  if (!medianPages || medianPages <= 0) return null;
  if (from < MIN_BOOKS) return null;

  const low = round(medianPages * WORDS_PER_PAGE.low);
  const high = round(medianPages * WORDS_PER_PAGE.high);
  return {
    medianPages,
    from,
    low,
    high,
    middle: round((low + high) / 2),
  };
}

/**
 * The fewest books worth deriving a target from.
 *
 * Five, and it is a judgement rather than a finding — named here so it is
 * obvious it was chosen, and so anyone who disagrees can see what they are
 * disagreeing with.
 */
const MIN_BOOKS = 5;

export type LengthVerdict = "under" | "inside" | "over";

/**
 * Where a manuscript sits against the range.
 *
 * "Under" is not "behind" and "over" is not "too long" — a book is finished
 * when it is finished. The screen says where you are; what that means is the
 * writer's business, and the wording throughout keeps it that way.
 */
export function compareLength(
  words: number,
  target: LengthTarget,
): LengthVerdict {
  if (words < target.low) return "under";
  if (words > target.high) return "over";
  return "inside";
}
