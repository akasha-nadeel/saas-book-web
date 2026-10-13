import { describe, expect, it } from "vitest";
import { MIN_PRICES } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { priceBands, ratingFacts } from "./trend-facts";

function book(i: number, extra: Partial<ListedBook> = {}): ListedBook {
  return {
    id: `B${i}`,
    position: i,
    title: `Book ${i}`,
    author: "A. Writer",
    price: 4.99,
    currency: "USD",
    publisher: null,
    released: null,
    cover: null,
    url: null,
    ...extra,
  };
}

describe("ratingFacts", () => {
  it("bands every count and gives a middle once there are enough", () => {
    const counts = [0, 12, 60, 150, 900, 5000, 41246];
    const facts = ratingFacts(counts.map((n, i) => book(i + 1, { ratings: n, stars: 4.5 })));
    expect(facts.known).toBe(7);
    expect(facts.middle).toBe(150);
    expect(facts.middleStars).toBe(4.5);
    expect(facts.bands.map((b) => b.count)).toEqual([1, 1, 1, 2, 2]);
  });

  it("gives a count a book really has as the middle, never half a rating", () => {
    const facts = ratingFacts([10, 20, 30, 40, 50, 60].map((n, i) => book(i + 1, { ratings: n })));
    expect(Number.isInteger(facts.middle)).toBe(true);
    expect([30, 40]).toContain(facts.middle);
  });

  it("gives no middle below the threshold, and counts the unknowns out", () => {
    const few = Array.from({ length: MIN_PRICES - 1 }, (_, i) => book(i + 1, { ratings: 10 }));
    const facts = ratingFacts([...few, book(99)]);
    expect(facts.middle).toBe(null);
    expect(facts.known).toBe(MIN_PRICES - 1);
    expect(facts.of).toBe(MIN_PRICES);
  });
});

describe("priceBands", () => {
  it("puts every price in exactly one band, free included", () => {
    const prices = [0, 0.99, 2.98, 2.99, 4.99, 5, 9.99, 10, 14.99];
    const { of, bands } = priceBands(prices.map((p, i) => book(i + 1, { price: p })));
    expect(of).toBe(prices.length);
    expect(bands.map((b) => b.count)).toEqual([1, 2, 2, 2, 2]);
    expect(bands.reduce((n, b) => n + b.count, 0)).toBe(prices.length);
  });
});

describe("what it refuses to invent", () => {
  it("carries no sales figure, score or recommendation", () => {
    const keys = [
      ...Object.keys(ratingFacts([book(1, { ratings: 3 })])),
      ...Object.keys(priceBands([book(1)])),
    ].map((k) => k.toLowerCase());
    for (const banned of ["sales", "estimate", "score", "grade", "recommended", "suggested", "optimal", "best"]) {
      for (const key of keys) expect(key).not.toContain(banned);
    }
  });
});
