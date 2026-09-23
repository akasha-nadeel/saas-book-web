import { describe, expect, it } from "vitest";
import {
  addIdea,
  editIdea,
  IDEA_COLOURS,
  IDEA_MAX,
  ideaColour,
  matchIdeas,
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

describe("ideaColour", () => {
  it("gives one idea the same ground every time it is asked", () => {
    // The colour is folded from the id rather than stored, so this is the
    // whole of what makes a card keep its colour across a reload.
    const id = crypto.randomUUID();
    expect(ideaColour(id)).toBe(ideaColour(id));
  });

  it("stays inside the grounds globals.css actually declares", () => {
    for (let i = 0; i < 500; i++) {
      const n = ideaColour(crypto.randomUUID());
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(IDEA_COLOURS);
    }
  });

  it("uses all six rather than crowding onto one", () => {
    // A fold that answered 3 for everything would look like a bug in the CSS.
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(ideaColour(crypto.randomUUID()));
    expect(seen.size).toBe(IDEA_COLOURS);
  });
});

describe("matchIdeas", () => {
  const lot = [
    idea({ id: "a", text: "A lighthouse keeper vanishes", at: 3 }),
    idea({ id: "b", text: "Twins who swap CITIES for a year", at: 2 }),
    idea({ id: "c", text: "The cartographer's daughter", at: 1 }),
  ];

  it("gives the board back when the box is empty", () => {
    // Clearing the field is not a filter that matches nothing.
    expect(matchIdeas(lot, "")).toHaveLength(3);
    expect(matchIdeas(lot, "   ")).toHaveLength(3);
  });

  it("does not care about case in either direction", () => {
    expect(matchIdeas(lot, "LIGHTHOUSE").map((i) => i.id)).toEqual(["a"]);
    expect(matchIdeas(lot, "cities").map((i) => i.id)).toEqual(["b"]);
  });

  it("matches inside a word, not only at its start", () => {
    expect(matchIdeas(lot, "grapher").map((i) => i.id)).toEqual(["c"]);
  });

  it("keeps the order it was given, newest first", () => {
    expect(matchIdeas(lot, "e").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("answers nothing found with nothing, not with everything", () => {
    expect(matchIdeas(lot, "submarine")).toEqual([]);
  });
});

describe("editIdea", () => {
  const lot = [
    idea({ id: "a", text: "A lighthouse keeper vanishes", at: 300, from: "b1" }),
    idea({ id: "b", text: "The cartographer's daughter", at: 200 }),
  ];

  it("replaces the words and leaves everything else alone", () => {
    // `at` staying put is what keeps the card where it is on a board ordered
    // newest first — a typo fixed should not send it to the front reading
    // "just now".
    const [first] = editIdea(lot, "a", "A lighthouse keeper walks into the sea");
    expect(first.text).toBe("A lighthouse keeper walks into the sea");
    expect(first.at).toBe(300);
    expect(first.id).toBe("a");
    expect(first.from).toBe("b1");
  });

  it("does not move the card it edited", () => {
    expect(editIdea(lot, "b", "Her father's maps").map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("touches nothing but the idea asked for", () => {
    expect(editIdea(lot, "a", "Something else")[1]).toEqual(lot[1]);
  });

  it("trims and caps, exactly as parking one does", () => {
    const [first] = editIdea(lot, "a", `   ${"z".repeat(IDEA_MAX + 50)}   `);
    expect(first.text).toHaveLength(IDEA_MAX);
  });

  it("leaves the idea alone when the box is emptied", () => {
    // Select-all then a stray key should not delete somebody's idea. Forgetting
    // one is what the bin is for.
    expect(editIdea(lot, "a", "")).toEqual(lot);
    expect(editIdea(lot, "a", "   \n  ")).toEqual(lot);
  });

  it("does nothing, and throws nothing, for an id that is not there", () => {
    expect(editIdea(lot, "gone", "anything")).toEqual(lot);
  });
});
