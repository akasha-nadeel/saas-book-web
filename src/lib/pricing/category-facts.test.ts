import { describe, expect, it } from "vitest";
import type { ListedBook } from "./apple-list";
import { LADDER_POSITIONS, categoriesSeen, storeLadder } from "./category-facts";

function book(position: number, extra: Partial<ListedBook> = {}): ListedBook {
  return {
    id: `B${position}`,
    position,
    title: `Book ${position}`,
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

/** A list of `n`, with store ranks 100× the position where given. */
const list = (n: number) =>
  Array.from({ length: n }, (_, i) => book(i + 1, { storeRank: (i + 1) * 100 }));

describe("storeLadder", () => {
  it("reads the whole-store rank at #1, #10, #25, #50 and #100", () => {
    const ladder = storeLadder(list(100));
    expect(ladder.map((s) => s.position)).toEqual([...LADDER_POSITIONS]);
    expect(ladder[0]).toEqual({ position: 1, title: "Book 1", storeRank: 100 });
    expect(ladder.at(-1)?.storeRank).toBe(10000);
  });

  it("leaves out positions a short list never reaches", () => {
    expect(storeLadder(list(30)).map((s) => s.position)).toEqual([1, 10, 25]);
  });

  it("says unknown, never zero, when a page gave no rank", () => {
    expect(storeLadder([book(1)])[0].storeRank).toBe(null);
  });
});

describe("categoriesSeen", () => {
  const books = [
    book(1, {
      storeRank: 67,
      categoryRanks: [
        { rank: 1, name: "Cozy Mystery" },
        { rank: 1, name: "Cozy Mysteries (Books)" },
      ],
    }),
    book(2, {
      storeRank: 155,
      categoryRanks: [
        { rank: 4, name: "Cozy Mystery" },
        { rank: 1, name: "Amateur Sleuths" },
      ],
    }),
    book(3, { storeRank: 400, categoryRanks: [{ rank: 9, name: "Cozy Mystery" }] }),
    book(4),
  ];
  const seen = categoriesSeen(books);

  it("counts the books in each category, most shared first", () => {
    expect(seen.categories.map((c) => [c.name, c.books])).toEqual([
      ["Cozy Mystery", 3],
      ["Amateur Sleuths", 1],
      ["Cozy Mysteries (Books)", 1],
    ]);
  });

  it("names the top-ranked book in each and its store rank", () => {
    expect(seen.categories[0]).toMatchObject({
      topRank: 1,
      topTitle: "Book 1",
      topStoreRank: 67,
    });
  });

  it("counts the books whose page said anything, against the whole list", () => {
    expect(seen.known).toBe(3);
    expect(seen.of).toBe(4);
  });

  it("keeps two of Amazon's spellings as two categories", () => {
    const two = categoriesSeen([
      book(1, {
        categoryRanks: [
          { rank: 1, name: "Cozy Animal Mystery" },
          { rank: 2, name: "Cozy Animal Mysteries" },
        ],
      }),
    ]);
    expect(two.categories).toHaveLength(2);
  });
});

describe("what it refuses to invent", () => {
  it("carries no sales figure, score or verdict", () => {
    const keys = [
      ...Object.keys(storeLadder(list(100))[0]),
      ...Object.keys(categoriesSeen(list(3))),
      ...Object.keys(
        categoriesSeen([book(1, { categoryRanks: [{ rank: 1, name: "X" }] })]).categories[0],
      ),
    ].map((k) => k.toLowerCase());
    for (const banned of [
      "sales",
      "estimate",
      "score",
      "grade",
      "difficulty",
      "easy",
      "hard",
      "competition",
      "recommended",
      "suggested",
      "best",
      "earnings",
    ]) {
      for (const key of keys) expect(key).not.toContain(banned);
    }
  });
});
