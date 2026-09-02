import { describe, expect, it } from "vitest";
import {
  editDistance,
  findClashes,
  normaliseTitle,
  suggestSpelling,
  titleKey,
} from "./title-check";
import type { CompTitle } from "./comps";

const book = (title: string, year?: number): CompTitle => ({
  key: title,
  title,
  authors: ["A Writer"],
  subjects: [],
  source: "google",
  year,
});

const matches = (mine: string, titles: CompTitle[]) =>
  findClashes(mine, titles).map((c) => `${c.book.title}:${c.match}`);

describe("normaliseTitle", () => {
  it("ignores case and punctuation", () => {
    expect(normaliseTitle("The Drowned Coast!")).toBe(
      normaliseTitle("the drowned coast"),
    );
  });

  /**
   * The article matters. To a reader searching for it, "The Drowned Coast" and
   * "Drowned Coast" are the same title — a check that called them different
   * would miss exactly the clash it exists to find.
   */
  it("drops a leading article", () => {
    expect(normaliseTitle("The Drowned Coast")).toBe("drowned coast");
    expect(normaliseTitle("A Drowned Coast")).toBe("drowned coast");
  });

  it("only drops an article at the front", () => {
    expect(normaliseTitle("Return of the King")).toBe("return of the king");
  });
});

describe("findClashes", () => {
  it("finds an exact match through case, punctuation and articles", () => {
    expect(
      matches("The Drowned Coast", [book("the drowned coast!")]),
    ).toEqual(["the drowned coast!:exact"]);
  });

  it("grades a subtitle or series suffix as close", () => {
    expect(matches("The Drowned Coast", [book("The Drowned Coast: A Novel")])).toEqual(
      ["The Drowned Coast: A Novel:close"],
    );
  });

  /**
   * A weaker signal, and graded as such rather than left out — a title that
   * swallows yours is worth seeing, but it is not the same situation as
   * somebody publishing under your exact name.
   */
  it("grades a title that swallows yours as contains", () => {
    expect(
      matches("The Drowned Coast", [book("Return to the Drowned Coast")]),
    ).toEqual(["Return to the Drowned Coast:contains"]);
  });

  it("says nothing about a book that merely shares a word", () => {
    expect(matches("The Drowned Coast", [book("Coastal Erosion")])).toEqual([]);
  });

  it("puts the closest match first", () => {
    expect(
      matches("Drowned Coast", [
        book("Return to the Drowned Coast"),
        book("Drowned Coast"),
        book("Drowned Coast: A Novel"),
      ]),
    ).toEqual([
      "Drowned Coast:exact",
      "Drowned Coast: A Novel:close",
      "Return to the Drowned Coast:contains",
    ]);
  });

  // A clash with a book from last year deserves more attention than one from
  // 1961.
  it("puts the recent one first within a grade", () => {
    expect(
      matches("Drowned Coast", [
        book("Drowned Coast", 1961),
        book("drowned coast", 2024),
      ]),
    ).toEqual(["drowned coast:exact", "Drowned Coast:exact"]);
  });

  it("has nothing to say about an empty title", () => {
    expect(findClashes("", [book("Anything")])).toEqual([]);
    expect(findClashes("   ", [book("Anything")])).toEqual([]);
  });
});

describe("titleKey", () => {
  /*
   * **The bug this exists for, and it was a false all-clear.**
   *
   * A check of "grand father" reported *nothing under this exact name* while
   * three published books are called *Grandfather*. Measured on Open Library
   * on 2026-09-03: `title:"grand father"` returns 58 records and none titled
   * exactly that; `title:"grandfather"` returns 3,383 and three that are. A
   * reader searching for one finds the other and never notices the gap.
   *
   * On the one screen a writer uses to decide whether to keep a title, a
   * confident all-clear that is false is the worst answer this app can give.
   */
  it("reads a title the way a reader does, not the way it is typed", () => {
    expect(titleKey("grand father")).toBe(titleKey("Grandfather"));
    expect(titleKey("Sun Flower")).toBe(titleKey("sunflower"));
  });

  it("folds accents, so a café is a cafe", () => {
    expect(titleKey("Café")).toBe(titleKey("Cafe"));
    expect(titleKey("Brontë")).toBe(titleKey("Bronte"));
  });

  /* The ampersand has to become a word *before* `normaliseTitle` runs, or
     there is nothing left to map — punctuation is already a space by then.
     Written the other way round the fold silently does nothing. */
  it("treats an ampersand as the word it is read as", () => {
    expect(titleKey("Salt & Pepper")).toBe(titleKey("Salt and Pepper"));
  });

  /*
   * **What must not collapse.** Removing spaces is a blunt instrument, and
   * these are the cases that would show it: the leading article is dropped
   * before the key is taken, so "The Rapist" keys as `rapist` rather than
   * colliding with "Therapist"; and a title that merely *starts* with another
   * stays a `close` match rather than being promoted to an exact one.
   */
  it("does not fold two different titles into one", () => {
    expect(titleKey("The Rapist")).not.toBe(titleKey("Therapist"));
    expect(titleKey("Grand Father")).not.toBe(titleKey("Grand Father Tree"));
    expect(titleKey("Notes")).not.toBe(titleKey("No Tes ting"));
  });

  it("is empty for a title with nothing in it", () => {
    expect(titleKey("")).toBe("");
    expect(titleKey("   —  ")).toBe("");
  });
});

