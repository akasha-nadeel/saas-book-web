import { describe, expect, it } from "vitest";
import {
  BLEED,
  estimatePages,
  gutterFor,
  MAX_PAGES,
  MIN_PAGES,
  mm,
  PAPER,
  paperbackSpec,
  SPINE_TEXT_MIN_PAGES,
  TRIM_MAX,
} from "./paperback";

describe("gutterFor", () => {
  /**
   * The number writers most often leave at a default and most often regret: a
   * thick book does not open flat, so text near the spine curves out of sight.
   */
  it("grows with the page count", () => {
    expect(gutterFor(100)).toBe(0.375);
    expect(gutterFor(200)).toBe(0.5);
    expect(gutterFor(400)).toBe(0.625);
    expect(gutterFor(600)).toBe(0.75);
    expect(gutterFor(800)).toBe(0.875);
  });

  it("takes the boundary into the band below", () => {
    expect(gutterFor(150)).toBe(0.375);
    expect(gutterFor(151)).toBe(0.5);
  });

  it("never falls off the top of the table", () => {
    expect(gutterFor(5000)).toBe(0.875);
  });
});

describe("paperbackSpec", () => {
  it("works the spine out from the page count and the paper", () => {
    const white = paperbackSpec(300, 5.5, 8.5, "white");
    expect(white.spine).toBeCloseTo(300 * PAPER.white.perPage, 6);

    // Cream is thicker, so the same book has a wider spine on it. This is the
    // mistake that prints a title off the edge.
    const cream = paperbackSpec(300, 5.5, 8.5, "cream");
    expect(cream.spine).toBeGreaterThan(white.spine);
  });

  it("wraps the cover round both boards and the spine, with bleed", () => {
    const spec = paperbackSpec(300, 5.5, 8.5);
    expect(spec.coverWidth).toBeCloseTo(5.5 * 2 + spec.spine + BLEED * 2, 6);
    expect(spec.coverHeight).toBeCloseTo(8.5 + BLEED * 2, 6);
  });

  /**
   * A writer at 18 pages wants to be told the minimum is 24, not handed
   * nothing and left to work out why.
   */
  it("names the problem and still gives the numbers", () => {
    const thin = paperbackSpec(18, 5.5, 8.5);
    expect(thin.problems[0]).toContain(String(MIN_PAGES));
    expect(thin.spine).toBeGreaterThan(0);
  });

  it("says when a book is too thick to bind", () => {
    expect(paperbackSpec(900, 5.5, 8.5).problems[0]).toContain(
      String(MAX_PAGES),
    );
  });

  /**
   * KDP's figures, checked 2026-09-15. Standard colour is printed at the white
   * paper's weight and premium colour on a heavier one; one "Colour" at the
   * premium figure gave every standard-colour book a spine too wide.
   */
  it("keeps the two colour papers apart", () => {
    expect(PAPER.standardColour.perPage).toBe(PAPER.white.perPage);
    expect(PAPER.premiumColour.perPage).toBeGreaterThan(
      PAPER.standardColour.perPage,
    );
  });

  /** KDP: "We only print spine text on books with more than 79 pages." */
  it("allows spine text only from KDP's minimum", () => {
    expect(paperbackSpec(79, 6, 9).spineText).toBe(false);
    expect(paperbackSpec(SPINE_TEXT_MIN_PAGES - 1, 6, 9).spineText).toBe(false);
    expect(paperbackSpec(SPINE_TEXT_MIN_PAGES, 6, 9).spineText).toBe(true);
  });

  /** KDP's page ranges by paper, checked 2026-09-25. */
  it("reads the page range of the paper chosen", () => {
    expect(paperbackSpec(800, 6, 9, "white").problems).toEqual([]);
    expect(paperbackSpec(800, 6, 9, "cream").problems[0]).toContain("776");
    expect(paperbackSpec(60, 6, 9, "standardColour").problems[0]).toContain("72");
    expect(paperbackSpec(650, 6, 9, "standardColour").problems[0]).toContain("600");
    expect(paperbackSpec(60, 6, 9, "premiumColour").problems).toEqual([]);
  });

  /** Page setup offers office sizes KDP will not print a paperback at. */
  it("says when the trim is not one KDP prints", () => {
    expect(paperbackSpec(300, 8.5, 14).problems[0]).toContain(String(TRIM_MAX.height));
    expect(paperbackSpec(300, 8.5, 11).problems).toEqual([]);
    expect(paperbackSpec(300, 8.27, 11.69).problems).toEqual([]);
    expect(paperbackSpec(300, 5.83, 8.27).problems).toEqual([]);
  });

  it("says when there is no page count at all", () => {
    expect(paperbackSpec(0, 5.5, 8.5).problems[0]).toContain("No page count");
  });

  it("has nothing to complain about for an ordinary book", () => {
    expect(paperbackSpec(300, 5.5, 8.5).problems).toEqual([]);
  });
});

describe("estimatePages", () => {
  it("turns words into pages", () => {
    expect(estimatePages(27_500, 275)).toBe(100);
  });

  /**
   * A printed leaf has two sides, so an odd page count is not a thing that can
   * be bound.
   */
  it("always lands on an even number", () => {
    expect(estimatePages(275 * 99, 275) % 2).toBe(0);
    expect(estimatePages(1, 275) % 2).toBe(0);
  });

  it("has nothing to estimate from an empty book", () => {
    expect(estimatePages(0)).toBe(0);
  });
});

describe("mm", () => {
  it("converts, for everyone who does not think in inches", () => {
    expect(mm(1)).toBe(25.4);
    expect(mm(0.125)).toBe(3.2);
  });
});
