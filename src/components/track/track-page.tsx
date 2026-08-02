"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  copiesToLevel,
  guessColumns,
  parseCsv,
  rowsFromCsv,
  totals,
  type ColumnMap,
  type Entry,
} from "@/lib/ledger";
import { findBook, saveLedgerRaw } from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useHydrated, useLedger, useShelf } from "@/lib/use-library";

/**
 * What this book cost against what it earned.
 *
 * The loudest money pain in the research and the one nothing on the market
 * answers for indie authors: *"I look at the massive amount of money I wasted,
 * especially on the first book"*, *"I've spent somewhere around 10k on roughly
 * 10 books, and I'm over it"*. Nobody tracks it, so nobody sees it coming.
 *
 * **Amazon has no public API**, so this cannot fetch anything. What KDP does do
 * is let a writer download their sales, which makes this a file import — and
 * the import maps columns rather than assuming them, because a parser tied to
 * today's column names is one that breaks silently the week Amazon renames one,
 * on a screen about money.
 *
 * **It never invents a royalty rate.** Per-copy comes from rows the writer
 * actually has, and the break-even count refuses to appear without one. A
 * plausible number here is worse than no number, because it is precisely the
 * figure somebody would plan a year around.
 */
export function TrackPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const ledger = useLedger();
  const book = findBook(shelf, bookId);

  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"cost" | "income">("cost");
  const [units, setUnits] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The import, once a file has been read and before it is committed.
  const [pending, setPending] = useState<{
    header: string[];
    rows: string[][];
  } | null>(null);
  const [map, setMap] = useState<Partial<ColumnMap>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const mine = useMemo(
    () => ledger.filter((e) => e.bookId === bookId),
    [ledger, bookId],
  );
  const sums = useMemo(() => totals(mine), [mine]);
  const toLevel = copiesToLevel(sums);

  function commit(next: Entry[]) {
    try {
      saveLedgerRaw(JSON.stringify(next));
      setError(null);
    } catch {
      // Not swallowed, unlike the app's own derived stores: this is what the
      // writer typed, and losing it quietly on a money screen is the worst
      // kind of failure.
      setError("Could not save that — your browser storage may be full.");
    }
  }

  function add() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !what.trim()) return;
    commit([
      {
        id: crypto.randomUUID(),
        bookId,
        kind,
        amount: value,
        what: what.trim(),
        at: Date.now(),
        ...(kind === "income" && Number(units) > 0
          ? { units: Number(units) }
          : {}),
      },
      ...ledger,
    ]);
    setWhat("");
    setAmount("");
    setUnits("");
  }

  async function readFile(file: File) {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setError("That file has no rows in it we can read.");
      return;
    }
    const [header, ...body] = rows;
    setPending({ header, rows: body });
    setMap(guessColumns(header));
    setError(null);
  }

  function importRows() {
    if (!pending || map.amount === undefined) return;
    const rows = rowsFromCsv(pending.rows, map as ColumnMap);
    commit([
      ...rows.map((row) => ({
        id: crypto.randomUUID(),
        bookId,
        kind: "income" as const,
        amount: row.amount,
        what: row.what,
        at: row.at,
        ...(row.units !== undefined ? { units: row.units } : {}),
      })),
      ...ledger,
    ]);
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Track">
        What this book cost against what it earned. Nobody keeps this, which is
        why the total is always a shock.
      </ToolHeader>

      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* ---- Where it stands ---------------------------------------- */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat value={sums.spent.toLocaleString()} label="spent" />
          <Stat value={sums.earned.toLocaleString()} label="earned" />
          <Stat
            value={`${sums.net >= 0 ? "+" : "−"}${Math.abs(sums.net).toLocaleString()}`}
            label={sums.net >= 0 ? "ahead" : "down"}
          />
        </section>

        <p className="mt-4 rounded-xl border border-line bg-panel px-5 py-4 text-fg">
          {mine.length === 0 ? (
            "Nothing recorded yet. Start with what you have already spent — it is the number that matters most and the one nobody writes down."
          ) : toLevel !== null ? (
            <>
              <strong>{toLevel.toLocaleString()} more copies</strong> at the{" "}
              {sums.perCopy} a copy you have actually been earning, and this
              book is level.
            </>
          ) : sums.net >= 0 ? (
            "This book is ahead. That is rarer than anyone tells you."
          ) : (
            /* Deliberately says nothing rather than guessing a royalty. The
               break-even count is the figure a writer would plan a year
               around. */
            "No break-even count yet — no sales row here has recorded how many copies it was, so there is no honest per-copy figure to divide by."
          )}
        </p>

        {/* ---- Add by hand -------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">Add a line</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">What</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "cost" | "income")}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-fg"
            >
              <option value="cost">Money out</option>
              <option value="income">Money in</option>
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">For</span>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={kind === "cost" ? "Cover design" : "March royalties"}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                         outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">Amount</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-fg
                         outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>
          {kind === "income" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">Copies</span>
              <input
                type="number"
                min={0}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-fg
                           outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
            </label>
          )}
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
          >
            Add
          </button>
        </form>

        {/* ---- Import a report ---------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          Or import a sales report
        </h2>
        <section className="mt-4 rounded-xl border border-line bg-panel p-5">
          <p className="text-sm text-muted">
            KDP has no public API, so nothing can be fetched — but it will let
            you download your sales. Save the report as CSV and drop it here.
            You tell us which column is which, so this works whatever the shop
            calls things and whatever they rename next year.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
            className="mt-4 text-sm text-fg"
          />

          {pending && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="text-sm font-bold text-fg">
                {pending.rows.length.toLocaleString()} rows. Which column is
                which?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Picker
                  label="Royalty or earnings"
                  header={pending.header}
                  value={map.amount}
                  onChange={(i) => setMap({ ...map, amount: i })}
                />
                <Picker
                  label="Copies (optional)"
                  header={pending.header}
                  value={map.units}
                  onChange={(i) => setMap({ ...map, units: i })}
                  optional
                />
                <Picker
                  label="Date (optional)"
                  header={pending.header}
                  value={map.date}
                  onChange={(i) => setMap({ ...map, date: i })}
                  optional
                />
                <Picker
                  label="Title (optional)"
                  header={pending.header}
                  value={map.title}
                  onChange={(i) => setMap({ ...map, title: i })}
                  optional
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                Guessed from the header row, and worth checking — subtotal and
                note rows are skipped rather than counted as zero sales.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={map.amount === undefined}
                  onClick={importRows}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                >
                  Import as money in
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-fg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ---- The lines ---------------------------------------------- */}
        {mine.length > 0 && (
          <>
            <h2 className="mt-10 text-xl font-extrabold text-fg">Every line</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {mine.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-fg">
                    {entry.what || "—"}
                  </span>
                  <span className="text-xs text-muted">
                    {relativeTime(entry.at)}
                  </span>
                  <span
                    className={`font-semibold ${
                      entry.kind === "cost" ? "text-fg" : "text-accent"
                    }`}
                  >
                    {entry.kind === "cost" ? "−" : "+"}
                    {entry.amount.toLocaleString()}
                    {entry.units ? ` · ${entry.units} copies` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      commit(ledger.filter((e) => e.id !== entry.id))
                    }
                    className="text-xs text-muted"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          Amounts are in whatever currency you work in — this does not convert,
          because a rate applied silently to a total about money would be a
          worse error than none. Nothing here is sent anywhere; the ledger is
          stored in this browser like the rest of your library.
        </p>
      </div>
    </div>
  );
}

function Picker({
  label,
  header,
  value,
  onChange,
  optional,
}: {
  label: string;
  header: string[];
  value?: number;
  onChange: (index: number | undefined) => void;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-fg">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        className="rounded-lg border border-line bg-surface px-3 py-2 text-fg"
      >
        {optional && <option value="">Not in this report</option>}
        {header.map((name, i) => (
          <option key={`${name}-${i}`} value={i}>
            {name || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
