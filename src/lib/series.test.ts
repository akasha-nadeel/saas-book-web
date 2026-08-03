import { describe, expect, it } from "vitest";
import type { BibleEntry } from "./bible";
import type { Book } from "./library-store";
import {
  introducedIn,
  isSeries,
  mergeSeriesBible,
  seriesKey,
  seriesMentions,
  seriesNameOf,
  seriesOf,
  writtenAboutTwice,
  type BookBible,
  type SeriesBook,
} from "./series";

const book = (over: Partial<Book> & { id: string }): Book => ({
  title: over.id,
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
  ...over,
  id: over.id,
});

const inSeries = (id: string, series: string, index?: number, over: Partial<Book> = {}) =>
  book({ id, publishing: { series, ...(index === undefined ? {} : { seriesIndex: index }) }, ...over });

const entry = (over: Partial<BibleEntry> & { id: string }): BibleEntry => ({
  kind: "character",
  name: over.id,
  aka: [],
  detail: "",
  at: 0,
  ...over,
});

const bible = (b: SeriesBook, entries: BibleEntry[]): BookBible => ({ book: b, entries });

const one: SeriesBook = { id: "one", title: "Book One", index: 1 };
const two: SeriesBook = { id: "two", title: "Book Two", index: 2 };

describe("seriesKey", () => {
  it("ignores case and stray whitespace between two listing forms", () => {
    expect(seriesKey("The Ash Cycle")).toBe(seriesKey("  the   ash cycle "));
  });

  it("keeps the article, because dropping it merges unrelated series", () => {
    expect(seriesKey("The Ash Cycle")).not.toBe(seriesKey("Ash Cycle"));
  });

  it("treats an empty or missing name as no series", () => {
    expect(seriesKey("   ")).toBeNull();
    expect(seriesKey(undefined)).toBeNull();
    expect(seriesKey(null)).toBeNull();
  });
});

describe("seriesNameOf", () => {
  it("reads the listing field, trimmed", () => {
    expect(seriesNameOf(inSeries("a", "  The Ash Cycle "))).toBe("The Ash Cycle");
  });

  it("is null for a book that never filled it in", () => {
    expect(seriesNameOf(book({ id: "a" }))).toBeNull();
  });
});

