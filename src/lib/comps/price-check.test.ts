import { describe, it, expect } from "vitest";
import type { CompTitle } from "./comps";
import {
  priceFacts,
  axisCeiling,
  aboveCeiling,
  MIN_PRICES,
  PRICE_SHELVES,
  priceQuery,
  shelfForGenre,
  type PriceSummary,
} from "./price-check";

/**
 * These test the arithmetic a writer is going to price a book against, so the
 * cases are the shapes the catalogues really return rather than tidy ones: a
 * search where most records carry no price at all, a genre whose results are
 * half novels and half academic reference books, a free public-domain reprint
 * sitting in the middle of a list of paid titles.
 *
 * The figures in `a real search` are a live Google Books result recorded on
 * 2026-09-26 and are the reason the module uses a median.
 */

const book = (over: Partial<CompTitle> = {}): CompTitle => ({
  key: over.title ?? "k",
  title: "A Book",
  authors: ["A Writer"],
  subjects: [],
  source: "google",
  ...over,
});

/** A priced book, in dollars. */
const at = (amount: number, title = `$${amount}`): CompTitle =>
  book({ title, price: { amount, currency: "USD" } });

/** A book the catalogue returned with no price on it. */
const unpriced = (title = "no price"): CompTitle => book({ title });

/** n paid books, so a case can clear `MIN_PRICES` without listing them all. */
const enough = (amount = 4.99): CompTitle[] =>
  Array.from({ length: MIN_PRICES }, (_, i) => at(amount, `book ${i}`));

describe("priceFacts", () => {
  it("counts what it looked at, not only what it found", () => {
    const look = priceFacts([...enough(), unpriced(), unpriced()]);

    expect(look.of).toBe(MIN_PRICES + 2);
    expect(look.from).toBe(MIN_PRICES);
  });

  it("says nothing at all when no book carried a price", () => {
    const look = priceFacts([unpriced("a"), unpriced("b")]);

    expect(look.currency).toBe(null);
    expect(look.from).toBe(0);
    expect(look.prices).toEqual([]);
    expect(look.summary).toBe(null);
  });

  it("has nothing to say about an empty search", () => {
    const look = priceFacts([]);

    expect(look.of).toBe(0);
    expect(look.summary).toBe(null);
  });

  it("sorts the books it found cheapest first", () => {
    const look = priceFacts([at(11.99), at(2.99), at(5.99)]);

    expect(look.prices.map((p) => p.amount)).toEqual([2.99, 5.99, 11.99]);
  });

  it("names the currency it read", () => {
    expect(priceFacts([at(4.99)]).currency).toBe("USD");
  });
});

describe("the threshold", () => {
  /*
   * The bug this guards is a real measurement. `historical fiction world war
   * two` returned twenty books of which exactly one carried a price: a $167
   * academic history. Reported as a median, that is a confident wrong answer
   * about what historical fiction costs, produced from a sample of one.
   */
  it("refuses to summarise one expensive outlier", () => {
    const look = priceFacts([at(167), ...Array.from({ length: 19 }, (_, i) => unpriced(`u${i}`))]);

    expect(look.summary).toBe(null);
    expect(look.from).toBe(1);
  });

  it("still hands back the books it found, so the screen can show them", () => {
    const look = priceFacts([at(167), unpriced()]);

    expect(look.summary).toBe(null);
    expect(look.prices.map((p) => p.amount)).toEqual([167]);
  });

  it("summarises at the threshold and not one below it", () => {
    const below = priceFacts(
      Array.from({ length: MIN_PRICES - 1 }, (_, i) => at(4.99, `b${i}`)),
    );
    const atLimit = priceFacts(enough());

    expect(below.summary).toBe(null);
    expect(atLimit.summary).not.toBe(null);
  });
});

describe("free books", () => {
  it("counts them and lists them but keeps them out of the figures", () => {
    const look = priceFacts([at(0, "free one"), at(0, "free two"), ...enough(4.99)]);

    expect(look.free).toBe(2);
    expect(look.from).toBe(MIN_PRICES + 2);
    expect(look.prices).toHaveLength(MIN_PRICES + 2);
    // The median is of the paid books alone — two zeroes would drag it down.
    expect(look.summary?.median).toBe(4.99);
    expect(look.summary?.from).toBe(MIN_PRICES);
    expect(look.summary?.low).toBe(4.99);
  });

  it("does not let free books alone clear the threshold", () => {
    const look = priceFacts(
      Array.from({ length: MIN_PRICES + 4 }, (_, i) => at(0, `f${i}`)),
    );

    expect(look.free).toBe(MIN_PRICES + 4);
    expect(look.summary).toBe(null);
  });
});

describe("mixed currencies", () => {
  it("keeps one currency and refuses to average across two", () => {
    const look = priceFacts([
      ...enough(4.99),
      book({ title: "in pounds", price: { amount: 99, currency: "GBP" } }),
    ]);

    expect(look.currency).toBe("USD");
    expect(look.from).toBe(MIN_PRICES);
    expect(look.prices.every((p) => p.book.price?.currency === "USD")).toBe(true);
    expect(look.summary?.high).toBe(4.99);
  });
});

