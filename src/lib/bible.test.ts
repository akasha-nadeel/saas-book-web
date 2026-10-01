import { describe, expect, it } from "vitest";
import {
  addLink,
  connectionsOf,
  entryMatches,
  KINDS,
  kindOf,
  mentionedIn,
  namesOf,
  parseBible,
  removeEntry,
  removeLink,
  suggestLink,
  updateEntry,
  type BibleEntry,
} from "./bible";
import { CHECK_LOOK } from "./consistency-checks";

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

  it("finds a faction or an event by name like anybody else", () => {
    const guild = entry({ id: "g", name: "Red Guild", kind: "faction" });
    const war = entry({ id: "w", name: "Great War", kind: "event" });
    expect(names("The Red Guild lost the Great War.", [guild, war])).toEqual([
      "Great War:1",
      "Red Guild:1",
    ]);
  });
});

describe("KINDS", () => {
  it("gives every kind its own hue", () => {
    expect(new Set(KINDS.map((k) => k.hue)).size).toBe(KINDS.length);
  });

  /**
   * `check-hue.ts` measured its ink mixes to AA on the palest hue of the
   * consistency family. A kind hue from outside that family has never been
   * measured, and the one that fails will be the one nobody looked at in
   * daylight.
   */
  it("takes every hue from the family the consistency check measured", () => {
    const measured = new Set(Object.values(CHECK_LOOK).map((l) => l.hue));
    for (const kind of KINDS) expect(measured).toContain(kind.hue);
  });

  it("finds a kind's own row", () => {
    expect(kindOf("faction")).toMatchObject({ label: "Factions", one: "Faction" });
  });
});

describe("entryMatches", () => {
  const anna = { names: ["Anna Vale", "Annie"], detail: "The fisher's daughter." };
  const hit = (query: string) => entryMatches(anna.names, anna.detail, query);

  it("matches everything while the box is empty", () => {
    expect(hit("")).toBe(true);
    expect(hit("   ")).toBe(true);
  });

  it("finds a name from its first letters, ignoring case", () => {
    expect(hit("ann")).toBe(true);
    expect(hit("VALE")).toBe(true);
  });

  it("finds an entry by what is written about it", () => {
    expect(hit("fisher")).toBe(true);
  });

  it("wants every word, in any order", () => {
    expect(hit("daughter anna")).toBe(true);
    expect(hit("anna guild")).toBe(false);
  });
});

describe("suggestLink", () => {
  it("words the common pairs the way a writer would", () => {
    expect(suggestLink("character", "place")).toBe("lives-in");
    expect(suggestLink("character", "faction")).toBe("member-of");
    expect(suggestLink("character", "event")).toBe("took-part-in");
    expect(suggestLink("event", "place")).toBe("happened-at");
    expect(suggestLink("place", "place")).toBe("part-of");
    expect(suggestLink("faction", "faction")).toBe("part-of");
  });

  it("falls back to the one that is true of any two things", () => {
    expect(suggestLink("place", "character")).toBe("related-to");
    expect(suggestLink("character", "character")).toBe("related-to");
    expect(suggestLink("lore", "thing")).toBe("related-to");
  });
});

