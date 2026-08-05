import type { Book } from "./library-store";
import { formShortfall } from "./book-kinds";
import { checkCover, type CoverFacts } from "./cover-check";

/**
 * The details a shop asks for that writing a book does not.
 *
 * A manuscript needs a title, chapters and prose. A *listing* needs an
 * identifier, a language tag, a rights statement, a blurb and a shelf to sit on
 * — none of which the editor has any reason to know. They live here, apart from
 * the book's own settings, because they are answers to a distributor's form
 * rather than decisions about the writing, and because the readiness check
 * below is the honest version of a "Publish" button: it says what is still
 * missing instead of pretending the file is ready.
 *
 * Everything is optional. A writer exporting an EPUB to read on their own phone
 * should not have to invent a publisher, so nothing here blocks an export —
 * `storeReadiness` reports, it does not veto.
 */
export interface PublishingMeta {
  /** ISBN-13, digits only once normalised. Absent means none assigned. */
  isbn?: string;
  /** BCP-47, e.g. `en`, `en-GB`, `pt-BR`. Absent means the default below. */
  language?: string;
  /** The imprint. A self-publisher's own name is a normal answer. */
  publisher?: string;
  /** The blurb. Stores cap this; see BLURB_MAX. */
  description?: string;
  /** Overrides the generated "All rights reserved" line. */
  rights?: string;
  /** Shelf categories and keywords — BISAC codes are welcome but not required. */
  subjects?: readonly string[];
  /**
   * The seven backend keyword fields a shop's listing form asks for, in order,
   * with empty slots kept as empty strings so slot four stays slot four.
   *
   * Separate from `subjects` because they are a different thing in the same
   * form: subjects are the shelf, these are extra text the shop indexes. See
   * `lib/keywords.ts` — nothing here validates them, because a half-written
   * keyword is a normal state to save in.
   */
  keywords?: readonly string[];
  /** ISO date, `YYYY-MM-DD`. Absent means unpublished. */
  published?: string;
  /** Series title, for the shops that group a shelf by it. */
  series?: string;
  /** Position in that series. 1-based, as a reader would count. */
  seriesIndex?: number;
}

/** What `dc:language` falls back to. English, because the UI is. */
export const DEFAULT_LANGUAGE = "en";

/**
 * KDP's blurb limit, and the smallest of the big shops' — so a description that
 * fits here fits everywhere.
 */
export const BLURB_MAX = 4000;

/**
 * A field a shop would read as "not answered".
 *
 * Emptiness is not `!value` here: `seriesIndex: 0` is a real number that
 * happens to be falsy, and an empty string is a field somebody cleared rather
 * than one they filled with nothing.
 */
