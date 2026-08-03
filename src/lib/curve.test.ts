import { describe, expect, it } from "vitest";
import { curveOf, MIN_WINDOW_DAYS, type Curve } from "./curve";
import type { Entry } from "./ledger";
import type { Book } from "./library-store";

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-03T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10);

const book = (
  id: string,
  published: string | null,
  over: Partial<Book> = {},
): Book => ({
  id,
  title: id,
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
  ...(published === null ? {} : { publishing: { published } }),
  ...over,
});

let n = 0;
const sale = (
  bookId: string,
  daysAfterPublication: number,
  amount: number,
  publishedDaysAgo: number,
  units?: number,
): Entry => ({
  id: `e${n++}`,
  bookId,
  kind: "income",
  amount,
  what: "Sales",
  at: NOW - publishedDaysAgo * DAY + daysAfterPublication * DAY,
  ...(units === undefined ? {} : { units }),
});

/** Two books, one old and one a year old, each with a sale in its first week. */
const twoBooks = () => ({
  books: [book("one", daysAgo(730)), book("two", daysAgo(365))],
  entries: [sale("one", 3, 100, 730), sale("two", 3, 200, 365)],
});

/** The drawn curve, insisting it was drawable — the tests below all expect one. */
const drawn = (
  books: Parameters<typeof curveOf>[0],
  entries: Parameters<typeof curveOf>[1],
  now?: number,
): Curve => {
  const result = curveOf(books, entries, now);
  if (!result.ready) throw new Error("expected a curve");
  return result;
};

