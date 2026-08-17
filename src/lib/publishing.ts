import type { Book } from "./library-store";
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
  /**
   * The first clause of `message`, on its own — "Too small to upload".
   *
   * **Set only by the cover checks, and only so several of them can be said in
   * one breath.** Those findings arrive as a label and a detail (see
   * `checkCover`) and are joined here into the one sentence a list wants; the
   * dashboard folds two or more of them into a single row and needs the short
   * halves back to write "Two things about the cover file: too small to upload,
   * and squarer than Amazon asks for". Splitting `message` on its first full
   * stop would work today and break the moment a label contains one.
   *
   * Nothing else sets it and nothing may require it: an issue without one is
   * an issue whose `message` is already the whole of what there is to say.
   */
  label?: string;
  /**
   * Where it is put right, when that is a *page in this book* rather than a
   * field on a form.
   *
   * Every issue this module raises is about a field, and the screens that show
   * them already sit next to those fields — so nothing here sets it. It exists
   * for `checkStoreReadiness`, the half in `export/index.ts` that has read the
   * manuscript: a copyright page naming the wrong person is fixed by opening
   * that page in the editor, and only the code that found the page knows which
   * one it is. Without this the writer is told, on the last screen of the
   * wizard, that a page is wrong and left to go and find it.
   *
   * Deliberately a plain href rather than the dashboard's typed `Fix` union
   * (`checkup.ts`): that one exists because three of its destinations are
   * *dialogs the shelf owns* and cannot be addressed by URL. A chapter is a
   * URL, and none of these issues reaches the dashboard anyway.
   */
  link?: { href: string; label: string };
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
  /* `label` is optional and only the cover checks pass one — see the field's
     own note. Spread rather than always set, so an issue without one carries
     no empty string for a consumer to have to treat as absent. */
  const blocking = (field: string, message: string, label?: string) =>
    issues.push({ level: "blocking", field, message, ...(label ? { label } : {}) });
  const advisory = (field: string, message: string, label?: string) =>
    issues.push({ level: "advisory", field, message, ...(label ? { label } : {}) });

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
   * **Each keeps its own field**, because the field is what `DESTINATIONS`
   * maps to a button and what a screen keys a row on. That is *not* a claim
   * that each gets its own row: this comment used to add "one row per problem,
   * each landing on the thing that fixes it", and the second half was never
   * true — all five cover destinations are the same `covers?check=1` report,
   * differing only by a `fix=` hint. So a writer with two faults in one file
   * was given two buttons to the same screen and made the trip twice. The
   * dashboard folds them into one row now (`findingsFrom` in checkup.ts); this
   * module goes on reporting them one by one, which is right for a list that
   * is read rather than pressed.
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
      /* The label rides along as well, so the dashboard can say several of
         these in one sentence without picking the joined message apart. */
      if (finding.level === "problem") blocking(field, message, finding.label);
      else advisory(field, message, finding.label);
    }
  }

  if (brokenImages > 0) {
    /*
     * **These pictures are not in the file**, and the note used to say
     * something softer because it was counting something smaller.
     *
     * It read "could not be read properly — check it still appears the way you
     * meant", on the reasoning that the picture kept its data URL and most
     * readers still drew it. That was true of the one case it counted and
     * false of the two it missed: a `src` on the open internet and a media
     * type EPUB has no core support for are both *hard* EPUBCheck failures,
     * and the export now leaves such a picture out rather than ship a file no
     * shop will take. Telling a writer to check how it looks, when it is not
     * there at all, is advice about the wrong thing.
     *
     * Still advisory. The book is valid and sells; it is short a picture, and
     * whether that matters is the writer's call, not ours.
     */
    advisory(
      "images",
      brokenImages === 1
        ? "One image cannot go in an EPUB, so it is left out — it is either damaged, in an unusual format, or linked from the web rather than saved into the book."
        : `${brokenImages} images cannot go in an EPUB, so they are left out — they are either damaged, in an unusual format, or linked from the web rather than saved into the book.`,
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
   * **The `kind` advisory was here** — "Set up as a Novel, and 4,200 words so
   * far" — and it went with the form picker on 2026-08-15. It read
   * `book.kind`, which `/book/new` was the only screen that ever set; with the
   * picker gone every book would have fallen to the `"novel"` default, so the
   * check would have fired on every novella and short story in the library and
   * there would have been no field anywhere to correct it with. A verdict
   * computed from a question the app no longer asks is exactly the invented
   * number the house rules refuse. Removing the check meant removing its
   * `DESTINATIONS` entry in `checkup.ts` in the same commit — the test at
   * `checkup.test.ts` walks every field this function can emit.
   */

  return issues;
}

/** Whether anything would stop a shop taking the file. */
export function hasBlockingIssues(issues: readonly ReadinessIssue[]): boolean {
  return issues.some((issue) => issue.level === "blocking");
}
