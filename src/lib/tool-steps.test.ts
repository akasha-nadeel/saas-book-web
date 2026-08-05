import { describe, expect, it } from "vitest";
import { STEPS } from "./roadmap";
import { stepsForTool, ticksForTool, untickedFor } from "./tool-steps";
import type { Book } from "./library-store";

const BOOK_ID = "b1";

function book(over: Partial<Book> = {}): Book {
  return {
    id: BOOK_ID,
    title: "The Drowned Coast",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    chapters: [{ id: "c1", title: "One", words: 100 }],
    ...over,
  } as Book;
}

describe("stepsForTool", () => {
  it("finds a tool's steps through the road's own hrefs", () => {
    expect(stepsForTool(BOOK_ID, "blurb").map((s) => s.id)).toEqual(["blurb"]);
    expect(stepsForTool(BOOK_ID, "categories").map((s) => s.id)).toEqual([
      "categories",
    ]);
  });

  it("finds both steps that land on one tool", () => {
    // Comps is opened by "Set a length to aim at" *and* "Find your comp
    // titles" — two steps, in two phases, one screen.
    expect(stepsForTool(BOOK_ID, "comps").map((s) => s.id)).toEqual([
      "target",
      "comps",
    ]);
  });

  it("answers nothing for a tool no step points at", () => {
    expect(stepsForTool(BOOK_ID, "money")).toEqual([]);
    expect(stepsForTool(BOOK_ID, "prose")).toEqual([]);
  });

  /*
   * The step the whole road was arranged around. It sat without a `href` for
   * its whole life while the tool that does the work existed, so a writer read
   * "line up ARC readers" and had nowhere to press.
   */
  it("reaches the ARC tool, which the road exists to get right", () => {
    expect(stepsForTool(BOOK_ID, "arc").map((s) => s.id)).toEqual(["arc"]);
  });
});

describe("ticksForTool", () => {
  /*
   * The load-bearing rule. `roadmapFor` ignores a stored tick on a step that
   * works itself out from the book — detected wins over ticked, so a checklist
   * cannot be lied to — which means writing one would store a fact that
   * changes nothing and reads to the next person as if it did work.
   */
  it("leaves out a step that works itself out from the book", () => {
    expect(ticksForTool(BOOK_ID, "blurb")).toEqual([]);
    expect(ticksForTool(BOOK_ID, "categories")).toEqual([]);
    // Of the two on comps, only the undetected one is a press.
    expect(ticksForTool(BOOK_ID, "comps").map((s) => s.id)).toEqual(["comps"]);
  });

  it("keeps the steps nothing can detect", () => {
    expect(ticksForTool(BOOK_ID, "covers").map((s) => s.id)).toEqual(["cover"]);
    expect(ticksForTool(BOOK_ID, "title-check").map((s) => s.id)).toEqual([
      "title",
    ]);
    expect(ticksForTool(BOOK_ID, "export").map((s) => s.id)).toEqual([
      "check",
      "export",
    ]);
  });

  it("scopes to the book it was asked about", () => {
    // The href carries the id, so a step's destination for one book must not
    // match a tool opened on another.
    expect(stepsForTool("other", "blurb").map((s) => s.id)).toEqual(["blurb"]);
    const forOne = STEPS.find((s) => s.id === "blurb")!;
    expect(forOne.href!("other")).toBe("/book/other/blurb");
  });
});

describe("untickedFor", () => {
  it("drops what is already ticked", () => {
    expect(untickedFor(book(), "covers").map((s) => s.id)).toEqual(["cover"]);
    expect(untickedFor(book({ roadmapDone: ["cover"] }), "covers")).toEqual([]);
  });

  it("ignores ticks belonging to other steps", () => {
    expect(
      untickedFor(book({ roadmapDone: ["draft", "revise"] }), "covers").map(
        (s) => s.id,
      ),
    ).toEqual(["cover"]);
  });
});