describe("the world's kinds", () => {
  it("keeps a faction, an event and lore as themselves", () => {
    const stored = JSON.stringify([
      { id: "a", name: "Red Guild", kind: "faction" },
      { id: "b", name: "Great War", kind: "event" },
      { id: "c", name: "The Weave", kind: "lore" },
    ]);
    expect(parseBible(stored).map((e) => e.kind)).toEqual([
      "event",
      "faction",
      "lore",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const anna = entry({ id: "anna", name: "Anna" });
const town = entry({ id: "town", name: "Rivertown", kind: "place" });
const guild = entry({ id: "guild", name: "Red Guild", kind: "faction" });
const world = [anna, town, guild];

const lines = (of: BibleEntry, all: readonly BibleEntry[]) =>
  connectionsOf(of, all).map((c) => `${c.label} ${c.entry.name}`);

describe("parseBible, links", () => {
  it("reads links it understands", () => {
    const stored = JSON.stringify([
      { id: "anna", name: "Anna", links: [{ to: "town", kind: "lives-in" }] },
      { id: "town", name: "Rivertown", kind: "place" },
    ]);
    expect(parseBible(stored)[0].links).toEqual([
      { to: "town", kind: "lives-in" },
    ]);
  });

  it("drops a bad shape, an unknown kind, a self-link, a duplicate and a dead end", () => {
    const stored = JSON.stringify([
      {
        id: "anna",
        name: "Anna",
        links: [
          null,
          "town",
          { to: "town", kind: "married-to" },
          { to: "anna", kind: "related-to" },
          { to: "town", kind: "lives-in" },
          { to: "town", kind: "lives-in" },
          { to: "gone", kind: "member-of" },
        ],
      },
      { id: "town", name: "Rivertown", kind: "place" },
    ]);
    expect(parseBible(stored)[0].links).toEqual([
      { to: "town", kind: "lives-in" },
    ]);
  });

  /** A bible written before links existed must read back exactly as it was. */
  it("leaves no links key on an entry that has none", () => {
    const stored = JSON.stringify([
      { id: "a", name: "Ash", kind: "character", aka: [], detail: "", at: 1 },
      { id: "b", name: "Bree", links: "nonsense" },
      { id: "c", name: "Cole", links: [{ to: "gone", kind: "lives-in" }] },
    ]);
    for (const e of parseBible(stored)) expect("links" in e).toBe(false);
  });
});

describe("connectionsOf", () => {
  const linked = addLink(
    addLink(world, "anna", { to: "town", kind: "lives-in" }),
    "anna",
    { to: "guild", kind: "member-of" },
  );
  const [a, t, g] = ["anna", "town", "guild"].map(
    (id) => linked.find((e) => e.id === id)!,
  );

  it("reads a link forwards from the entry that holds it", () => {
    expect(lines(a, linked)).toEqual(["Lives in Rivertown", "Member of Red Guild"]);
  });

  it("reads the same link backwards from the other end", () => {
    expect(lines(t, linked)).toEqual(["Home to Anna"]);
    expect(lines(g, linked)).toEqual(["Members Anna"]);
  });

  it("marks only the holder's side as the one to remove from", () => {
    expect(connectionsOf(a, linked).every((c) => c.outgoing)).toBe(true);
    expect(connectionsOf(t, linked).every((c) => !c.outgoing)).toBe(true);
  });

  it("shows a symmetric link written from both ends once", () => {
    const both = [
      { ...anna, links: [{ to: "town", kind: "related-to" as const }] },
      { ...town, links: [{ to: "anna", kind: "related-to" as const }] },
    ];
    expect(lines(both[0], both)).toEqual(["Related to Rivertown"]);
    expect(lines(both[1], both)).toEqual(["Related to Anna"]);
  });

  it("has nothing to say about an entry with no links either way", () => {
    expect(connectionsOf(guild, world)).toEqual([]);
  });
});

describe("addLink", () => {
  it("refuses a link to itself, to a stranger, or one that already stands", () => {
    const once = addLink(world, "anna", { to: "town", kind: "lives-in" });
    expect(addLink(world, "anna", { to: "anna", kind: "related-to" })).toBe(world);
    expect(addLink(world, "anna", { to: "nobody", kind: "lives-in" })).toBe(world);
    expect(addLink(once, "anna", { to: "town", kind: "lives-in" })).toBe(once);
  });

  it("refuses a symmetric link already written from the other end", () => {
    const once = addLink(world, "anna", { to: "town", kind: "related-to" });
    expect(addLink(once, "town", { to: "anna", kind: "related-to" })).toBe(once);
  });

  it("allows two different links between the same pair", () => {
    const two = addLink(
      addLink(world, "anna", { to: "town", kind: "lives-in" }),
      "anna",
      { to: "town", kind: "related-to" },
    );
    expect(two.find((e) => e.id === "anna")!.links).toHaveLength(2);
  });

  it("round-trips through storage", () => {
    const linked = addLink(world, "anna", { to: "town", kind: "lives-in" });
    const back = parseBible(JSON.stringify(linked));
    expect(back.find((e) => e.id === "anna")!.links).toEqual([
      { to: "town", kind: "lives-in" },
    ]);
  });
});

describe("removeLink", () => {
  it("removes the one link and leaves no empty list behind", () => {
    const linked = addLink(world, "anna", { to: "town", kind: "lives-in" });
    const back = removeLink(linked, "anna", { to: "town", kind: "lives-in" });
    expect("links" in back.find((e) => e.id === "anna")!).toBe(false);
  });
});

describe("removeEntry", () => {
  /** Deleting Rivertown cannot leave Anna living nowhere. */
  it("takes every link pointing at the entry with it", () => {
    const linked = addLink(
      addLink(world, "anna", { to: "town", kind: "lives-in" }),
      "anna",
      { to: "guild", kind: "member-of" },
    );
    const left = removeEntry(linked, "town");
    expect(left.map((e) => e.id)).toEqual(["anna", "guild"]);
    expect(left.find((e) => e.id === "anna")!.links).toEqual([
      { to: "guild", kind: "member-of" },
    ]);
  });
});

describe("updateEntry", () => {
  it("changes what it is given and keeps the id, the date and the links", () => {
    const linked = addLink(world, "anna", { to: "town", kind: "lives-in" });
    const edited = updateEntry(linked, "anna", {
      name: "  Anna Vale ",
      aka: [" Annie ", ""],
      detail: "Fisher's daughter.",
    }).find((e) => e.id === "anna")!;
    expect(edited).toMatchObject({
      id: "anna",
      name: "Anna Vale",
      aka: ["Annie"],
      detail: "Fisher's daughter.",
      links: [{ to: "town", kind: "lives-in" }],
    });
  });

  /** A nameless entry is dropped on the next read, and its links with it. */
  it("refuses a blank name", () => {
    expect(updateEntry(world, "anna", { name: "   " })).toBe(world);
  });
});
