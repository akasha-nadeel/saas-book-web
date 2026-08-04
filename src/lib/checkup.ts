import { GENRES } from "./book-kinds";
import type { Book } from "./library-store";
import { storeReadiness, type ReadinessIssue } from "./publishing";
import { roadmapFor, progressOf, type Phase } from "./roadmap";

/**
 * What is actually wrong with this book, and where each thing gets fixed.
 *
 * **The screen this exists for is the one a writer sees first**, and the person
 * arriving is usually not starting a book — they have one, often finished,
 * often imported from somewhere else, and they came because they do not know
 * what is standing between it and a shop. A dashboard that answers that with a
 * word count and a Continue writing button is answering a question they did not
 * ask.
 *
 * So this is a diagnosis rather than a progress bar. Three rules shape it:
 *
 * **Every finding carries its own way to be fixed.** A list of problems with no
 * destinations is a list of reasons to feel bad; the `fix` on each one is what
 * makes it a piece of work instead. That is also why the destination is a typed
 * union rather than a URL — the three commonest problems (no title, no author,
 * no cover) are all put right in a dialog on the shelf rather than on a page,
 * and a URL-shaped destination would have left exactly those three as the ones
 * nothing could be done about from here.
 *
 * **Nothing is invented.** Every finding comes from something the app can
 * actually see: `storeReadiness()` for what a shop would refuse, and the book's
 * own fields for the things that quietly disable half the toolkit. There is no
 * score, no grade and no percentage, for the same reason the prose report has
 * none — a number here would be made up to look like an answer.
 *
 * **A finding has to be worth the writer's attention today.** The ones that
 * depend on where the book is in its life are gated on the roadmap's own phase,
 * so a first draft is never told off for having no ISBN.
 */

export type FindingLevel = "fix" | "note";

/**
 * Where a finding is put right.
 *
 * `route` is a tool page, appended to `/book/<id>/`. `identity` is the dialog
 * that edits what the book *is* — title, author, genre, cover — which is a
 * dialog on the shelf rather than a page, and is why this is a union and not a
 * string. Both identity cases open the same dialog; they are two kinds only so
 * the cover one can open it with the picture in view.
 */
export type Fix =
  | { kind: "route"; path: string; action: string }
  | { kind: "identity"; action: string }
  | { kind: "cover"; action: string };

export interface Finding {
  /** Stable, so a list of these can be keyed and tested by name. */
  id: string;
  level: FindingLevel;
  /** What is wrong, in the writer's terms rather than the validator's. */
  title: string;
  /** Why it matters — the half a checklist normally leaves out. */
  why: string;
  fix: Fix;
}

export interface CheckupInput {
  book: Book;
  /** Whether a cover is stored. Passed in: this module reads no storage. */
  hasCover: boolean;
  /** Chapters with prose in them. */
  chapterCount: number;
  /** Advance readers recorded for this book. */
  arcCount: number;
}

/**
 * Where each of `storeReadiness`'s fields is put right.
 *
 * The load-bearing part of this module, and the reason it is a map rather than
 * a switch: a test walks every field that check can emit and fails if one has
 * no destination here. Add a check to `publishing.ts` and forget this, and the
 * finding would otherwise appear on the dashboard with nothing to press — the
 * exact dead end this screen exists to remove.
 */
