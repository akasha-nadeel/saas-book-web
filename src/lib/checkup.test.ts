import { describe, expect, it } from "vitest";
import {
  checkup,
  countFindings,
  findingsFrom,
  type Finding,
} from "./checkup";
import type { Book } from "./library-store";
import { storeReadiness } from "./publishing";

/** A book far enough along that the publishing checks apply to it. */
function selling(over: Partial<Book> = {}): Book {
  return {
    id: "b1",
    title: "The Drowned Coast",
    author: "A. Writer",
    genre: "Fantasy",
    targetWords: 90000,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    chapters: [{ id: "c1", title: "One", words: 90000 }],
    // Everything before "Prepare" ticked, so the roadmap says this book has
    // stopped being written and started being published.
    roadmapDone: ["draft", "readthrough", "revise"],
    publishing: {
      isbn: "9780306406157",
      description: "A short blurb.",
      subjects: ["Fantasy"],
      publisher: "A. Writer",
    },
    ...over,
  } as Book;
}

const ids = (findings: readonly Finding[]) => findings.map((f) => f.id);

const run = (book: Book, over: Partial<Parameters<typeof checkup>[0]> = {}) =>
  checkup({ book, hasCover: true, chapterCount: 1, arcCount: 1, ...over });

describe("checkup", () => {
  it("says nothing about a book that is in order", () => {
    expect(run(selling())).toEqual([]);
  });

  it("reports what a shop would refuse as something to fix", () => {
    const found = run(selling({ author: undefined }));
    expect(ids(found)).toContain("readiness:author");
    expect(found.find((f) => f.id === "readiness:author")?.level).toBe("fix");
  });

  it("puts everything that must be fixed above everything merely worth doing", () => {
    const found = run(selling({ author: undefined, targetWords: undefined }));
    const levels = found.map((f) => f.level);
    expect(levels.indexOf("fix")).toBeLessThan(levels.indexOf("note"));
  });

  /*
   * The whole point of the screen this feeds: a problem with nothing to press
   * is a reason to feel bad rather than a piece of work.
   */
  it("gives every finding somewhere to be fixed", () => {
    const found = run(
      selling({
        title: "Untitled Book",
        author: undefined,
        publishing: undefined,
      }),
      { hasCover: false, chapterCount: 0, arcCount: 0 },
    );
    expect(found.length).toBeGreaterThan(4);
    for (const finding of found) {
      expect(finding.fix.action).not.toBe("");
      if (finding.fix.kind === "route") {
        expect(typeof finding.fix.path).toBe("string");
      }
    }
  });

  /*
   * The guard against a check being added to publishing.ts and silently going
   * nowhere. If this fails, `DESTINATIONS` in checkup.ts is missing a field —
   * add the destination rather than relaxing the test.
   */
  it("has a destination for every readiness check there is", () => {
    const bare = selling({
      title: "Untitled Book",
      author: undefined,
      publishing: { isbn: "9780306406158", published: "not-a-date" },
    });
    const issues = storeReadiness({
      book: bare,
      meta: bare.publishing!,
      hasCover: false,
      chapterCount: 0,
      brokenImages: 2,
      undescribedImages: 2,
    });
    const found = run(bare, { hasCover: false, chapterCount: 0 });
    const reported = new Set(
      found.map((f) => f.id.replace("readiness:", "")),
    );
    // brokenImages/alt are the export screen's to raise, so they are the two
    // this module is allowed not to carry — everything else must arrive.
    for (const issue of issues) {
      if (issue.field === "images" || issue.field === "alt") continue;
      expect(reported.has(issue.field)).toBe(true);
    }
  });

  /*
   * The rule that keeps this from being the scold the research warned about.
   */
  it("does not raise publishing advice at a book still being written", () => {
    const drafting = selling({
      roadmapDone: [],
      chapters: [{ id: "c1", title: "One", words: 400 }],
      publishing: undefined,
      targetWords: 90000,
    } as Partial<Book>);
    const found = ids(run(drafting, { arcCount: 0 }));
    expect(found).not.toContain("readiness:isbn");
    expect(found).not.toContain("readiness:subjects");
    expect(found).not.toContain("arc");
  });

  it("still raises what a shop would refuse, whatever the phase", () => {
    const drafting = selling({
      roadmapDone: [],
      author: undefined,
      chapters: [{ id: "c1", title: "One", words: 400 }],
    } as Partial<Book>);
    expect(ids(run(drafting))).toContain("readiness:author");
  });

  /*
   * The most expensive blank in the app: with no genre the comps query is
   * empty, and four tools dead-end at once without saying why.
   */
  it("asks what kind of book it is when nothing says", () => {
    const found = run(selling({ genre: undefined }));
    expect(ids(found)).toContain("genre");
    expect(found.find((f) => f.id === "genre")?.fix.kind).toBe("identity");
  });

  it("raises advance copies only once the book is nearly out", () => {
    expect(ids(run(selling(), { arcCount: 0 }))).toContain("arc");
    expect(ids(run(selling(), { arcCount: 3 }))).not.toContain("arc");
  });

  it("counts the two weights apart", () => {
    const found = run(selling({ author: undefined, targetWords: undefined }));
    const counts = countFindings(found);
    expect(counts.fix).toBe(1);
    expect(counts.note).toBe(1);
  });
});