describe("a real search", () => {
  /* Live Google Books result for `thriller detective serial killer`,
     2026-09-26. The last two records are criminology reference books. */
  const amounts = [
    0.5, 4.99, 4.99, 5.99, 8.99, 11.99, 11.99, 11.99, 11.99, 11.99, 14.99,
    75.95, 119,
  ];
  const look = priceFacts(amounts.map((a, i) => at(a, `book ${i}`)));

  it("reports the median the novels sit at, not the mean the textbooks move", () => {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    expect(look.summary?.median).toBe(11.99);
    expect(mean).toBeGreaterThan(22);
  });

  it("keeps the outliers in the list rather than filtering them out", () => {
    expect(look.prices.map((p) => p.amount)).toContain(119);
    expect(look.from).toBe(amounts.length);
  });

  it("reports the middle half without calling it typical", () => {
    expect(look.summary?.middleLow).toBe(5.99);
    expect(look.summary?.middleHigh).toBe(11.99);
  });

  it("stops the axis above the bulk and counts what is past it", () => {
    const ceiling = axisCeiling(look.summary as PriceSummary);

    /* The middle half tops out at 11.99, so the axis covers twice that — the
       $14.99 novel is shown where it belongs and only the two reference books
       sit on the edge. */
    expect(ceiling).toBe(25);
    expect(aboveCeiling(look.prices, ceiling)).toBe(2);
  });
});

describe("axisCeiling", () => {
  const summary = (over: Partial<PriceSummary>): PriceSummary => ({
    from: 10,
    median: 4.99,
    low: 0.99,
    high: 9.99,
    middleLow: 2.99,
    middleHigh: 6.99,
    ...over,
  });

  /*
   * The bug this rule was rewritten for: a cozy mystery shelf really does run
   * $2.99 to $5.99, and on the old fixed $20 axis every book sat in the left
   * third with two-thirds of the plot empty.
   */
  it("fits the axis to the data when nothing is an outlier", () => {
    expect(axisCeiling(summary({ middleHigh: 4.99, high: 5.99 }))).toBe(10);
  });

  it("holds the axis back when one book is far above the rest", () => {
    expect(axisCeiling(summary({ middleHigh: 11.99, high: 119 }))).toBe(25);
  });

  it("covers a dear book that is still in proportion", () => {
    expect(axisCeiling(summary({ middleHigh: 11.99, high: 19.99 }))).toBe(20);
  });

  it("rounds up to the next five rather than landing on a price", () => {
    expect(axisCeiling(summary({ middleHigh: 20, high: 31.01 }))).toBe(35);
  });

  it("never draws an axis shorter than five dollars", () => {
    expect(axisCeiling(summary({ middleHigh: 0.99, high: 1.99 }))).toBe(5);
  });

  it("counts nothing above the ceiling when nothing is", () => {
    expect(aboveCeiling([{ book: at(4.99), amount: 4.99 }], 20)).toBe(0);
  });
});

