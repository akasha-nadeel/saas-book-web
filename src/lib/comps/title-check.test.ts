import { describe, expect, it } from "vitest";
import { findClashes, normaliseTitle } from "./title-check";
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
