import { describe, it, expect } from "vitest";
import { MIN_PRICES } from "../comps/price-check";
import type { ListedBook } from "./apple-list";
import {
  kindleUnlimitedCount,
  lengthBands,
  paperbackBySide,
  priceBins,
  seriesSplit,
  shelfFacts,
  standing,
  standingBySide,
} from "./shelf-facts";

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
      amazon: { cheaper: 0, same: 0, dearer: 0 },
    });
  });

  it("answers zeros for a side with no books, which the screen words as none", () => {
    const sides = standingBySide([listed(3.99)], 4.99);
    expect(sides.traditional).toEqual({ cheaper: 0, same: 0, dearer: 0 });
  });
});

describe("Amazon's own publishers", () => {
  it("are a third side, counted below the line in the chart", () => {
    const books = [...many(MIN_PRICES, 4.99, "Thomas & Mercer"), listed(3.99)];
    const facts = shelfFacts(books);
    expect(facts.groups.amazon.count).toBe(MIN_PRICES);
    expect(facts.groups.amazon.summary?.median).toBe(4.99);
    expect(priceBins(books, 20)[4]).toEqual({ from: 4, independent: 0, traditional: MIN_PRICES });
    expect(standingBySide(books, 4.99).amazon).toEqual({ cheaper: 0, same: MIN_PRICES, dearer: 0 });
  });
});

/** An Amazon book with its details, for the facts only Amazon's data carries. */
const amazonBook = (over: Partial<ListedBook>): ListedBook => ({
  ...listed(over.price ?? 4.99, over.publisher ?? null),
  kindleUnlimited: false,
  pages: null,
  series: null,
  paperbackPrice: null,
  ...over,
});

describe("kindleUnlimitedCount", () => {
  it("counts the books in it, and how many it could tell about", () => {
    const books = [
      amazonBook({ kindleUnlimited: true }),
      amazonBook({ kindleUnlimited: true }),
      amazonBook({ kindleUnlimited: false }),
      amazonBook({ kindleUnlimited: null }),
    ];
    expect(kindleUnlimitedCount(books)).toEqual({ inIt: 2, known: 3, of: 4 });
  });

  it("knows nothing about a list that never says, which is Apple's", () => {
    expect(kindleUnlimitedCount([listed(4.99), listed(2.99)])).toEqual({ inIt: 0, known: 0, of: 2 });
  });
});

describe("seriesSplit", () => {
  it("prices first books against later ones, and leaves standalones out", () => {
    const series = (number: number, price: number) =>
      amazonBook({ price, series: { name: "S", number, of: 5 } });
    const books = [
      ...Array.from({ length: MIN_PRICES }, () => series(1, 0.99)),
      ...Array.from({ length: MIN_PRICES }, () => series(3, 4.99)),
      amazonBook({ price: 12.99 }),
    ];
    const split = seriesSplit(books);
    expect(split.firsts.count).toBe(MIN_PRICES);
    expect(split.firsts.summary?.median).toBe(0.99);
    expect(split.later.summary?.median).toBe(4.99);
    expect(split.standalone).toBe(1);
  });
});

describe("lengthBands", () => {
  it("sorts books into short, standard and long, and skips those with no page count", () => {
    const bands = lengthBands([
      amazonBook({ pages: 150 }),
      amazonBook({ pages: 250 }),
      amazonBook({ pages: 399 }),
      amazonBook({ pages: 520 }),
      amazonBook({ pages: null }),
    ]);
    expect(bands.map((b) => [b.label, b.count])).toEqual([
      ["Under 200 pages", 1],
      ["200–399 pages", 2],
      ["400 pages and over", 1],
    ]);
  });
});

describe("paperbackBySide", () => {
  it("summarises the paperbacks of each side's books", () => {
    const books = Array.from({ length: MIN_PRICES }, () => amazonBook({ paperbackPrice: 13.99 }));
    const sides = paperbackBySide([...books, amazonBook({ paperbackPrice: null })]);
    expect(sides.independent.count).toBe(MIN_PRICES);
    expect(sides.independent.summary?.median).toBe(13.99);
    expect(sides.traditional.count).toBe(0);
  });
});

describe("what it refuses to invent", () => {
  it("carries no score, rating or recommendation of any kind", () => {
    const facts = shelfFacts(many(MIN_PRICES, 4.99));
    const books = many(MIN_PRICES, 4.99);
    const keys = [
      ...Object.keys(facts),
      ...Object.keys(facts.groups.independent),
      ...Object.keys(facts.groups.independent.summary ?? {}),
      ...Object.keys(kindleUnlimitedCount(books)),
      ...Object.keys(seriesSplit(books)),
      ...Object.keys(lengthBands(books)[0]),
      ...Object.keys(paperbackBySide(books).independent),
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
