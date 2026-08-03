import { describe, expect, it } from "vitest";
import { checkFile, fixDestination, signupTo } from "@/lib/file-check";
import type { ImportedBook } from "@/lib/import/split";

/**
 * The check the landing page runs on a stranger's manuscript.
 *
 * What is being defended here is not the rule set — that lives in
 * `publishing.ts` and is tested there — but the two things this module is for:
 * that it reports what the *file* carries rather than what a fresh book
 * lacks, and that every finding still has somewhere to go once there is an
 * account to go there with.
 */

function file(over: Partial<ImportedBook> = {}): ImportedBook {
  return {
    title: "The Salt Road",
    chapters: [{ title: "One", doc: { type: "doc" }, words: 1200 }],
    ...over,
  } as ImportedBook;
}

describe("checkFile", () => {
  it("counts the words and the chapters that have prose in them", () => {
    const result = checkFile(
      file({
        chapters: [
          { title: "One", doc: { type: "doc" }, words: 1200 },
          { title: "Two", doc: { type: "doc" }, words: 800 },
          // A heading with nothing under it. It is a chapter in the list and
          // not a chapter as far as a shop is concerned.
          { title: "Three", doc: { type: "doc" }, words: 0 },
        ] as ImportedBook["chapters"],
      }),
    );

    expect(result.words).toBe(2000);
    expect(result.chapters).toBe(2);
  });

  it("puts what a shop would refuse above what merely costs readers", () => {
    const result = checkFile(file());
    const levels = result.findings.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a) => (a === "fix" ? -1 : 1)));
    expect(result.fix).toBeGreaterThan(0);
  });

  /*
   * The reason this module exists at all.
   *
   * A finished EPUB carries its author, its blurb, its categories, its ISBN
   * and its cover. Before the metadata was read, every one of those came back
   * as a finding — so the first thing the page did for a writer whose file was
   * already complete was tell them five things were wrong with it. A check
   * that cries wolf on a good book is worse than no check.
   */
  it("says nothing is wrong with a file that carries everything", () => {
    const result = checkFile(
      file({
        author: "Ada Vane",
        hasCover: true,
        publishing: {
          isbn: "9780306406157",
          description: "A road made of salt.",
          subjects: ["Fantasy"],
          publisher: "Long Shore",
        },
      }),
    );

    expect(result.findings).toEqual([]);
    expect(result.fix).toBe(0);
    expect(result.note).toBe(0);
  });

  it("reports a cover the file has but the browser could not keep", () => {
    // `hasCover` is the manifest's answer; `cover` is whether a data URL
    // survived the size budget. Reporting the second would print a finding
    // that is not true of the file.
    const result = checkFile(file({ hasCover: true }));
    expect(result.findings.map((f) => f.id)).not.toContain("readiness:cover");
  });

  it("raises the advisories, unlike the dashboard's own checkup", () => {
    // `checkup()` holds these back until a book reaches the selling phases, so
    // nobody on chapter three is told about ISBNs. Somebody who has just
    // dropped a finished manuscript on a page about uploading has asked.
    const ids = checkFile(file()).findings.map((f) => f.id);
    expect(ids).toContain("readiness:isbn");
    expect(ids).toContain("readiness:subjects");
  });

  it("never invents a finding out of what a file cannot carry", () => {
    // No genre, no word target and no advance readers are all true of every
    // file ever dropped here, and none of them is the file's fault.
    const ids = checkFile(file()).findings.map((f) => f.id);
    expect(ids).not.toContain("genre");
    expect(ids).not.toContain("target");
    expect(ids).not.toContain("arc");
  });

  /**
   * The landing page's version of the test that guards `DESTINATIONS`: a
   * finding with nowhere to go is the dead end this whole screen exists to
   * remove, and here it would be a dead end shown to somebody who has not
   * signed up yet.
   */
  it("gives every finding a destination and an action to press", () => {
    for (const finding of checkFile(file()).findings) {
      expect(finding.fix.action).toBeTruthy();
      expect(fixDestination(finding.fix, "b1")).toMatch(/^\//);
    }
  });
});

describe("fixDestination", () => {
  it("sends a tool fix to the tool, with a way back to the list", () => {
    expect(
      fixDestination({ kind: "route", path: "blurb", action: "x" }, "b1"),
    ).toBe("/book/b1/blurb?from=overview");
  });

  it("keeps a query the destination already carries", () => {
    // The three listing fields point at a *step* of the export flow, not at
    // its front door; joining with another "?" would break both.
    expect(
      fixDestination(
        { kind: "route", path: "export?step=listing", action: "x" },
        "b1",
      ),
    ).toBe("/book/b1/export?step=listing&from=overview");
  });

  it("sends an empty route to the book itself", () => {
    expect(fixDestination({ kind: "route", path: "", action: "x" }, "b1")).toBe(
      "/book/b1?from=overview",
    );
  });

  it("sends the dialog-shaped fixes to the screen that draws the same list", () => {
    // Title, author and cover are mended in a dialog the shelf owns, so there
    // is no URL to send them to — Overview is where the finding reappears with
    // the button that opens it.
    expect(fixDestination({ kind: "identity", action: "x" }, "b1")).toBe(
      "/?area=overview",
    );
    expect(fixDestination({ kind: "cover", action: "x" }, "b1")).toBe(
      "/?area=overview",
    );
  });
});

describe("signupTo", () => {
  it("encodes the destination so the query survives the round trip", () => {
    // `next` is read back by safeNext() and handed to redirect(). An unencoded
    // "&from=overview" would arrive as a second parameter of the sign-up page
    // and the writer would land somewhere else entirely.
    expect(signupTo("/book/b1/export?step=listing&from=overview")).toBe(
      "/signup?next=%2Fbook%2Fb1%2Fexport%3Fstep%3Dlisting%26from%3Doverview",
    );
  });
});
