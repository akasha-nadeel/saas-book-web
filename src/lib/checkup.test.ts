import { describe, expect, it } from "vitest";
import { checkup, countFindings, type Finding } from "./checkup";
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
