import type { PrintCover } from "../cover-store";
import { isValidIsbn13, normaliseIsbn, type PublishingMeta } from "../publishing";

/**
 * What a manuscript file says about itself, beyond its prose.
 *
 * Importing used to take the title and throw the rest away, which was fine
 * while import fed an editor: a writer opening chapter one does not need to
 * know what `dc:publisher` said. It stopped being fine the moment the app
 * started *reporting* on a book, because a check that says "no author, no
 * ISBN, no blurb" about an EPUB that carries all three is not a strict check,
 * it is a wrong one — and the first place that check runs is the landing page,
 * where a false alarm is aimed at somebody who has never trusted us with
 * anything yet.
 *
 * So the formats that carry listing data have it read out, and it travels with
 * the book: into the check that names what a shop would refuse, and into the
 * book itself when one is made. Nothing is inferred and nothing is defaulted —
 * a field the file does not carry stays absent, because an invented publisher
 * is how a book reaches a shop under a name nobody chose.
 */
export interface FileMetadata {
  /** The book's own title, which beats one guessed from the file name. */
  title?: string;
  author?: string;
  /** A data URL inside the cover budget, or absent when the file has none. */
  cover?: string;
  /**
   * The same artwork at full size, for the export.
   *
   * Kept apart from `cover` because they go to different places for different
   * reasons — the thumbnail to localStorage where the shelf can read it during
   * a render, this to IndexedDB where a few hundred kilobytes cost nothing.
   * See `cover-store.ts`.
   */
  printCover?: PrintCover;
  /**
   * True when the file *has* a cover, whether or not one could be stored.
   *
   * These come apart in one narrow case: a cover so large it will not fit the
   * browser's budget even after resizing. When that happens the honest report
   * is still "this file has a cover" — the check speaks about the file, and
   * saying otherwise would be the one thing this app must never do, which is
   * print a finding that is not true. The book then arrives without it, and
   * the app says so in its own words.
   */
  hasCover?: boolean;
  /** Only the fields the file actually carried. */
  publishing?: PublishingMeta;
}

/**
 * The ISBN out of a pile of `dc:identifier` values, or none.
 *
 * An EPUB's identifiers are a mixed bag by design: a UUID that identifies the
 * *file*, a shop's internal id, sometimes a real ISBN, in any order and under
 * any scheme attribute. They arrive written every way the trade writes them —
 * `urn:isbn:9780306406157`, `ISBN 978-0-306-40615-7`, or thirteen bare digits
 * — so each candidate is stripped to its digits and checked properly rather
 * than matched by prefix.
 *
 * **The check digit is the whole point.** Anything can be labelled an ISBN;
 * only the arithmetic says whether it is one. Trusting a `urn:isbn:` prefix
 * would let a malformed identifier through as an ISBN and cost the writer the
 * one finding that would have caught it before a distributor did.
 */
export function isbnFrom(values: readonly string[]): string | undefined {
  for (const value of values) {
    const digits = normaliseIsbn(value).replace(/^URN:ISBN:|^ISBN:?/i, "");
    if (isValidIsbn13(digits)) return digits;
  }
  return undefined;
}

/** Trimmed, or absent — never an empty string, which `setPublishing` treats as a clear. */
export function clean(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

/**
 * The names Word writes when nobody told it one.
 *
 * A .docx records whoever the copy of Office is registered to, which for most
 * writers is their own name and is exactly what should go on the book — and
 * for the rest is the machine account the file was made under. Taking
 * "Windows User" as an author would put it on a listing and, worse, would let
 * the check report the author question as *settled* when it is the one thing
 * every shop refuses a book for.
 *
 * A wrong pass is quieter than a wrong alarm and therefore more dangerous:
 * nobody goes looking for a problem the screen said they did not have.
 */
const MACHINE_NAMES = new Set([
  "administrator",
  "admin",
  "author",
  "microsoft office user",
  "owner",
  "unknown",
  "user",
  "windows user",
]);

/** A name, or nothing when the file only carried a machine's idea of one. */
export function personName(value: string | null | undefined): string | undefined {
  const name = clean(value);
  if (!name) return undefined;
  return MACHINE_NAMES.has(name.toLowerCase()) ? undefined : name;
}

/**
 * Subjects, deduplicated and emptied of blanks.
 *
 * EPUBs in the wild repeat `dc:subject` with the same word in two cases, and a
 * Word document's keywords arrive as one string with any of three separators.
 * A categories list with "Fantasy" twice in it is the kind of small wrongness
 * that makes a writer stop believing the rest of the screen.
 */
export function subjectsFrom(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    for (const part of raw.split(/[;,]|\s{2,}/)) {
      const subject = part.trim();
      if (!subject) continue;
      const key = subject.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(subject);
    }
  }
  return out;
}

/** Drops the empty fields, and the whole object when nothing survived. */
export function publishingFrom(
  fields: PublishingMeta,
): PublishingMeta | undefined {
  const out: PublishingMeta = {};
  for (const [key, value] of Object.entries(fields)) {
    const empty =
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (!empty) Object.assign(out, { [key]: value });
  }
  return Object.keys(out).length ? out : undefined;
}
