import { describe, expect, it } from "vitest";
import { compareLength, lengthFromPages, WORDS_PER_PAGE } from "./length";

describe("lengthFromPages", () => {
  it("turns a median page count into a range", () => {
    const target = lengthFromPages(320, 20);
    expect(target).not.toBeNull();
    expect(target!.low).toBe(80_000);
    expect(target!.high).toBe(96_000);
  });

  /**
   * A range rather than a number, because a page is not a fixed quantity of
   * words — it depends on trim size, type size and leading. One figure derived
   * from a page count would be a guess wearing the costume of a measurement.
   */
  it("gives a range wide enough to be honest", () => {
    const target = lengthFromPages(400, 20)!;
    expect(target.high - target.low).toBe(
      400 * (WORDS_PER_PAGE.high - WORDS_PER_PAGE.low),
    );
  });

  // A target of 87,431 words is a false promise.
  it("rounds to the nearest thousand", () => {
    const target = lengthFromPages(333, 20)!;
    expect(target.low % 1000).toBe(0);
    expect(target.high % 1000).toBe(0);
    expect(target.middle % 1000).toBe(0);
  });

  /**
   * Three books is not a genre. A target drawn from three and then worked
   * towards for a year is worse than no target — the writer already has
   * folklore, and folklore is at least drawn from more than three books.
   */
  it("refuses to derive a target from too few books", () => {
    expect(lengthFromPages(320, 4)).toBeNull();
    expect(lengthFromPages(320, 5)).not.toBeNull();
  });

  it("has nothing to say with no page counts at all", () => {
    expect(lengthFromPages(undefined, 20)).toBeNull();
    expect(lengthFromPages(0, 20)).toBeNull();
  });
});

describe("compareLength", () => {
  const target = lengthFromPages(320, 20)!; // 80,000–96,000

  it("places a manuscript inside the range", () => {
    expect(compareLength(88_000, target)).toBe("inside");
  });

  it("counts the ends of the range as inside it", () => {
    expect(compareLength(80_000, target)).toBe("inside");
    expect(compareLength(96_000, target)).toBe("inside");
  });

  it("places one below and one above", () => {
    expect(compareLength(40_000, target)).toBe("under");
    expect(compareLength(150_000, target)).toBe("over");
  });
});
