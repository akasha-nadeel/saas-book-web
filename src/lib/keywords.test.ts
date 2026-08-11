import { describe, expect, it } from "vitest";
import { keywordReport, SLOTS, SLOT_MAX, type Issue } from "./keywords";

const kinds = (issues: Issue[]) => issues.map((i) => i.kind);
const of = <K extends Issue["kind"]>(issues: Issue[], kind: K) =>
  issues.filter((i): i is Extract<Issue, { kind: K }> => i.kind === kind);

describe("the seven slots", () => {
  it("always reports seven, however few are filled", () => {
    const report = keywordReport(["one"]);
    expect(report.slots).toHaveLength(SLOTS);
    expect(report.filled).toBe(1);
  });

  it("counts an empty set as nothing filled, with no complaints", () => {
    const report = keywordReport([]);
    expect(report.filled).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("ignores whitespace-only fields", () => {
    expect(keywordReport(["  ", "\t"]).filled).toBe(0);
  });

  it("flags a field past Amazon's fifty", () => {
    const long = "a".repeat(SLOT_MAX + 1);
    const found = of(keywordReport([long]).issues, "over");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ slot: 0, chars: SLOT_MAX + 1 });
  });

  it("leaves a field of exactly fifty alone", () => {
    expect(of(keywordReport(["a".repeat(SLOT_MAX)]).issues, "over")).toEqual([]);
  });
});

describe("words the listing already carries", () => {
  const listing = {
    title: "The House of Return",
    subtitle: "A Novel",
    author: "Jane Marsh",
    series: "Ash Cycle",
  };

  // The one that costs a writer most and that nothing tells them: Amazon
  // already indexes the title, so a keyword repeating it buys nothing.
  it("flags a keyword repeating the title", () => {
    const found = of(keywordReport(["house of return mystery"], listing).issues, "wasted");
    expect(found).toHaveLength(1);
    expect(found[0].words).toEqual(["house", "return"]);
    expect(found[0].where).toBe("your title");
  });

  it("names every part of the listing a word came from", () => {
    const found = of(keywordReport(["marsh ash thriller"], listing).issues, "wasted");
    expect(found[0].where).toContain("your author name");
    expect(found[0].where).toContain("your series name");
  });

  it("reports one issue per field rather than one per word", () => {
    const found = of(keywordReport(["house return marsh"], listing).issues, "wasted");
    expect(found).toHaveLength(1);
    expect(found[0].words).toHaveLength(3);
  });

  it("says nothing when the keyword shares nothing with the listing", () => {
    expect(of(keywordReport(["locked room puzzle"], listing).issues, "wasted")).toEqual([]);
  });

  // "of", "a" and "the" are in everybody's title. Flagging them would bury the
  // findings that matter.
  it("ignores short words the whole language shares", () => {
    expect(of(keywordReport(["of a the"], listing).issues, "wasted")).toEqual([]);
  });

  it("does not care about case", () => {
    expect(of(keywordReport(["HOUSE"], listing).issues, "wasted")).toHaveLength(1);
  });
});

// Amazon's own example of the rule is a shelf name repeated whole ("19th
// Century History"), and matching it word by word instead would condemn "cozy
// mystery with cats" — the single best keyword a cozy writer could spend a box
// on. The segment rule is the feature; loosening it to words would break it.
describe("shelves the book is already on", () => {
  const listing = { categories: ["Fiction / Mystery & Detective / Women Sleuths"] };

  it("flags a keyword carrying a whole shelf name", () => {
    const found = of(keywordReport(["women sleuths in cornwall"], listing).issues, "wasted");
    expect(found).toHaveLength(1);
    expect(found[0].where).toBe("your categories");
  });

  it("matches a shelf name through the punctuation a shop writes it with", () => {
    const found = of(keywordReport(["cosy mystery detective tales"], listing).issues, "wasted");
    expect(found[0].words).toContain("mystery & detective");
  });

  it("leaves a keyword that merely shares a word with the shelf", () => {
    expect(of(keywordReport(["mystery with cats"], listing).issues, "wasted")).toEqual([]);
  });

  it("ignores a one-word shelf, which is half the shop", () => {
    expect(
      of(keywordReport(["historical fiction saga"], { categories: ["Fiction"] }).issues, "wasted"),
    ).toEqual([]);
  });

  it("says the words came from both places when they do", () => {
    const found = of(
      keywordReport(["women sleuths of return"], {
        title: "The House of Return",
        categories: ["Fiction / Women Sleuths"],
      }).issues,
      "wasted",
    );
    expect(found[0].where).toContain("your title");
    expect(found[0].where).toContain("your categories");
  });
});