const DESTINATIONS: Record<string, Fix> = {
  title: { kind: "identity", action: "Name the book" },
  author: { kind: "identity", action: "Add the author" },
  chapters: { kind: "route", path: "", action: "Open the book" },
  cover: { kind: "cover", action: "Add a cover" },

  /*
   * The cover *file's* own findings, one destination each.
   *
   * All five land on the covers screen's file checker — `?check=1` opens it on
   * that half rather than on the shelf, so a writer pressing "Fix the shape"
   * arrives at the controls that fix it instead of at a search box. The
   * wording differs per row because the action does: this list's promise is
   * that a button says what pressing it will do.
   */
  "cover-too-small": {
    kind: "route",
    path: "covers?check=1&fix=enlarge",
    action: "Enlarge the cover",
  },
  "cover-too-heavy": {
    kind: "route",
    path: "covers?check=1",
    action: "Shrink the file",
  },
  "cover-shape": {
    /* `fix=shape` is an *intent*, not a command: the crop window needs the
       artwork and this app never keeps it, so the button cannot open the
       window on its own. It carries the reason for coming instead, and the
       covers screen opens the window the moment a file is supplied. One step
       that cannot be removed, and none of the ones that could. */
    kind: "route",
    path: "covers?check=1&fix=shape",
    action: "Fix the shape",
  },
  "cover-small-ish": {
    kind: "route",
    path: "covers?check=1&fix=enlarge",
    action: "Enlarge the cover",
  },
  /* Lands on the checker like the other four rather than on the shelf.
     "See it on the wall" was the honest instruction — contrast is judged by
     looking, not measured — but it sent a writer somewhere different from
     every other cover row on this list, and a set of buttons that mostly go
     one place and quietly go another is how a reader stops trusting any of
     them. The label follows the destination. */
  "cover-flat": {
    kind: "route",
    path: "covers?check=1",
    action: "Check the cover",
  },
  description: { kind: "route", path: "blurb", action: "Work on the blurb" },
  subjects: {
    kind: "route",
    path: "categories",
    action: "Choose categories",
  },
  /*
   * The three that live on the export flow's *listing* step, and say so.
   *
   * They pointed at `export` alone, which opens on "How do you want it?" — so
   * a button reading "Set the ISBN" delivered a format chooser, and the writer
   * had to guess that picking EPUB was the way to an ISBN box four screens
   * later. A destination is a promise about where you land; these now keep it.
   */
  /*
   * These pointed into the export flow's listing step, which was a deep link
   * invented because the fields lived nowhere else. They have their own tool
   * now, so the destination is the tool: a button reading "Set the ISBN" lands
   * on a page whose whole subject is the ISBN, rather than starting an export
   * the writer did not ask for.
   */
  isbn: { kind: "route", path: "listing", action: "Set the ISBN" },
  publisher: {
    kind: "route",
    path: "listing",
    action: "Set the publisher",
  },
  published: { kind: "route", path: "listing", action: "Fix the date" },
  /*
   * These two stay at the front door on purpose. Both are found by reading the
   * manuscript, which only happens once a format is chosen and the export runs
   * — there is no earlier screen holding the answer to jump to.
   */
  images: { kind: "route", path: "export", action: "Check the images" },
  alt: { kind: "route", path: "export", action: "Describe the images" },
};

/**
 * The shop's own checks, restated as findings.
 *
 * `blocking` becomes "fix" and `advisory` becomes "note", which is the same
 * two-weight ladder the badges use everywhere else in the app: a thing that
 * would be refused, and a thing worth doing.
 *
 * Exported because Prepare needs it too. That screen runs `storeReadiness()`
 * over every book to draw its rows, and when a row is opened it has to show
 * those issues *with somewhere to go* — which is exactly the mapping this
 * already does. A second copy of `DESTINATIONS` on that screen is how a field
 * gains a fix here and stays a dead end there.
 */
export function fromReadiness(issue: ReadinessIssue): Finding | null {
  const fix = DESTINATIONS[issue.field];
  if (!fix) return null;
  return {
    id: `readiness:${issue.field}`,
    level: issue.level === "blocking" ? "fix" : "note",
    title: issue.message,
    why: WHY[issue.field] ?? "",
    fix,
  };
}

/**
 * The second half of each shop check: what it is *for*.
 *
 * `storeReadiness` returns one sentence per issue, written to be read in a list
 * on the export screen where the context is obvious. On a dashboard the same
 * sentence arrives cold, so each gets a line saying why anybody should care.
 * Kept here rather than in `publishing.ts` because that module is consumed by
 * the export screen too, and doubling every message there would make a panel
 * that is already long twice as long.
 */
