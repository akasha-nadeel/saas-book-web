import { describe, it, expect } from "vitest";
import { MIN_PRICES } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import { priceBins, shelfFacts, standing, standingBySide } from "./shelf-facts";

let n = 0;
const listed = (
  price: number,
  publisher: string | null = "Jane Doe",
  currency = "USD",
): ListedBook => {
  n += 1;
  return {
    id: `b${n}`,
    position: n,
    title: `Book ${n}`,
    author: "A Writer",
    price,
    currency,
    publisher,
    released: null,
    cover: null,
    url: null,
  };
};

const many = (count: number, price: number, publisher?: string) =>
  Array.from({ length: count }, () => listed(price, publisher));

describe("shelfFacts", () => {
  it("keeps self-published and traditional prices apart", () => {
    const facts = shelfFacts([
      ...many(3, 2.99),
      ...many(3, 4.99),
      ...many(MIN_PRICES, 11.99, "Penguin Publishing Group"),
    ]);

    expect(facts.of).toBe(6 + MIN_PRICES);
    expect(facts.groups.independent.count).toBe(6);
    expect(facts.groups.independent.summary?.median).toBe(3.99);
    expect(facts.groups.traditional.summary?.median).toBe(11.99);
  });

  it("gives no middle price to a group with too few books", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 3.99), ...many(2, 12.99, "Orbit")]);

    expect(facts.groups.traditional.count).toBe(2);
    expect(facts.groups.traditional.summary).toBe(null);
  });

  it("keeps one currency and drops the rest from every figure", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 3.99), listed(9.99, "Jane Doe", "GBP")]);

    expect(facts.currency).toBe("USD");
    expect(facts.of).toBe(MIN_PRICES);
  });

  it("counts free books and keeps them out of the middle price", () => {
    const facts = shelfFacts([...many(MIN_PRICES, 4.99), listed(0)]);

    expect(facts.free).toBe(1);
    expect(facts.groups.independent.summary?.low).toBe(4.99);
  });
});

describe("priceBins", () => {
  it("counts each whole dollar's books by side, and gathers the dear ones in the last bin", () => {
    const bins = priceBins([listed(4.99), listed(4.49, "Orbit"), listed(31)], 20);

    expect(bins).toHaveLength(21);
    expect(bins[4]).toEqual({ from: 4, independent: 1, traditional: 1 });
    expect(bins[20]).toEqual({ from: 20, independent: 1, traditional: 0 });
  });
});

describe("standing", () => {
  it("counts the books cheaper than, level with and dearer than a price", () => {
    const books = [listed(2.99), listed(4.99), listed(4.99), listed(9.99)];

    expect(standing(books, 4.99)).toEqual({ cheaper: 1, same: 2, dearer: 1 });
  });
});

describe("standingBySide", () => {
  it("compares a price with each side of the trade on its own", () => {
    const books = [
      listed(2.99),
      listed(4.99),
      listed(5.99),
      listed(9.99, "Orbit"),
      listed(12.99, "Orbit"),
    ];

    expect(standingBySide(books, 4.99)).toEqual({
      independent: { cheaper: 1, same: 1, dearer: 1 },
      traditional: { cheaper: 0, same: 0, dearer: 2 },
    });
  });

  it("answers zeros for a side with no books, which the screen words as none", () => {
    const sides = standingBySide([listed(3.99)], 4.99);
    expect(sides.traditional).toEqual({ cheaper: 0, same: 0, dearer: 0 });
  });
});

describe("what it refuses to invent", () => {
  it("carries no score, rating or recommendation of any kind", () => {
    const facts = shelfFacts(many(MIN_PRICES, 4.99));
    const keys = [
      ...Object.keys(facts),
      ...Object.keys(facts.groups.independent),
      ...Object.keys(facts.groups.independent.summary ?? {}),
    ];

    for (const banned of [
      "score",
      "rating",
      "grade",
      "recommended",
      "suggested",
      "optimal",
      "best",
      "competition",
      "sales",
      "earnings",
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});
