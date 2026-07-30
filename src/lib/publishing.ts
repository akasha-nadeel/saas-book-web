import type { Book } from "./library-store";

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
}: ReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const blocking = (field: string, message: string) =>
    issues.push({ level: "blocking", field, message });
  const advisory = (field: string, message: string) =>
    issues.push({ level: "advisory", field, message });

  if (!book.title.trim() || book.title.trim() === "Untitled book") {
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

  return issues;
}

/** Whether anything would stop a shop taking the file. */
export function hasBlockingIssues(issues: readonly ReadinessIssue[]): boolean {
  return issues.some((issue) => issue.level === "blocking");
}
