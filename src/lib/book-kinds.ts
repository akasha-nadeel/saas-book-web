/**
 * What a writer is setting out to make, and how long that usually runs.
 *
 * The numbers here are conventions of the trade, not rules — a target is a
 * thing to steer by, and the form says so. They exist so that a new book
 * starts with a goal already in it rather than a blank field the writer has to
 * invent a number for.
 *
 * **This used to ask the form as well as the genre** — novel, novella or short
 * story, as three cards on `/book/new` — and the picker came off on
 * 2026-08-15. Two things decided it. The choice only ever scaled *one number*,
 * which sits in an editable box directly under it, so a writer who wanted
 * 7,500 could always type 7,500. And it was the one field on that form with
 * nowhere to change it afterwards: the shelf's edit dialog carries the title,
 * subtitle, author, genre and cover, so the form was a permanent answer asked
 * at the moment the writer knew least about the book. The `formShortfall`
 * advisory that read it went with it — see the note in `publishing.ts`.
 */

export const GENRES = [
  "Fantasy",
  "Science fiction",
  "Romance",
  "Mystery",
  "Thriller",
  "Historical fiction",
  "Literary fiction",
  "Young adult",
  "Horror",
  "Memoir",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];

export const DEFAULT_GENRE: Genre = "Fantasy";

/**
 * Typical finished length by genre. Fantasy and science fiction run long
 * because they spend words on a world; young adult runs short.
 */
const GENRE_TARGETS: Record<Genre, number> = {
  Fantasy: 110_000,
  "Science fiction": 100_000,
  Romance: 85_000,
  Mystery: 80_000,
  Thriller: 80_000,
  "Historical fiction": 100_000,
  "Literary fiction": 90_000,
  "Young adult": 70_000,
  Horror: 80_000,
  Memoir: 80_000,
  Other: 90_000,
};

/** Fallback for a genre string that is not one of ours — see suggestTarget. */
const UNKNOWN_GENRE_TARGET = 90_000;

/**
 * The length a book of this genre usually runs to.
 *
 * Takes a bare `string` rather than `Genre` on purpose: a book's stored genre
 * came from an import or from an older version as often as from our own list,
 * and an unknown one is answered rather than crashed on.
 */
export function suggestTarget(genre: string): number {
  return GENRE_TARGETS[genre as Genre] ?? UNKNOWN_GENRE_TARGET;
}

/** The line under the target field, explaining where the number came from. */
export function targetHint(genre: string): string {
  return `Suggested for ${genre.toLowerCase()} books.`;
}