/**
 * The cover file's faults, gathered into one row.
 *
 * All five of the cover destinations are the same `covers?check=1` report, so a
 * writer with two faults in one file used to get two rows and two buttons to
 * one screen — and made the trip twice, for a file the covers screen can put
 * both right in a single visit. These hold the fold together with the one case
 * it deliberately leaves alone.
 */
describe("findingsFrom", () => {
  const coverIssue = (
    field: string,
    label: string,
    level: "blocking" | "advisory" = "advisory",
  ) => ({ level, field, message: `${label}. Some detail.`, label });

  it("folds two cover faults into one row with one button", () => {
    const found = findingsFrom([
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-small-ish", "Smaller than recommended"),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("readiness:cover-file");
    // The plain report, with no `fix=` intent: with several faults there is no
    // single repair window that is the right one to open.
    expect(found[0].fix).toEqual({
      kind: "route",
      path: "covers?check=1",
      action: "Check the cover",
    });
  });

  it("names every fault it counts", () => {
    const found = findingsFrom([
      coverIssue("cover-too-small", "Too small to upload"),
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-too-heavy", "Too large a file"),
    ]);

    expect(found[0].title).toBe(
      "Three things about the cover file: too small to upload, squarer than Amazon asks for and too large a file.",
    );
  });

  it("leaves a single fault completely alone", () => {
    /* The case that still works: one fault keeps its own wording and its own
       `fix=shape` intent, which is what opens the crop window already loaded.
       Folding this too would trade a working shortcut for tidiness. */
    const found = findingsFrom([
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("readiness:cover-shape");
    expect(found[0].fix).toEqual({
      kind: "route",
      path: "covers?check=1&fix=shape",
      action: "Fix the shape",
    });
  });

  it("takes the worst level of the faults it folds", () => {
    const mixed = findingsFrom([
      coverIssue("cover-too-small", "Too small to upload", "blocking"),
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
    ]);
    const notes = findingsFrom([
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-small-ish", "Smaller than recommended"),
    ]);

    expect(mixed[0].level).toBe("fix");
    expect(notes[0].level).toBe("note");
  });

  it("keeps an acronym's capitals when a label moves mid-sentence", () => {
    // "jPEG is not a format Amazon takes" is worse than a capital mid-sentence.
    const found = findingsFrom([
      coverIssue("cover-too-small", "JPEG is not a format Amazon takes"),
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
    ]);

    expect(found[0].title).toContain("JPEG is not a format Amazon takes");
  });

  it("does not count a cover fault with nowhere to go", () => {
    /* Every cover check `storeReadiness` emits has a destination today, and a
       walk test above keeps it that way — so this uses a field that does not
       exist. What it holds is the guard for the *next* check added without one:
       a row that counted it would announce a fault the list then failed to
       show, which is worse than the dead end the drop exists to prevent. */
    const found = findingsFrom([
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-small-ish", "Smaller than recommended"),
      coverIssue("cover-not-a-real-check", "Something with no destination"),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].title.startsWith("Two things")).toBe(true);
    expect(found[0].title).not.toContain("Something with no destination");
  });

  it("stands where the first of the folded rows stood, and moves nothing else", () => {
    const found = findingsFrom([
      { level: "blocking", field: "author", message: "No author name." },
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-small-ish", "Smaller than recommended"),
      { level: "advisory", field: "isbn", message: "No ISBN." },
    ]);

    expect(ids(found)).toEqual([
      "readiness:author",
      "readiness:cover-file",
      "readiness:isbn",
    ]);
  });

  it("leaves a book with no cover alone — that is a different fix", () => {
    // `cover` is a book with no cover at all and is put right in a dialog the
    // shelf owns, not on the covers screen's file checker.
    const found = findingsFrom([
      { level: "blocking", field: "cover", message: "No cover." },
      coverIssue("cover-shape", "Squarer than Amazon asks for"),
      coverIssue("cover-small-ish", "Smaller than recommended"),
    ]);

    expect(ids(found)).toEqual(["readiness:cover", "readiness:cover-file"]);
  });
});
