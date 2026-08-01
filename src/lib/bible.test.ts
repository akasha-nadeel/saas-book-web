import { describe, expect, it } from "vitest";
import { mentionedIn, namesOf, parseBible, type BibleEntry } from "./bible";

const entry = (over: Partial<BibleEntry> = {}): BibleEntry => ({
  id: over.name ?? "e1",
  kind: "character",
  name: "Ash",
  aka: [],
  detail: "",
  at: 0,
  ...over,
});

const names = (text: string, entries: BibleEntry[]) =>
  mentionedIn(text, entries).map((m) => `${m.entry.name}:${m.count}`);

describe("parseBible", () => {
  it("reads stored entries, alphabetically", () => {
    const stored = JSON.stringify([
      { id: "b", name: "Zed", kind: "character", aka: [], detail: "", at: 1 },
      { id: "a", name: "Ash", kind: "place", aka: ["The Ash"], detail: "", at: 2 },
    ]);
    expect(parseBible(stored).map((e) => e.name)).toEqual(["Ash", "Zed"]);
  });

  it("drops a row with no name and keeps the rest", () => {
    const stored = JSON.stringify([
      { id: "a", name: "Kept" },
      { id: "b", name: "   " },
      { name: "no id" },
      null,
    ]);
    expect(parseBible(stored).map((e) => e.name)).toEqual(["Kept"]);
  });

  it("falls back to a note for a kind it does not know", () => {
    const stored = JSON.stringify([{ id: "a", name: "X", kind: "dragon" }]);
    expect(parseBible(stored)[0].kind).toBe("note");
  });

  it("survives storage that is not JSON, or is not a list", () => {
    expect(parseBible("nope")).toEqual([]);
    expect(parseBible('{"a":1}')).toEqual([]);
    expect(parseBible(null)).toEqual([]);
  });
});

describe("namesOf", () => {
  it("puts the longest first, so it is tried first", () => {
    expect(namesOf(entry({ name: "Ash", aka: ["Ash Fenner"] }))).toEqual([
      "Ash Fenner",
      "Ash",
    ]);
  });
});

describe("mentionedIn", () => {
  it("counts a name", () => {
    expect(names("Ash waited. Ash left.", [entry()])).toEqual(["Ash:2"]);
  });

  /**
   * The whole difficulty. A plain `includes` turns this feature into noise the
   * first time somebody names a character Sam and writes "same".
   */
  it("does not match a name inside a longer word", () => {
    expect(names("The ashes were cold in the cashew jar.", [entry()])).toEqual(
      [],
    );
  });

  it("does not match a name inside a longer name", () => {
    expect(names("Ashton arrived.", [entry()])).toEqual([]);
  });

  it("ignores case", () => {
    expect(names("ASH and ash and Ash.", [entry()])).toEqual(["Ash:3"]);
  });

  /**
   * The point of the whole feature for a character who is Elizabeth to the
   * narrator and Lizzie to her brother.
   */
  it("counts an alias as the same person", () => {
    const e = entry({ name: "Elizabeth", aka: ["Lizzie"] });
    expect(names("Elizabeth waited. Lizzie did not.", [e])).toEqual([
      "Elizabeth:2",
    ]);
  });

  it("counts a two-word name as a phrase, not as its parts", () => {
    const e = entry({ name: "Mrs Danvers" });
    expect(names("Danvers alone is somebody else.", [e])).toEqual([]);
    expect(names("Mrs Danvers arrived.", [e])).toEqual(["Mrs Danvers:1"]);
  });

  it("does not count an alias twice when it sits inside the full name", () => {
    const e = entry({ name: "Ash Fenner", aka: ["Ash"] });
    expect(names("Ash Fenner arrived.", [e])).toEqual(["Ash Fenner:1"]);
  });

  it("copes with a name containing punctuation", () => {
    const e = entry({ name: "O'Hara" });
    expect(names("O'Hara waited.", [e])).toEqual(["O'Hara:1"]);
  });

  it("puts the most-mentioned first", () => {
    const a = entry({ name: "Ash", id: "a" });
    const b = entry({ name: "Bree", id: "b" });
    expect(names("Ash. Bree. Bree. Bree.", [a, b])).toEqual(["Bree:3", "Ash:1"]);
  });

  it("has nothing to say about an empty chapter", () => {
    expect(mentionedIn("", [entry()])).toEqual([]);
  });
});