describe("seriesOf", () => {
  const shelf = [
    inSeries("c", "Ash", 3),
    inSeries("a", "Ash", 1),
    book({ id: "other", publishing: { series: "Something Else" } }),
    inSeries("b", "Ash", 2),
  ];

  it("gathers the books sharing a series, in reading order", () => {
    expect(seriesOf(shelf, "a").map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("includes the book asked about", () => {
    expect(seriesOf(shelf, "c").map((b) => b.id)).toContain("c");
  });

  it("puts unnumbered books after the numbered ones, in shelf order", () => {
    const mixed = [
      inSeries("late", "Ash"),
      inSeries("two", "Ash", 2),
      inSeries("early", "Ash"),
      inSeries("one", "Ash", 1),
    ];
    expect(seriesOf(mixed, "one").map((b) => b.id)).toEqual([
      "one",
      "two",
      "late",
      "early",
    ]);
  });

  it("is empty for a book with no series", () => {
    expect(seriesOf([book({ id: "a" })], "a")).toEqual([]);
  });

  it("is empty for a book that is not on the shelf", () => {
    expect(seriesOf(shelf, "missing")).toEqual([]);
  });

  it("leaves out trashed and archived books", () => {
    const withGone = [
      inSeries("a", "Ash", 1),
      inSeries("gone", "Ash", 2, { trashedAt: 1 }),
      inSeries("aside", "Ash", 3, { archivedAt: 1 }),
    ];
    expect(seriesOf(withGone, "a").map((b) => b.id)).toEqual(["a"]);
  });
});

describe("isSeries", () => {
  it("is false for a book that is the only one carrying its series name", () => {
    expect(isSeries(seriesOf([inSeries("a", "Ash", 1)], "a"))).toBe(false);
  });

  it("is true once a second book joins it", () => {
    const shelf = [inSeries("a", "Ash", 1), inSeries("b", "Ash", 2)];
    expect(isSeries(seriesOf(shelf, "a"))).toBe(true);
  });
});

describe("mergeSeriesBible", () => {
  it("makes one entry of a name written down in both books", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Elizabeth" })]),
      bible(two, [entry({ id: "2", name: "elizabeth" })]),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].in.map((r) => r.book.id)).toEqual(["one", "two"]);
  });

  it("joins a chain of aliases nobody stated the ends of", () => {
    // Elizabeth–Lizzie in book one, Lizzie–Beth in book two: one person, and
    // the writer never had to say Elizabeth is Beth.
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Elizabeth", aka: ["Lizzie"] })]),
      bible(two, [entry({ id: "2", name: "Lizzie", aka: ["Beth"] })]),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].aka).toEqual(["Beth", "Lizzie"]);
  });

  it("names the merged entry as the earliest book spells it", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Elizabeth", aka: ["Lizzie"] })]),
      bible(two, [entry({ id: "2", name: "Lizzie" })]),
    ]);
    expect(merged[0].name).toBe("Elizabeth");
    expect(introducedIn(merged[0])).toEqual(one);
  });

  it("refuses to merge on anything fuzzier than an exact name", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Elizabeth" })]),
      bible(two, [entry({ id: "2", name: "Beth" })]),
    ]);
    expect(merged.map((m) => m.name)).toEqual(["Beth", "Elizabeth"]);
  });

  it("keeps a character and a place of the same name apart", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Ash" })]),
      bible(two, [entry({ id: "2", name: "Ash", kind: "place" })]),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("keeps every book's own words rather than merging the details", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Ash", detail: "Green eyes" })]),
      bible(two, [entry({ id: "2", name: "Ash", detail: "Blue eyes" })]),
    ]);
    expect(merged[0].in.map((r) => r.entry.detail)).toEqual([
      "Green eyes",
      "Blue eyes",
    ]);
  });

  it("sorts alphabetically, as one book's bible does", () => {
    const merged = mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Zed" }), entry({ id: "2", name: "Ash" })]),
    ]);
    expect(merged.map((m) => m.name)).toEqual(["Ash", "Zed"]);
  });

  it("survives a series where nobody has written a bible", () => {
    expect(mergeSeriesBible([bible(one, []), bible(two, [])])).toEqual([]);
  });
});

describe("writtenAboutTwice", () => {
  const entriesFor = (a: string, b: string) =>
    mergeSeriesBible([
      bible(one, [entry({ id: "1", name: "Ash", detail: a })]),
      bible(two, [entry({ id: "2", name: "Ash", detail: b })]),
    ])[0];

  it("is true when two books have both written something", () => {
    expect(writtenAboutTwice(entriesFor("Green eyes", "Blue eyes"))).toBe(true);
  });

  it("is false when only one book wrote a detail", () => {
    expect(writtenAboutTwice(entriesFor("Green eyes", "   "))).toBe(false);
  });
});

describe("seriesMentions", () => {
  const merged = mergeSeriesBible([
    bible(one, [entry({ id: "1", name: "Elizabeth", aka: ["Lizzie"] })]),
    bible(two, [entry({ id: "2", name: "Ash" })]),
  ]);

  it("finds a character written down two books ago", () => {
    const found = seriesMentions("Elizabeth crossed the hall.", merged);
    expect(found.map((m) => m.entry.name)).toEqual(["Elizabeth"]);
    expect(introducedIn(found[0].entry)).toEqual(one);
  });

  it("counts every name the series knows them by, as one person", () => {
    const found = seriesMentions("Elizabeth waited. Lizzie waited.", merged);
    expect(found).toHaveLength(1);
    expect(found[0].count).toBe(2);
  });

  it("keeps the whole-word rule it borrows from the one-book lookup", () => {
    expect(seriesMentions("The ashes were cold.", merged)).toEqual([]);
  });

  it("orders by how often each is named", () => {
    const found = seriesMentions("Ash. Ash. Elizabeth.", merged);
    expect(found.map((m) => m.entry.name)).toEqual(["Ash", "Elizabeth"]);
  });
});