describe("curveOf", () => {
  it("draws nothing for a single book, and says one is on it", () => {
    const result = curveOf(
      [book("one", daysAgo(400))],
      [sale("one", 1, 50, 400)],
      NOW,
    );
    expect(result).toMatchObject({ ready: false, placed: 1 });
  });

  it("draws nothing when nothing has been published", () => {
    const result = curveOf([book("one", null), book("two", null)], [], NOW);
    expect(result).toMatchObject({ ready: false, placed: 0 });
    expect((result as { left: unknown[] }).left).toHaveLength(2);
  });

  it("compares two books over the same stretch of their own lives", () => {
    const { books, entries } = twoBooks();
    const curve = drawn(books, entries, NOW);
    // The younger book is 365 days old, so both are measured over 365 days.
    expect(curve.windowDays).toBe(365);
    expect(curve.books.map((b) => b.bookId)).toEqual(["one", "two"]);
  });

  it("cuts the older book back to the window rather than counting its whole life", () => {
    const curve = drawn(
      [book("one", daysAgo(730)), book("two", daysAgo(365))],
      [
        sale("one", 3, 100, 730),
        // Well past the 365-day window the younger book sets.
        sale("one", 500, 900, 730),
        sale("two", 3, 200, 365),
      ],
      NOW,
    );
    expect(curve.books[0].earned).toBe(100);
    expect(curve.books[0].rows).toBe(1);
  });

  it("counts nothing from before a book was published", () => {
    const curve = drawn(
      [book("one", daysAgo(730)), book("two", daysAgo(365))],
      [
        sale("one", -30, 500, 730), // a pre-order month, before day nought
        sale("one", 3, 100, 730),
        sale("two", 3, 200, 365),
      ],
      NOW,
    );
    expect(curve.books[0].earned).toBe(100);
  });

  it("puts the books in publication order, oldest first", () => {
    const curve = drawn(
      [book("late", daysAgo(200)), book("early", daysAgo(900))],
      [sale("late", 1, 10, 200), sale("early", 1, 20, 900)],
      NOW,
    );
    expect(curve.books.map((b) => b.bookId)).toEqual(["early", "late"]);
  });

  it("reports each book earning more than the last as a fact about the numbers", () => {
    const { books, entries } = twoBooks();
    expect(drawn(books, entries, NOW).eachAboveTheLast).toBe(true);
  });

  it("reports it as false when a book earned less than the one before", () => {
    const curve = drawn(
      [book("one", daysAgo(730)), book("two", daysAgo(365))],
      [sale("one", 3, 500, 730), sale("two", 3, 10, 365)],
      NOW,
    );
    expect(curve.eachAboveTheLast).toBe(false);
  });

  it("carries the copies and the row count as provenance", () => {
    const curve = drawn(
      [book("one", daysAgo(730)), book("two", daysAgo(365))],
      [
        sale("one", 1, 60, 730, 6),
        sale("one", 2, 40, 730, 4),
        sale("two", 1, 200, 365, 20),
      ],
      NOW,
    );
    expect(curve.books[0]).toMatchObject({ earned: 100, units: 10, rows: 2 });
  });

  describe("what it refuses", () => {
    it("leaves out a book with no publication date, and names it", () => {
      const curve = drawn(
        [
          book("one", daysAgo(730)),
          book("two", daysAgo(365)),
          book("undated", null),
        ],
        [sale("one", 1, 100, 730), sale("two", 1, 200, 365)],
        NOW,
      );
      expect(curve.books).toHaveLength(2);
      expect(curve.left).toContainEqual({ title: "undated", why: "no-date" });
    });

    it("leaves out a book too new to say anything about", () => {
      const curve = drawn(
        [
          book("one", daysAgo(730)),
          book("two", daysAgo(365)),
          book("new", daysAgo(MIN_WINDOW_DAYS - 1)),
        ],
        [
          sale("one", 1, 100, 730),
          sale("two", 1, 200, 365),
          sale("new", 0, 900, MIN_WINDOW_DAYS - 1),
        ],
        NOW,
      );
      expect(curve.books.map((b) => b.bookId)).toEqual(["one", "two"]);
      expect(curve.left).toContainEqual({ title: "new", why: "too-new" });
    });

    // A gap in the record and a zero read identically on a money screen and
    // mean opposite things.
    it("leaves out a book with no sales rows rather than drawing it at zero", () => {
      const curve = drawn(
        [
          book("one", daysAgo(730)),
          book("two", daysAgo(365)),
          book("unrecorded", daysAgo(500)),
        ],
        [sale("one", 1, 100, 730), sale("two", 1, 200, 365)],
        NOW,
      );
      expect(curve.books.map((b) => b.bookId)).toEqual(["one", "two"]);
      expect(curve.left).toContainEqual({
        title: "unrecorded",
        why: "no-sales",
      });
    });

    it("ignores costs, which say nothing about whether readers turned up", () => {
      const curve = drawn(
        [book("one", daysAgo(730)), book("two", daysAgo(365))],
        [
          sale("one", 1, 100, 730),
          sale("two", 1, 200, 365),
          {
            id: "c1",
            bookId: "one",
            kind: "cost",
            amount: 400,
            what: "Cover",
            at: NOW - 700 * DAY,
          },
        ],
        NOW,
      );
      expect(curve.books[0].earned).toBe(100);
    });

    it("leaves out trashed and archived books", () => {
      const curve = drawn(
        [
          book("one", daysAgo(730)),
          book("two", daysAgo(365)),
          book("gone", daysAgo(500), { trashedAt: 1 }),
        ],
        [
          sale("one", 1, 100, 730),
          sale("two", 1, 200, 365),
          sale("gone", 1, 5000, 500),
        ],
        NOW,
      );
      expect(curve.books.map((b) => b.bookId)).toEqual(["one", "two"]);
      expect(curve.left.map((l) => l.title)).not.toContain("gone");
    });

    it("treats a future publication date as no date", () => {
      const curve = drawn(
        [
          book("one", daysAgo(730)),
          book("two", daysAgo(365)),
          book("soon", daysAgo(-30)),
        ],
        [sale("one", 1, 100, 730), sale("two", 1, 200, 365)],
        NOW,
      );
      expect(curve.left).toContainEqual({ title: "soon", why: "no-date" });
    });

    it("draws nothing when only one book survives the refusals", () => {
      expect(
        curveOf(
          [book("one", daysAgo(730)), book("undated", null)],
          [sale("one", 1, 100, 730)],
          NOW,
        ),
      ).toMatchObject({ ready: false, placed: 1 });
    });

    it("survives a publication date that is not a date", () => {
      expect(
        curveOf(
          [book("one", "not a date"), book("two", daysAgo(365))],
          [sale("two", 1, 200, 365)],
          NOW,
        ),
      ).toMatchObject({ ready: false, placed: 1 });
    });
  });
});