describe("findClashes, on spelling", () => {
  it("counts a joined spelling as the same name", () => {
    const found = findClashes("grand father", [
      book("Grandfather", 1993),
      book("Grand Father Tree", 2022),
    ]);
    expect(found.filter((c) => c.match === "exact")).toHaveLength(1);
    expect(found.find((c) => c.match === "exact")?.book.title).toBe(
      "Grandfather",
    );
    /* Still close, not exact — the grading below the headline is unchanged. */
    expect(found.find((c) => c.book.title === "Grand Father Tree")?.match).toBe(
      "close",
    );
  });
});

describe("editDistance", () => {
  it("counts single-character edits", () => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("spidrmn", "spidrmn")).toBe(0);
    expect(editDistance("spidrmn", "spiderman")).toBe(2);
    expect(editDistance("", "cat")).toBe(3);
    expect(editDistance("cat", "")).toBe(3);
  });
});

describe("suggestSpelling", () => {
  /*
   * **The four rows the threshold was set from**, measured against Google
   * Books on 2026-09-03. The first three are typos with a published title two
   * edits away; the fourth is somebody's own invented name whose nearest
   * neighbour merely shares a stem.
   *
   * The fourth is the one that matters. This is offered on a screen that has
   * just told a writer their title is clear, so a wrong suggestion is worse
   * than none: it tells somebody who chose an unusual name that they made a
   * mistake.
   */
  it("offers the title a typo was reaching for", () => {
    expect(suggestSpelling("spidrmn", ["Spider-Man", "Superior Spider-Man"]))
      .toBe("Spider-Man");
    expect(suggestSpelling("hary poter", ["Harry Potter", "Pottery"]))
      .toBe("Harry Potter");
    expect(suggestSpelling("the grate gatsby", ["THE GREAT GATSBY"]))
      .toBe("THE GREAT GATSBY");
  });

  it("says nothing about a title somebody invented", () => {
    expect(
      suggestSpelling("zylophonic murmurations", ["Murmurations", "Xylophone"]),
    ).toBe(null);
  });

  /* Punctuation, case, spacing and accents are not mistakes — `titleKey`
     folds them, so a suggestion that differs only by those is the same title
     and there is nothing to offer. */
  it("does not offer back what was already typed", () => {
    expect(suggestSpelling("spider man", ["Spider-Man"])).toBe(null);
    expect(suggestSpelling("cafe", ["Café"])).toBe(null);
    expect(suggestSpelling("salt and pepper", ["Salt & Pepper"])).toBe(null);
  });

  it("has nothing to say with nothing to say it about", () => {
    expect(suggestSpelling("", ["Spider-Man"])).toBe(null);
    expect(suggestSpelling("spidrmn", [])).toBe(null);
    expect(suggestSpelling("spidrmn", ["", "   "])).toBe(null);
  });

  /*
   * A share of the length, not a fixed count: two wrong letters in a
   * seven-letter title is a different thing from two in a forty-letter one.
   * `dog` is one edit from `dig` — a third of it — and just inside; two edits
   * on three letters is not a misspelling, it is a different word.
   */
  it("scales what it will forgive to the length of the title", () => {
    expect(suggestSpelling("dog", ["Dig"])).toBe("Dig");
    expect(suggestSpelling("dog", ["Cat"])).toBe(null);
  });

  it("picks the nearest when several are close", () => {
    expect(
      suggestSpelling("spidrmn", ["Spider-Man", "Spiderman Returns", "Spiders"]),
    ).toBe("Spider-Man");
  });
});
