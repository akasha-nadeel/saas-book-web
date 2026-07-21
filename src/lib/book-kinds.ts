/**
 * What a writer is setting out to make, and how long that usually runs.
 *
 * The numbers here are conventions of the trade, not rules — a target is a
 * thing to steer by, and the dialog says so. They exist so that a new book
 * starts with a goal already in it rather than a blank field the writer has to
 * invent a number for.
 */

export type BookKind = "novel" | "novella" | "short-story";

export interface KindOption {
  value: BookKind;
  label: string;
  /** The length that defines the form, shown under the label. */
  range: string;
}

export const BOOK_KINDS: readonly KindOption[] = [
  { value: "novel", label: "Novel", range: "40,000+ words" },
  { value: "novella", label: "Novella", range: "17.5k – 40k words" },
  { value: "short-story", label: "Short story", range: "Under 17,500 words" },
];

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

export const DEFAULT_KIND: BookKind = "novel";
export const DEFAULT_GENRE: Genre = "Fantasy";

/**
 * Typical finished length by genre. Fantasy and science fiction run long
 * because they spend words on a world; young adult runs short.
 */
const NOVEL_TARGETS: Record<Genre, number> = {
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

const NOVELLA_TARGET = 30_000;
const SHORT_STORY_TARGET = 7_500;

/** Fallback for a genre string that is not one of ours — see suggestTarget. */
const UNKNOWN_GENRE_TARGET = 90_000;

/**
 * A novella and a short story are defined by their length rather than by their
 * subject, so genre does not move them the way it moves a novel. Pretending
 * otherwise would put a number on the screen that means nothing.
 */
export function suggestTarget(kind: BookKind, genre: string): number {
  if (kind === "novella") return NOVELLA_TARGET;
  if (kind === "short-story") return SHORT_STORY_TARGET;
  return NOVEL_TARGETS[genre as Genre] ?? UNKNOWN_GENRE_TARGET;
}

/** The line under the target field, explaining where the number came from. */
export function targetHint(kind: BookKind, genre: string): string {
  if (kind === "novella") return "Suggested for novellas.";
  if (kind === "short-story") return "Suggested for short stories.";
  return `Suggested for ${genre.toLowerCase()} novels.`;
}

export function kindLabel(kind: BookKind): string {
  return BOOK_KINDS.find((k) => k.value === kind)?.label ?? "Novel";
}