export function isEmptyDetail(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * The listing details as they would be *stored*, in a stable key order.
 *
 * `setPublishing` drops every empty field on the way in, so a screen holding a
 * draft cannot compare it to the book with a plain `JSON.stringify` — a box
 * the writer cleared is `""` on screen and absent in the store, and the form
 * would read as permanently unsaved. Keys are sorted for the same reason:
 * object order depends on which field was typed into first.
 *
 * Here rather than in the screen because the *rule* about what counts as
 * answered belongs beside the type it is about, and `setPublishing` applies
 * the same one.
 */
export function tidyPublishing(meta: PublishingMeta | undefined): string {
  const out: Record<string, unknown> = {};
  const source = (meta ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(source).sort()) {
    if (!isEmptyDetail(source[key])) out[key] = source[key];
  }
  return JSON.stringify(out);
}

// ---------------------------------------------------------------------------
// ISBN
// ---------------------------------------------------------------------------

/** Strips the spaces and hyphens people type an ISBN with. */
export function normaliseIsbn(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * ISBN-13 check digit: alternating weights of 1 and 3, and the total must be a
 * multiple of ten. Worth verifying rather than trusting, because a transposed
 * pair is invisible to read back and the rejection arrives days later from a
 * distributor with no explanation of which digit was wrong.
 *
 * ISBN-10 is not accepted. Every store has wanted 13 since 2007, and quietly
 * converting one would be inventing an identifier on the writer's behalf.
 */
export function isValidIsbn13(input: string): boolean {
  const digits = normaliseIsbn(input);
  if (!/^\d{13}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * The value of `dc:identifier`, and the one piece of this that is not cosmetic.
 *
 * A store treats the identifier as *which book this is*. Exporting twice used to
 * mint a fresh random UUID each time, so a corrected file read as a second,
 * unrelated title rather than as a new edition of the first — which is how a
 * writer ends up with two listings and half their reviews on the wrong one.
 * Deriving it from the book's own id fixes that: the same book exports under the
 * same identifier for as long as it exists.
 *
 * An ISBN wins when there is one, because that is what the trade means by the
 * question.
 */
export function bookIdentifier(book: Book, meta?: PublishingMeta): string {
  if (meta?.isbn && isValidIsbn13(meta.isbn)) {
    return `urn:isbn:${normaliseIsbn(meta.isbn)}`;
  }
  // Book ids are randomUUID where the browser allows it; the fallback shape
  // (`m3k2x1-a8f2b1c9`) is not a UUID, so it goes in the looser `urn:uuid:`-less
  // form rather than claiming to be one.
  const id = book.id;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? `urn:uuid:${id.toLowerCase()}`
    : `openchapter:book:${id}`;
}

/**
 * `dc:creator`'s sort form: "Le Guin, Ursula K." from "Ursula K. Le Guin".
 *
 * Shops file by it, and getting it wrong shelves a book under its author's first
 * name. Only the last whitespace-separated word moves, which is right for most
 * English-language names and wrong for compound surnames — so this is a default
 * the writer can overrule, not a rule. A single-word name is left alone.
 */
export function fileAs(author: string): string {
  const name = author.trim().replace(/\s+/g, " ");
  const cut = name.lastIndexOf(" ");
  if (cut <= 0) return name;
  return `${name.slice(cut + 1)}, ${name.slice(0, cut)}`;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type IssueLevel =
  /** A shop will refuse the file, or the upload will fail validation. */
  | "blocking"
  /** The file is accepted, but the listing is worse for it. */
  | "advisory";

export interface ReadinessIssue {
  level: IssueLevel;
  /** Stable key, so the UI can link an issue to the field that fixes it. */
  field: string;
  /** What is wrong, in the writer's terms rather than the validator's. */
  message: string;
}

export interface ReadinessInput {
  book: Book;
  meta?: PublishingMeta;
  /** Whether a cover was found and could be packaged. */
  hasCover: boolean;
  /** Chapters with prose in them. */
  chapterCount: number;
  /** Images that could not be turned into package resources. */
  brokenImages: number;
  /** Images carrying no alt text. */
  undescribedImages?: number;
  /**
   * What the cover checker measured of the writer's *original* artwork.
   *
   * Optional because most callers have no way to know it: the copy this app
   * stores is compressed to fit a browser, so it cannot be measured for this
   * purpose, and the real file only ever exists in the checker for as long as
   * it takes to read. Absent means the cover has not been checked, and the
   * findings say nothing rather than guessing.
   */
  coverFacts?: CoverFacts | null;
}

/**
 * Everything standing between this book and a shop, worst first.
 *
 * Blocking issues are the ones a store's validator actually fails on. Advisory
 * ones are the difference between a book that is listed and a book that is
 * found. Both are reported; neither stops the export, because a writer is
 * allowed to want the file for themselves.
 */
export function storeReadiness({
  book,
  meta,
  hasCover,
  chapterCount,
  brokenImages,
  undescribedImages = 0,
  coverFacts,
}: ReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const blocking = (field: string, message: string) =>
    issues.push({ level: "blocking", field, message });
  const advisory = (field: string, message: string) =>
    issues.push({ level: "advisory", field, message });

  // Matched without regard to case, because the placeholder is written three
  // different ways in this codebase already: `createBook` and five other sites
  // in library-store.ts make "Untitled Book", `sync.ts` falls back to "Untitled
  // book", and this check was spelled like the latter — so it never once fired
  // on a real book. Comparing exact strings across six call sites is a check
  // that silently stops working the next time somebody capitalises differently.
  const title = book.title.trim();
  if (!title || title.toLowerCase() === "untitled book") {
    blocking("title", "The book still has no title of its own.");
  }

  if (!book.author?.trim()) {
    blocking(
      "author",
      "No author name. Every shop files a book under one, and none will take it without.",
    );
  }

  if (chapterCount === 0) {
    blocking("chapters", "There is nothing in the book to publish yet.");
  }

  if (!hasCover) {
    blocking(
      "cover",
      "No cover. A shop will reject the upload, and a reader scrolling past will not stop.",
    );
  }

  /*
   * The cover *file's* own findings, once it has been measured.
   *
   * These are the same findings the covers screen shows, from the same
   * `checkCover` — not a second opinion written for this list. A writer whose
   * artwork is the wrong shape should not have to remember to visit another
   * screen to be told, and a check that only speaks where you happen to be
   * standing is a check that gets missed.
   *
   * **Each keeps its own field** rather than collapsing into one "cover" row,
   * because the field is what `DESTINATIONS` maps to a button — one row per
   * problem, each landing on the thing that fixes it, which is the shape the
   * rest of this list already has.
   *
   * Levels are carried across as the cover check set them: its `problem` is a
   * shop refusing the file, which is blocking, and its notes are advisory.
   */
  if (coverFacts) {
    for (const finding of checkCover(coverFacts)) {
      const field = `cover-${finding.id}`;

      /*
       * **Label first, like every other line on this list.**
       *
       * The covers screen draws the label as a heading with the detail under
       * it; a readiness issue is one sentence, so sending only the detail lost
       * the heading and the row began "This is 0.56:1;" — a pronoun with no
       * subject, on a list where every neighbour opens by naming the problem
       * ("No cover.", "No ISBN.", "No categories."). A reader scanning the
       * column could not tell what the sentence was even about.
       *
       * Joined here rather than in `cover-check.ts` because the two-part shape
       * is what the covers screen needs; this list needs the sentence.
       */
      const message = `${finding.label}. ${finding.detail}`;
      if (finding.level === "problem") blocking(field, message);
      else advisory(field, message);
    }
  }

  if (brokenImages > 0) {
    // Not a validity failure — the image keeps its data URL and most readers
    // still draw it. But an image these cannot decode is usually one that was
    // already damaged on the page, so it is worth looking at before selling it.
    advisory(
      "images",
      brokenImages === 1
        ? "One image could not be read properly. Check it still appears the way you meant."
        : `${brokenImages} images could not be read properly. Check they still appear the way you meant.`,
    );
  }

  if (undescribedImages > 0) {
    // Not blocking: the file is valid and the shops take it. But since the
    // European Accessibility Act the EPUB has to *say* which parts a reader who
    // cannot see them will miss, and every undescribed picture is one of them.
    advisory(
      "alt",
      undescribedImages === 1
        ? "One image has no description, so a reader using a screen reader will not know it is there."
        : `${undescribedImages} images have no description, so a reader using a screen reader will not know they are there.`,
    );
  }

  if (meta?.isbn && !isValidIsbn13(meta.isbn)) {
    blocking(
      "isbn",
      "That ISBN's check digit does not add up — one of the digits is wrong.",
    );
  }

  if (!meta?.isbn) {
    advisory(
      "isbn",
      "No ISBN. Amazon assigns its own, but Apple, Kobo and most aggregators want one.",
    );
  }

  if (!meta?.description?.trim()) {
    advisory(
      "description",
      "No blurb. This is the text a shop shows under the cover.",
    );
  } else if (meta.description.trim().length > BLURB_MAX) {
    blocking(
      "description",
      `The blurb is ${meta.description.trim().length} characters; the limit is ${BLURB_MAX}.`,
    );
  }

  if (!meta?.subjects?.length) {
    advisory(
      "subjects",
      "No categories. These decide which shelf the book turns up on.",
    );
  }

  if (!meta?.publisher?.trim()) {
    advisory(
      "publisher",
      "No publisher. Your own name is the usual answer when self-publishing.",
    );
  }

  if (meta?.published && !/^\d{4}-\d{2}-\d{2}$/.test(meta.published)) {
    blocking("published", "The publication date must be a YYYY-MM-DD date.");
  }

  /*
   * **The form the book is sold as, against its actual length.**
   *
   * A shop may refuse a listing whose description misrepresents what a reader
   * is buying, and "A Novel" on four thousand words is exactly that — the
   * word appears on the generated title page, and most writers put it in the
   * subtitle too. The book's own setup already carries the answer.
   *
   * Advisory, and a fact rather than a verdict: it does not say the book is
   * too short, because that is not knowable. It says what the book was set up
   * as and what it currently runs to, and lets the writer decide which of the
   * two is wrong. `formShortfall` only fires well below the boundary — see
   * there for why.
   */
  const words = book.chapters.reduce((sum, c) => sum + (c.words ?? 0), 0);
  const shortfall = formShortfall(book.kind ?? "novel", words);
  if (shortfall) {
    advisory(
      "kind",
      `Set up as a ${shortfall.label}, and ${words.toLocaleString()} words so far. A ${shortfall.label.toLowerCase()} is usually ${shortfall.floor.toLocaleString()} or more.`,
    );
  }

  return issues;
}

/** Whether anything would stop a shop taking the file. */
export function hasBlockingIssues(issues: readonly ReadinessIssue[]): boolean {
  return issues.some((issue) => issue.level === "blocking");
}