describe("quotation marks", () => {
  it("flags a field wrapped in double quotes", () => {
    expect(of(keywordReport(['"cozy mystery"']).issues, "quoted")).toHaveLength(1);
  });

  it("flags a curly quote anywhere in the field", () => {
    expect(of(keywordReport(["a “cozy” mystery"]).issues, "quoted")).toHaveLength(1);
  });

  it("flags a field wrapped in single quotes", () => {
    expect(of(keywordReport(["'cozy mystery'"]).issues, "quoted")).toHaveLength(1);
  });

  // An apostrophe inside a word is ordinary English, and a keyword tool that
  // fires on it is a keyword tool nobody reads.
  it("leaves an apostrophe inside a word alone", () => {
    expect(of(keywordReport(["reader's choice"]).issues, "quoted")).toEqual([]);
  });

  it("says nothing about an ordinary phrase", () => {
    expect(of(keywordReport(["small town mystery"]).issues, "quoted")).toEqual([]);
  });
});

describe("a word spent twice", () => {
  it("flags a word used in two fields, naming both", () => {
    const found = of(keywordReport(["small town mystery", "town secrets"]).issues, "repeated");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ word: "town", slots: [0, 1] });
  });

  it("does not flag a word repeated inside one field", () => {
    // Clumsy, but it costs one slot rather than two, and it is the writer's
    // sentence to write.
    expect(of(keywordReport(["town town"]).issues, "repeated")).toEqual([]);
  });

  it("says nothing when every field is distinct", () => {
    expect(of(keywordReport(["one alpha", "two beta"]).issues, "repeated")).toEqual([]);
  });
});

describe("what Amazon refuses", () => {
  it("flags a subjective claim", () => {
    const found = of(keywordReport(["best seller thriller"]).issues, "refused");
    expect(found[0]).toMatchObject({ slot: 0, term: "best seller" });
  });

  it("flags something that goes stale", () => {
    expect(of(keywordReport(["new release"]).issues, "refused")[0].term).toBe("new");
  });

  it("flags a word about the format rather than the book", () => {
    const terms = of(keywordReport(["mystery book"]).issues, "refused").map((i) => i.term);
    expect(terms).toContain("book");
  });

  // Whole-phrase matching, or every keyword tool becomes noise the first time
  // somebody writes a word that contains a banned one.
  it("does not fire on a longer word that merely contains one", () => {
    expect(of(keywordReport(["salesman booking newt"]).issues, "refused")).toEqual([]);
  });

  it("carries a reason, because the rule is not obvious", () => {
    expect(of(keywordReport(["free"]).issues, "refused")[0].why).toBeTruthy();
  });
});

describe("the order they are read in", () => {
  // A field Amazon refuses costs the whole slot; a word that merely buys
  // nothing costs less. Worst first, like every other report in the app.
  it("puts a refused field above a wasted word", () => {
    const report = keywordReport(["house of return", "bestseller"], {
      title: "The House of Return",
    });
    expect(kinds(report.issues).indexOf("refused")).toBeLessThan(
      kinds(report.issues).indexOf("wasted"),
    );
  });

  it("puts an over-long field first of all", () => {
    const report = keywordReport(["bestseller " + "a".repeat(SLOT_MAX)]);
    expect(report.issues[0].kind).toBe("over");
  });
});

// A position rather than a behaviour. Search volume is the figure a writer
// wants and it cannot be had honestly — Amazon publishes none, and the tools
// that quote one buy scraped data. If a score ever appears in this shape the
// feature has lost the thing it was built to say.
describe("what it refuses to invent", () => {
  it("carries no score, strength or volume anywhere", () => {
    const report = keywordReport(["small town mystery"], { title: "A Book" });
    expect(Object.keys(report).sort()).toEqual(["filled", "issues", "slots"]);
    for (const issue of report.issues) {
      expect(Object.keys(issue)).not.toContain("score");
      expect(Object.keys(issue)).not.toContain("volume");
    }
  });
});
