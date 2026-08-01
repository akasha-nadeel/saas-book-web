import { describe, expect, it } from "vitest";
import {
  cellNumber,
  copiesToLevel,
  guessColumns,
  parseCsv,
  parseLedger,
  rowsFromCsv,
  totals,
  type Entry,
} from "./ledger";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "e1",
  bookId: "b1",
  kind: "cost",
  amount: 100,
  what: "Cover",
  at: 1,
  ...over,
});

describe("totals", () => {
  it("adds costs and income separately", () => {
    const t = totals([
      entry({ id: "1", kind: "cost", amount: 400 }),
      entry({ id: "2", kind: "cost", amount: 900 }),
      entry({ id: "3", kind: "income", amount: 250, units: 100 }),
    ]);
    expect(t.spent).toBe(1300);
    expect(t.earned).toBe(250);
    expect(t.net).toBe(-1050);
    expect(t.units).toBe(100);
  });

  it("works out what a copy actually earned", () => {
    const t = totals([entry({ kind: "income", amount: 250, units: 100 })]);
    expect(t.perCopy).toBe(2.5);
  });

  /**
   * A per-copy figure invented from nothing is exactly the kind of number this
   * product refuses — and it is the one a writer would plan around.
   */
  it("refuses a per-copy figure when no row counted copies", () => {
    expect(totals([entry({ kind: "income", amount: 250 })]).perCopy).toBeNull();
  });

  it("has nothing to say about an empty ledger", () => {
    const t = totals([]);
    expect(t.spent).toBe(0);
    expect(t.net).toBe(0);
    expect(t.perCopy).toBeNull();
  });
});

describe("copiesToLevel", () => {
  it("says how many more copies get back to nothing", () => {
    const t = totals([
      entry({ id: "1", kind: "cost", amount: 1000 }),
      entry({ id: "2", kind: "income", amount: 100, units: 50 }),
    ]);
    // 900 down, £2 a copy.
    expect(copiesToLevel(t)).toBe(450);
  });

  it("says nothing to a book already in profit", () => {
    const t = totals([entry({ kind: "income", amount: 100, units: 50 })]);
    expect(copiesToLevel(t)).toBeNull();
  });

  it("refuses to divide by a royalty it does not have", () => {
    const t = totals([entry({ kind: "cost", amount: 500 })]);
    expect(copiesToLevel(t)).toBeNull();
  });
});

describe("parseLedger", () => {
  it("drops rows that are not entries", () => {
    const stored = JSON.stringify([
      { id: "a", bookId: "b", kind: "cost", amount: 10, at: 1 },
      { id: "b", bookId: "b", kind: "nonsense", amount: 10 },
      { id: "c", bookId: "b", kind: "cost", amount: "lots" },
      null,
    ]);
    expect(parseLedger(stored)).toHaveLength(1);
  });

  it("survives storage that is not JSON", () => {
    expect(parseLedger("nope")).toEqual([]);
    expect(parseLedger(null)).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("reads plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  /** Sales reports carry book titles, and book titles contain commas. */
  it("keeps a quoted comma inside its field", () => {
    expect(parseCsv('title,royalty\n"Smith, John: A Life",2.50')).toEqual([
      ["title", "royalty"],
      ["Smith, John: A Life", "2.50"],
    ]);
  });

  it("reads a doubled quote as one quote", () => {
    expect(parseCsv('a\n"She said ""no"""')).toEqual([
      ["a"],
      ['She said "no"'],
    ]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsv('a\n"one\ntwo"')).toEqual([["a"], ["one\ntwo"]]);
  });

  it("survives Windows line endings and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("cellNumber", () => {
  it("reads what spreadsheets actually contain", () => {
    expect(cellNumber("2.50")).toBe(2.5);
    expect(cellNumber("£1,234.56")).toBe(1234.56);
    expect(cellNumber("$12")).toBe(12);
  });

  it("reads a parenthesised negative, as accountants write them", () => {
    expect(cellNumber("(45.00)")).toBe(-45);
  });

  /**
   * A royalty silently treated as nought is a row quietly lost from a total
   * about money.
   */
  it("returns nothing rather than zero for a cell that is not a number", () => {
    expect(cellNumber("")).toBeNull();
    expect(cellNumber("Total")).toBeNull();
    expect(cellNumber("  ")).toBeNull();
  });
});

describe("guessColumns", () => {
  it("finds the usual names", () => {
    const guess = guessColumns([
      "Date",
      "Title",
      "Net Units Sold",
      "Royalty",
    ]);
    expect(guess.date).toBe(0);
    expect(guess.title).toBe(1);
    expect(guess.units).toBe(2);
    expect(guess.amount).toBe(3);
  });

  it("leaves out what it cannot find", () => {
    expect(guessColumns(["alpha", "beta"]).amount).toBeUndefined();
  });
});

describe("rowsFromCsv", () => {
  const map = { amount: 2, units: 1, date: 0 };

  it("reads the rows a report contains", () => {
    const rows = rowsFromCsv([["2026-03-01", "120", "240.00"]], map);
    expect(rows[0].amount).toBe(240);
    expect(rows[0].units).toBe(120);
    expect(new Date(rows[0].at).getUTCFullYear()).toBe(2026);
  });

  /**
   * Reports have subtotal lines, blank spacers and notes in them. Skipping
   * those is harmless; counting them as zero-royalty sales would not be.
   */
  it("skips a row whose amount is not a number", () => {
    const rows = rowsFromCsv(
      [
        ["2026-03-01", "120", "240.00"],
        ["", "", "Total"],
        ["", "", ""],
      ],
      map,
    );
    expect(rows).toHaveLength(1);
  });

  it("falls back to today when a date will not read", () => {
    const now = 1_700_000_000_000;
    const rows = rowsFromCsv([["not a date", "1", "2"]], map, now);
    expect(rows[0].at).toBe(now);
  });

  it("copes with a report that has no unit column", () => {
    const rows = rowsFromCsv([["2026-03-01", "240.00"]], { amount: 1, date: 0 });
    expect(rows[0].units).toBeUndefined();
    expect(rows[0].amount).toBe(240);
  });
});
