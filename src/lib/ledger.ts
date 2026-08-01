/**
 * What a book cost against what it earned.
 *
 * The loudest money pain in the research, and the one nothing on the market
 * answers for indie authors: *"I look at the massive amount of money I wasted,
 * especially on the first book. Talk about regret."* *"I've spent somewhere
 * around 10k on roughly 10 books, and I'm over it."* Nobody tracks it, so
 * nobody sees it coming — and by the time they do, the money is gone.
 *
 * **Amazon has no public API**, for sales or for anything else, so this cannot
 * fetch. What KDP does do is let a writer *download* their sales, which makes
 * this a file import — the thing this codebase is already good at.
 *
 * **The import maps columns rather than assuming them.** A parser hard-coded to
 * KDP's current column names is a parser that breaks the week Amazon renames
 * one, silently, in a screen about money. Reading the header row and letting
 * the writer say which column is which works with every shop's report, with an
 * aggregator's, and with a spreadsheet somebody keeps by hand.
 */

export type EntryKind = "cost" | "income";

export interface Entry {
  id: string;
  bookId: string;
  kind: EntryKind;
  /** Whole currency units — the writer's own, whichever that is. */
  amount: number;
  what: string;
  /** Epoch ms. */
  at: number;
  /** Copies, where the row came from a sales report. */
  units?: number;
}

export interface Ledger {
  spent: number;
  earned: number;
  /** Negative while the book is underwater. */
  net: number;
  units: number;
  /** Average earned per copy, from what has actually been recorded. */
  perCopy: number | null;
}

export function totals(entries: readonly Entry[]): Ledger {
  let spent = 0;
  let earned = 0;
  let units = 0;

  for (const entry of entries) {
    if (entry.kind === "cost") spent += entry.amount;
    else {
      earned += entry.amount;
      units += entry.units ?? 0;
    }
  }

  return {
    spent: round(spent),
    earned: round(earned),
    net: round(earned - spent),
    units,
    // From the writer's own rows rather than a guessed royalty rate. Null when
    // no row carried a unit count, because a per-copy figure invented from
    // nothing is exactly the kind of number this product refuses.
    perCopy: units > 0 ? round(earned / units) : null,
  };
}

/**
 * Copies still to sell before the book is level.
 *
 * Null when it is already level, and null when there is no honest per-copy
 * figure to divide by — a break-even count off a made-up royalty would be
 * worse than no answer, because it is the number a writer would plan around.
 */
export function copiesToLevel(ledger: Ledger): number | null {
  if (ledger.net >= 0) return null;
  if (!ledger.perCopy || ledger.perCopy <= 0) return null;
  return Math.ceil(-ledger.net / ledger.perCopy);
}

export function parseLedger(raw: string | null): Entry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: Entry[] = [];
  for (const row of parsed) {
    const r = row as Record<string, unknown>;
    if (typeof r?.id !== "string" || typeof r?.bookId !== "string") continue;
    if (r.kind !== "cost" && r.kind !== "income") continue;
    if (typeof r.amount !== "number" || !Number.isFinite(r.amount)) continue;
    out.push({
      id: r.id,
      bookId: r.bookId,
      kind: r.kind,
      amount: r.amount,
      what: typeof r.what === "string" ? r.what : "",
      at: typeof r.at === "number" ? r.at : 0,
      ...(typeof r.units === "number" ? { units: r.units } : {}),
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Reading a sales report                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A CSV, as rows of cells.
 *
 * Written out rather than pulled in, because the only hard part is the quoting
 * rule and it is twelve lines: a field wrapped in quotes may contain commas and
 * newlines, and a doubled quote inside one is a literal quote. Sales reports
 * carry book titles, and book titles contain commas.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  // A trailing newline leaves one empty row, which is not a record.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * A number out of a spreadsheet cell.
 *
 * Reports arrive with currency symbols, thousands separators and parenthesised
 * negatives, because they are written for humans. A cell that will not read as
 * a number returns null rather than zero: a royalty silently treated as nought
 * is a row quietly lost from a total about money.
 */
export function cellNumber(cell: string): number | null {
  const text = cell.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[()\s]/g, "").replace(/[^\d.,-]/g, "");
  // Strip thousands separators, keep the last dot as the decimal point.
  const normalised = cleaned.replace(/,(?=\d{3}\b)/g, "");

  // A cell of pure text cleans down to an empty string, and `Number("")` is
  // zero — which would quietly turn every "Total" and "Notes" row in a report
  // into a zero-royalty sale. Insisting on a digit is what makes the promise
  // in this function's own comment true.
  if (!/\d/.test(normalised)) return null;

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

export interface ColumnMap {
  /** Column indexes in the header row. */
  amount: number;
  units?: number;
  date?: number;
  title?: number;
}

/**
 * Guess which columns are which, to be confirmed by the writer.
 *
 * A guess offered for correction, never applied silently. Shops rename columns
 * and this is a screen about money, so the writer confirms before anything is
 * added — the guess is here to save typing, not to be trusted.
 */
export function guessColumns(header: readonly string[]): Partial<ColumnMap> {
  const find = (...needles: string[]) =>
    header.findIndex((cell) => {
      const name = cell.toLowerCase();
      return needles.some((n) => name.includes(n));
    });

  const amount = find("royalt", "earning", "revenue", "income", "amount");
  const units = find("net units", "units sold", "unit", "quantity", "copies");
  const date = find("date", "month", "period");
  const title = find("title", "book", "asin");

  return {
    ...(amount > -1 ? { amount } : {}),
    ...(units > -1 ? { units } : {}),
    ...(date > -1 ? { date } : {}),
    ...(title > -1 ? { title } : {}),
  };
}

export interface ImportedRow {
  amount: number;
  units?: number;
  at: number;
  what: string;
}

/**
 * The income rows a report actually contains.
 *
 * Rows whose amount will not read as a number are skipped rather than counted
 * as nothing — a sales report has subtotal lines, blank spacers and notes in
 * it, and treating those as zero-royalty sales would be harmless while
 * treating a misread number as zero would not.
 */
export function rowsFromCsv(
  rows: readonly string[][],
  map: ColumnMap,
  fallbackDate = Date.now(),
): ImportedRow[] {
  const out: ImportedRow[] = [];

  for (const row of rows) {
    const amount = cellNumber(row[map.amount] ?? "");
    if (amount === null) continue;

    const units =
      map.units !== undefined ? cellNumber(row[map.units] ?? "") : null;
    const dateCell = map.date !== undefined ? row[map.date]?.trim() : "";
    const parsed = dateCell ? Date.parse(dateCell) : NaN;

    out.push({
      amount,
      ...(units !== null && units !== undefined ? { units } : {}),
      at: Number.isNaN(parsed) ? fallbackDate : parsed,
      what:
        (map.title !== undefined ? row[map.title]?.trim() : "") || "Sales",
    });
  }

  return out;
}
