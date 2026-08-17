import { withReturn } from "./areas";
import { countFindings, findingsFrom, type Finding, type Fix } from "./checkup";
import type { ImportedBook } from "./import/split";
import type { Book } from "./library-store";
import { storeReadiness } from "./publishing";

/**
 * The readiness check, run against a file instead of against a library.
 *
 * This is what the landing page offers a visitor who has never signed in:
 * drop the manuscript you already have, and be told what a shop would refuse
 * it for. The audience is the one the whole product is aimed at — somebody who
 * finished a book, does not know what stands between it and a listing, and has
 * been sold to by four other tools already. The most convincing thing we can
 * do is not describe the check. It is run it, on their book, for nothing, and
 * let the result be the argument.
 *
 * **It invents no rules.** Every finding comes from `storeReadiness()` by way
 * of `fromReadiness()` — the same two functions behind the dashboard and the
 * export screen. A second list of shop rules written for the landing page is a
 * list that would drift, and the direction it would drift in is *louder*,
 * because a landing page has an incentive the dashboard does not. There is no
 * scoring, no grade, and no count of anything the file does not contain.
 *
 * **Advisories travel here, where `checkup()` holds them back.** That gate is
 * about a writer on chapter three being told about ISBNs, and it is right. It
 * does not apply to somebody who has walked up to a page called *find out
 * what is wrong with your book before you upload it* holding a finished
 * manuscript — they have asked the publishing question by arriving. This is
 * the same reasoning the Prepare screen already runs on.
 *
 * **What it says is true of the file, not of the writer.** A .docx carries no
 * ISBN, so "No ISBN" is a fact about what would be uploaded rather than an
 * accusation that none has been bought. The screen says which file it read and
 * never claims more than that.
 */

export interface FileFindings {
  /** The title the file declared, or the one taken from its name. */
  title: string;
  author?: string;
  words: number;
  /** Chapters with prose in them — the count `storeReadiness` was given. */
  chapters: number;
  /** Worst first: refusals, then the rest. */
  findings: Finding[];
  /** How many would stop a shop, and how many are worth doing. */
  fix: number;
  note: number;
}

/**
 * A `Book` in the shape the shop checks want, from a file that is not one yet.
 *
 * The id is empty on purpose: nothing here reaches storage, and no book exists
 * at this point — the visitor has not signed in, and may never. Only the
 * fields the checks actually read are filled.
 */
function asBook(file: ImportedBook): Book {
  return {
    id: "",
    title: file.title,
    ...(file.author ? { author: file.author } : {}),
    ...(file.publishing ? { publishing: file.publishing } : {}),
    chapters: [],
    lastOpenedId: null,
    lastOpenedAt: 0,
  };
}

export function checkFile(file: ImportedBook): FileFindings {
  const withProse = file.chapters.filter((chapter) => chapter.words > 0);

  /* Through the same `findingsFrom` the dashboard uses, so this page cannot
     word or group a finding differently from the screen it sends people to —
     which is the one thing this check exists to promise. Nothing here supplies
     `coverFacts`, so it raises no cover-file findings and the grouping inside
     is inert; it goes through it anyway rather than becoming the one caller
     that could drift. */
  const findings = findingsFrom(
    storeReadiness({
      book: asBook(file),
      ...(file.publishing ? { meta: file.publishing } : {}),
      // What the *file* carries, which is not the same as what could be stored:
      // a cover too large for the browser's budget is still a cover as far as a
      // shop is concerned, and reporting it missing would be a false finding.
      hasCover: Boolean(file.hasCover),
      chapterCount: withProse.length,
      // The two image checks need the manuscript walked block by block, which
      // is the export screen's job and needs a book to exist first.
      brokenImages: 0,
    }),
  );

  const ordered = [
    ...findings.filter((f) => f.level === "fix"),
    ...findings.filter((f) => f.level === "note"),
  ];

  return {
    title: file.title,
    ...(file.author ? { author: file.author } : {}),
    words: file.chapters.reduce((total, chapter) => total + chapter.words, 0),
    chapters: withProse.length,
    findings: ordered,
    ...countFindings(ordered),
  };
}

/**
 * Where a finding is put right, once there is a book to put it right in.
 *
 * The landing page cannot act on a `Fix` itself — every one of them needs a
 * signed-in app — so it turns each into the path the writer lands on *after*
 * they sign up, and hands that to `/signup?next=`.
 *
 * The two dialog-shaped fixes (title, author, cover) have no URL of their own:
 * they open a dialog the shelf owns. Sending those to the dashboard is not a
 * consolation prize — Overview is the screen that draws this same list, from
 * the same `checkup()` module, with the same button on the same finding. The
 * visitor gets the list they were just reading, now able to press it.
 */
export function fixDestination(fix: Fix, bookId: string): string {
  if (fix.kind !== "route") return "/?area=overview";

  const path = fix.path ? `/book/${bookId}/${fix.path}` : `/book/${bookId}`;
  // `from=overview` so the tool's own back control returns them to the list of
  // findings rather than to the tool launcher, which is where a writer working
  // through a list expects to go.
  return withReturn(path, "overview");
}

/** The sign-up door, with somewhere to be let out of on the other side. */
export function signupTo(path: string): string {
  return `/signup?next=${encodeURIComponent(path)}`;
}