const WHY: Record<string, string> = {
  title: "Every shop lists by title, and a placeholder is a rejection.",
  author: "Shops file books under an author. A pen name is fine.",
  chapters: "There has to be something in the file to sell.",
  cover: "It is the only thing most readers ever see of your book.",
  description: "The text under the cover is what decides the sale.",
  subjects: "They decide which shelf your book turns up on.",
  isbn: "Apple, Kobo and the aggregators want one. Amazon does not.",
  publisher: "Your own name is the usual answer when self-publishing.",
  published: "A malformed date is refused by the shop's own importer.",
  images: "An image that will not decode was probably damaged already.",
  alt: "A reader using a screen reader is told nothing is there.",
};

/** The phases where publishing questions have become the writer's problem. */
const SELLING = new Set<Phase>(["prepare", "launch", "publish"]);

/**
 * Everything worth saying about one book, worst first.
 *
 * Ordered by level and then by the order the checks ran, so the list is stable
 * between renders — a diagnosis that reshuffles itself while you read it is
 * one you stop trusting.
 */
export function checkup({
  book,
  hasCover,
  chapterCount,
  arcCount,
}: CheckupInput): Finding[] {
  const phase = progressOf(roadmapFor(book, book.roadmapDone ?? [])).next?.phase;
  const selling = phase === undefined || SELLING.has(phase);

  const findings: Finding[] = [];

  /**
   * The one that unlocks the others, and the reason it is first.
   *
   * With no genre, `buildQuery()` has nothing to search on, so comp titles,
   * categories, the blurb examples and the structure targets all dead-end at
   * once. It is the single most expensive blank in the app and the writer has
   * no idea it costs them anything — a book made at `/book/new` has a genre
   * because that screen asks, and an imported one never does.
   */
  if (!book.genre) {
    findings.push({
      id: "genre",
      level: "note",
      title: "We do not know what kind of book this is.",
      why: "Comp titles, categories, blurb examples and structure all need it.",
      fix: { kind: "identity", action: "Say what it is" },
    });
  }

  for (const issue of storeReadiness({
    book,
    ...(book.publishing ? { meta: book.publishing } : {}),
    hasCover,
    chapterCount,
    // The two that need the manuscript are the export screen's job; it walks
    // every chapter, which a dashboard listing seven books must not.
    brokenImages: 0,
  })) {
    // Only the shop's own refusals travel to a book still being written. The
    // rest — no ISBN, no categories, no publisher — are true and premature,
    // and a dashboard repeating them at somebody on chapter three is the
    // scold this audience has already been sold once.
    if (!selling && issue.level === "advisory") continue;
    const finding = fromReadiness(issue);
    if (finding) findings.push(finding);
  }

  if (!book.targetWords) {
    findings.push({
      id: "target",
      level: "note",
      title: "No length to aim at.",
      why: "From books that exist, rather than the number everybody repeats.",
      fix: { kind: "route", path: "comps", action: "Find one" },
    });
  }

  /**
   * The injury the research named more clearly than any other: advance copies
   * lined up *after* publishing, when the reviews they buy are worth nothing.
   * Raised only once the book has reached the phases where it is nearly out,
   * because before that it is advice rather than a problem.
   */
  if (selling && arcCount === 0) {
    findings.push({
      id: "arc",
      level: "note",
      title: "Nobody has an advance copy yet.",
      why: "Reviews on launch day come from readers you lined up before it.",
      fix: { kind: "route", path: "arc", action: "Start the list" },
    });
  }

  return [
    ...findings.filter((f) => f.level === "fix"),
    ...findings.filter((f) => f.level === "note"),
  ];
}

/** How many of each, for the line that summarises the list. */
export function countFindings(findings: readonly Finding[]) {
  return {
    fix: findings.filter((f) => f.level === "fix").length,
    note: findings.filter((f) => f.level === "note").length,
  };
}

/**
 * The genres offered when a book has none.
 *
 * Re-exported rather than reached for directly by the dashboard, so the list a
 * writer is asked to choose from is the same one `/book/new` offers and the
 * same one `suggestTarget()` knows about. Three lists would drift.
 */
export { GENRES };