describe("PRICE_SHELVES", () => {
  it("offers something to choose from", () => {
    expect(PRICE_SHELVES.length).toBeGreaterThan(6);
  });

  /*
   * The whole point of the table. `subject:"cozy mystery"` returns twenty
   * books of which **none** carries a price — Google answers a field-prefixed
   * query out of its catalogue rather than its store. A shelf whose words
   * looked like catalogue syntax would send every writer who picked it to an
   * empty result.
   */
  it("searches plain words, never catalogue syntax", () => {
    for (const shelf of PRICE_SHELVES) {
      for (const text of [shelf.stem, shelf.words]) {
        expect(text).not.toMatch(/subject:|intitle:|inauthor:|title:|"/);
        expect(text.trim()).toBe(text);
      }
    }
  });

  /*
   * `stem` is what a typed box attaches to and `words` is what runs without
   * one, so a stem missing from its own phrase would mean the two halves of
   * the form searched different shelves.
   *
   * **Containment, not a prefix**, and that distinction is a measurement.
   * Contemporary romance's phrase is `small town contemporary romance` — the
   * qualifier leads — because that is the string that was run and counted at
   * twelve prices. Reordering it to satisfy a neater test would turn a
   * measured phrase into an unmeasured one wearing a measured number.
   */
  it("keeps every shelf's own stem inside its measured phrase", () => {
    for (const shelf of PRICE_SHELVES) {
      expect(shelf.words).toContain(shelf.stem);
    }
  });

  it("carries a real measurement on every row", () => {
    for (const shelf of PRICE_SHELVES) {
      // Above the threshold, or it should not have been added.
      expect(shelf.measured).toBeGreaterThanOrEqual(MIN_PRICES);
    }
  });

  it("leaves out the phrases that were measured not to work", () => {
    const phrases = PRICE_SHELVES.map((shelf) => shelf.words);
    // 2 priced records in 100 off academic histories; 3; and 1.
    expect(phrases).not.toContain("historical fiction world war two");
    expect(phrases).not.toContain("historical fiction victorian london");
    expect(phrases).not.toContain("horror supernatural small town");
  });

  it("holds no duplicate labels or phrases, since each is a measurement", () => {
    expect(new Set(PRICE_SHELVES.map((s) => s.label)).size).toBe(
      PRICE_SHELVES.length,
    );
    expect(new Set(PRICE_SHELVES.map((s) => s.words)).size).toBe(
      PRICE_SHELVES.length,
    );
  });
});

describe("priceQuery", () => {
  const cozy = PRICE_SHELVES.find((s) => s.label === "Cozy mystery")!;
  const literary = PRICE_SHELVES.find((s) => s.label === "Literary fiction")!;

  it("searches the shelf's measured phrase when nothing is typed", () => {
    expect(priceQuery({ shelf: cozy })).toBe("cozy mystery");
    // The broad shelf's phrase is longer than its name — measured at 1 price
    // alone against 7 with the qualifier, which is why it carries one.
    expect(priceQuery({ shelf: literary })).toBe(
      "literary fiction family secrets",
    );
  });

  /*
   * The measurement this rule exists for: `epic fantasy dragon kingdom war`
   * found 99 records and the same phrase with four more words found 16. So a
   * typed box takes the slot rather than piling on.
   */
  it("replaces the shelf's extra words rather than adding to them", () => {
    expect(priceQuery({ shelf: literary, setting: "a farm" })).toBe(
      "literary fiction a farm",
    );
    expect(
      priceQuery({ shelf: cozy, setting: "bakery", event: "theft" }),
    ).toBe("cozy mystery bakery theft");
  });

  it("never grows past a genre and two things", () => {
    const query = priceQuery({
      shelf: literary,
      setting: "a family home",
      event: "a secret coming out",
    });
    expect(query).toBe("literary fiction a family home a secret coming out");
    // The stem plus exactly the two typed values, and nothing from `words`.
    expect(query).not.toContain("family secrets");
  });

  it("uses the writer's own genre when no shelf is chosen", () => {
    expect(priceQuery({ shelf: null, genre: "silkpunk fantasy" })).toBe(
      "silkpunk fantasy",
    );
    expect(
      priceQuery({ shelf: null, genre: "silkpunk fantasy", event: "a duel" }),
    ).toBe("silkpunk fantasy a duel");
  });

  it("has nothing to search when the form is empty", () => {
    expect(priceQuery({ shelf: null })).toBe("");
    expect(priceQuery({ shelf: null, genre: "   " })).toBe("");
  });

  it("ignores a box holding only spaces", () => {
    expect(priceQuery({ shelf: cozy, setting: "   ", event: "  " })).toBe(
      "cozy mystery",
    );
  });

  it("trims what the writer typed rather than searching their spaces", () => {
    expect(priceQuery({ shelf: cozy, setting: "  bakery  " })).toBe(
      "cozy mystery bakery",
    );
  });
});

describe("shelfForGenre", () => {
  it("starts a book's own genre on a shelf", () => {
    expect(shelfForGenre("Mystery")?.label).toBe("Cozy mystery");
    expect(shelfForGenre("Science fiction")?.label).toBe("Space opera");
  });

  /*
   * Not an oversight: every candidate phrase for the literary-historical shelf
   * was measured and refused. An unmapped genre leaves the dropdown unset,
   * which is honest, rather than pointing at a shelf that is not theirs.
   */
  it("leaves a genre unmapped rather than guessing", () => {
    expect(shelfForGenre("Historical fiction")).toBe(null);
    expect(shelfForGenre("Other")).toBe(null);
    expect(shelfForGenre(undefined)).toBe(null);
    expect(shelfForGenre("Cookery")).toBe(null);
  });

  it("maps only to shelves that exist", () => {
    for (const genre of [
      "Fantasy",
      "Science fiction",
      "Romance",
      "Mystery",
      "Thriller",
      "Literary fiction",
      "Young adult",
      "Horror",
      "Memoir",
    ]) {
      const shelf = shelfForGenre(genre);
      expect(shelf).not.toBe(null);
      expect(PRICE_SHELVES).toContain(shelf);
    }
  });
});

describe("what it refuses to invent", () => {
  const look = priceFacts(enough());

  it("carries no score, rating or recommendation of any kind", () => {
    const keys = [...Object.keys(look), ...Object.keys(look.summary ?? {})];

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
      "royalty",
    ]) {
      expect(keys).not.toContain(banned);
    }
  });

  it("exports no function that would answer what to charge", () => {
    /* A module that reports and does not advise has no business exporting
       anything shaped like advice. This fails the moment somebody adds one. */
    const exported = ["priceFacts", "axisCeiling", "aboveCeiling", "MIN_PRICES"];

    for (const name of exported) {
      expect(name).not.toMatch(/recommend|suggest|optimal|best|should/i);
    }
  });

  it("reports a median of one repeated price rather than a range it cannot see", () => {
    // Every book at 4.99: low, median and high are all 4.99, and the module
    // says so rather than manufacturing a spread around it.
    expect(look.summary?.low).toBe(4.99);
    expect(look.summary?.median).toBe(4.99);
    expect(look.summary?.high).toBe(4.99);
  });
});
