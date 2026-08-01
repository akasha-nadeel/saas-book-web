import { describe, expect, it } from "vitest";
import {
  addIdea,
  IDEA_MAX,
  parseIdeas,
  removeIdea,
  titleFromIdea,
  type Idea,
} from "./ideas";

const idea = (over: Partial<Idea> = {}): Idea => ({
  id: "i1",
  text: "An idea",
  at: 1,
  ...over,
});

describe("parseIdeas", () => {
  it("reads a stored list", () => {
    const stored = JSON.stringify([{ id: "a", text: "One", at: 5 }]);
    expect(parseIdeas(stored)).toEqual([{ id: "a", text: "One", at: 5 }]);
  });

  it("puts the newest first", () => {
    const stored = JSON.stringify([
      { id: "a", text: "Old", at: 1 },
      { id: "b", text: "New", at: 9 },
    ]);
    expect(parseIdeas(stored).map((i) => i.text)).toEqual(["New", "Old"]);
  });

  /**
   * This is localStorage, which holds whatever older versions left there and
   * is checked by no compiler. One malformed row should cost that row, not the
   * whole parking lot.
   */
  it("drops a malformed row and keeps the rest", () => {
    const stored = JSON.stringify([
      { id: "a", text: "Kept", at: 1 },
      { id: "b" },
      { text: "no id", at: 2 },
      { id: "c", text: "   ", at: 3 },
      null,
    ]);
    expect(parseIdeas(stored).map((i) => i.text)).toEqual(["Kept"]);
  });

  it("survives storage that is not JSON, or not a list", () => {
    expect(parseIdeas("not json")).toEqual([]);
    expect(parseIdeas('{"nope":true}')).toEqual([]);
    expect(parseIdeas(null)).toEqual([]);
  });

  it("keeps the book it struck during, when there was one", () => {
    const stored = JSON.stringify([
      { id: "a", text: "One", at: 1, from: "book-9" },
    ]);
    expect(parseIdeas(stored)[0].from).toBe("book-9");
  });
});

describe("addIdea", () => {
  it("puts the new one at the top", () => {
    const next = addIdea([idea({ id: "old" })], "Newer", { id: "new", at: 2 });
    expect(next.map((i) => i.id)).toEqual(["new", "old"]);
  });

  it("trims what was typed", () => {
    expect(addIdea([], "  spaced  ", { id: "a", at: 1 })[0].text).toBe("spaced");
  });

  /**
   * Capped rather than rejected. A writer pasting three paragraphs into a
   * ten-second capture box should get their idea kept, not an error about a
   * limit they did not know existed.
   */
  it("caps a very long idea instead of refusing it", () => {
    const long = "x".repeat(IDEA_MAX + 100);
    expect(addIdea([], long, { id: "a", at: 1 })[0].text).toHaveLength(IDEA_MAX);
  });

  it("ignores an empty capture", () => {
    expect(addIdea([], "   ", { id: "a", at: 1 })).toEqual([]);
  });

  it("records the book it struck during", () => {
    const [added] = addIdea([], "One", { id: "a", at: 1, from: "book-9" });
    expect(added.from).toBe("book-9");
  });

  it("leaves the original list alone", () => {
    const before: Idea[] = [idea()];
    addIdea(before, "Another", { id: "b", at: 2 });
    expect(before).toHaveLength(1);
  });
});

describe("removeIdea", () => {
  it("takes one off the pile", () => {
    const list = [idea({ id: "a" }), idea({ id: "b" })];
    expect(removeIdea(list, "a").map((i) => i.id)).toEqual(["b"]);
  });

  it("does nothing for an id that is not there", () => {
    expect(removeIdea([idea({ id: "a" })], "z")).toHaveLength(1);
  });
});

describe("titleFromIdea", () => {
  /**
   * Ideas are typed as premises, not titles. The first few words make a better
   * working title than the whole sentence, and the writer renames it in about a
   * second anyway.
   */
  it("takes the first clause as a working title", () => {
    expect(
      titleFromIdea(
        "A lighthouse keeper vanishes — the cartographer sent to find him is his daughter",
      ),
    ).toBe("A lighthouse keeper vanishes");
  });

  it("stops at the first full stop", () => {
    expect(titleFromIdea("She finds the key. Then everything changes.")).toBe(
      "She finds the key",
    );
  });

  it("cuts a long clause to a handful of words", () => {
    expect(
      titleFromIdea("one two three four five six seven eight nine").split(" "),
    ).toHaveLength(6);
  });

  it("always gives a book something to be called", () => {
    expect(titleFromIdea("   ")).toBe("Untitled Book");
  });
});
