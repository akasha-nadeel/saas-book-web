"use client";

import { useMemo, useState } from "react";
import {
  KINDS,
  mentionedIn,
  parseBible,
  type BibleEntry,
  type EntryKind,
} from "@/lib/bible";
import { getBibleRaw, saveBibleRaw } from "@/lib/library-store";
import { chapterText } from "@/lib/search";
import {
  introducedIn,
  isSeries,
  seriesMentions,
  seriesNameOf,
  seriesOf,
  type SeriesBook,
} from "@/lib/series";
import {
  useBible,
  useChapterBody,
  useSeriesBible,
  useShelf,
} from "@/lib/use-library";

/**
 * The story bible, in the rail beside the manuscript.
 *
 * From the research: *"keeping track of details across multiple books must be
 * tricky"*, and *"I do get stuck sometimes… I usually forget some of my ideas.
 * I started writing notes on my phone."* A discovery writer invents a
 * character's sister in chapter four and needs her name in chapter nineteen,
 * by which point the only copy is somewhere in sixty thousand words.
 *
 * **In this chapter comes first, and that is the argument for the feature.**
 * Anyone can keep a file of names; nobody keeps it current. What a file cannot
 * do is tell you who is in the chapter you have open — and that is a search
 * over what is already written, so it is right whether or not the writer has
 * maintained anything.
 *
 * Aliases matter more than they look. A character who is Elizabeth to the
 * narrator and Lizzie to her brother is one person, and a lookup that missed
 * the second would be worse than no lookup at all.
 *
 * **The series scope is the same panel reading wider**, and it opens on the
 * series when there is one. That default is the whole point rather than a
 * preference: a writer on book three whose panel answers "none of them, by
 * name at least" about a chapter full of book one's cast has been told
 * something false by a feature that was supposed to be the reliable half. See
 * `series.ts` for what a series is and how two books' entries become one.
 *
 * Two things about scope are decided here rather than in the module. **Adding
 * always writes to the book being written**, whichever scope is showing,
 * because that is where the writer just invented whoever it is. And
 * **removing names the book it removes from**, since in the series view an
 * entry can belong to a book that is not open — an unlabelled Remove there
 * would delete something out of a manuscript the writer is not looking at.
 */
export function BiblePanel({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const shelf = useShelf();
  const own = useBible(bookId);
  const body = useChapterBody(chapterId);

  const series = useMemo(
    () => seriesOf(shelf.books, bookId),
    [shelf.books, bookId],
  );
  const hasSeries = isSeries(series);
  const merged = useSeriesBible(series);
  const self = shelf.books.find((b) => b.id === bookId);
  const seriesName = self ? seriesNameOf(self) : null;

  const [scope, setScope] = useState<"book" | "series">("series");

  /*
   * Reading across a series is the paid half; one book's bible is not.
   *
   * The toggle is drawn whenever the book is in a series, and the series read
   * is free on both plans — it was behind a Pro gate until the per-tool limits
   * arrived, and one book's bible had always been free, so the gate was the
   * last thing standing between a writer and the half of the feature that
   * answers "who did I write down two books ago".
   */
  const wide = hasSeries && scope === "series";

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [aka, setAka] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<EntryKind>("character");
  const [open, setOpen] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      wide
        ? merged.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            name: entry.name,
            aka: entry.aka,
            wrote: entry.in,
            from: introducedIn(entry),
          }))
        : own.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            name: entry.name,
            aka: entry.aka,
            wrote: [{ book: null, entry }],
            from: null,
          })),
    [wide, merged, own],
  );

  const here: Mentioned[] = useMemo(() => {
    const text = chapterText("", body);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const found = wide
      ? seriesMentions(text, merged).map((m) => ({
          id: m.entry.id,
          count: m.count,
        }))
      : mentionedIn(text, own).map((m) => ({ id: m.entry.id, count: m.count }));
    return found.flatMap(({ id, count }) => {
      const row = byId.get(id);
      return row ? [{ ...row, count }] : [];
    });
  }, [body, rows, wide, merged, own]);

  /** Of the names in this chapter, how many were written down elsewhere. */
  const borrowed = here.filter((r) => r.from && r.from.id !== bookId).length;

  function add() {
    if (!name.trim()) return;
    // Always into the book being written, whichever scope is on screen.
    saveBibleRaw(
      bookId,
      JSON.stringify([
        ...own,
        {
          id: crypto.randomUUID(),
          kind,
          name: name.trim(),
          aka: aka
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          detail: detail.trim(),
          at: Date.now(),
        },
      ]),
    );
    setName("");
    setAka("");
    setDetail("");
    setAdding(false);
  }

  /**
   * Removing reads that book's own list back rather than filtering the merged
   * one: what is written to `bible:<id>` has to be that book's entries and
   * nobody else's, and the merged view is several books at once.
   */
  function removeFrom(book: SeriesBook | null, entryId: string) {
    const id = book?.id ?? bookId;
    const from = id === bookId ? own : parseBible(getBibleRaw(id));
    saveBibleRaw(id, JSON.stringify(from.filter((e) => e.id !== entryId)));
    setOpen(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* The name is on the panel's shared header now; what is left here is the
          one action, which takes the full row rather than sitting in the corner
          of a duplicated title. */}
      <div className="border-b border-line p-3">
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="w-full rounded-md bg-accent py-1.5 font-sans text-xs
                     font-semibold text-accent-ink outline-none
                     transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {adding ? "Cancel" : "Add a person or place"}
        </button>
      </div>

      {hasSeries && (
        <div className="border-b border-line px-3 py-2.5">
          <div className="flex rounded-md border border-line p-0.5">
            {(
              [
                ["book", "This book"],
                ["series", "The series"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                aria-pressed={scope === id}
                className={`flex-1 rounded px-2 py-1 font-sans text-xs font-medium ${
                  scope === id
                    ? "bg-raised text-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {wide && (
            <p className="mt-2 font-sans text-[11px] leading-relaxed text-muted">
              {seriesName ?? "This series"} — {series.length} books on this
              machine. Bibles are not synced, so a series read elsewhere is
              whatever that machine holds.
            </p>
          )}
        </div>
      )}

      {adding && (
        <form
          className="flex flex-col gap-2 border-b border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EntryKind)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm text-fg"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <input
            value={aka}
            onChange={(e) => setAka(e.target.value)}
            placeholder="Also called (comma separated)"
            aria-label="Also called"
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="Anything you will forget by chapter nineteen"
            aria-label="Detail"
            className="resize-none rounded-md border border-line bg-surface px-2 py-1.5
                       font-sans text-sm text-fg outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-md bg-accent px-3 py-1.5 font-sans text-xs font-semibold
                       text-accent-ink disabled:opacity-40"
          >
            Add to this book
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            {wide
              ? "Nothing written down in any of these books yet. Add the people, places and things that will have to be the same three books from now."
              : "Nothing here yet. Add the people, places and things you will have forgotten the details of by the time they come back."}
          </p>
        ) : (
          <>
            {/* First, and deliberately. This is the half a plain file cannot
                do, and it is right even when the bible is out of date. */}
            <p className="mb-2 font-sans text-xs tracking-wide text-muted uppercase">
              In this chapter
            </p>
            {here.length === 0 ? (
              <p className="mb-4 font-sans text-sm text-muted">
                None of them, by name at least.
              </p>
            ) : (
              <>
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {here.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                        className="rounded-full bg-accent/10 px-2.5 py-1 font-sans text-xs
                                   font-medium text-accent"
                      >
                        {row.name}
                        <span className="ml-1 opacity-70">{row.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {borrowed > 0 && (
                  <p className="mb-5 font-sans text-[11px] text-muted">
                    {borrowed} of {here.length} first written down in an earlier
                    book.
                  </p>
                )}
                {borrowed === 0 && <div className="mb-5" />}
              </>
            )}

            {KINDS.map((k) => {
              const inKind = rows.filter((e) => e.kind === k.id);
              if (inKind.length === 0) return null;
              return (
                <div key={k.id} className="mb-4">
                  <p className="mb-1.5 font-sans text-xs tracking-wide text-muted uppercase">
                    {k.label}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {inKind.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpen(open === row.id ? null : row.id)
                          }
                          className="w-full rounded-md px-2 py-1.5 text-left font-sans
                                     text-sm text-fg hover:bg-raised"
                        >
                          {row.name}
                          {row.aka.length > 0 && (
                            <span className="text-muted">
                              {" "}
                              · {row.aka.join(", ")}
                            </span>
                          )}
                        </button>
                        {open === row.id && (
                          <div className="mt-1 flex flex-col gap-2">
                            {row.wrote.map(({ book, entry }) => (
                              <div
                                key={`${book?.id ?? bookId}:${entry.id}`}
                                className="rounded-md bg-raised p-2.5"
                              >
                                {book && (
                                  <p className="mb-1 font-sans text-[11px] tracking-wide text-muted uppercase">
                                    {book.index === undefined
                                      ? book.title
                                      : `${book.index}. ${book.title}`}
                                    {book.id === bookId && " · open"}
                                  </p>
                                )}
                                {entry.detail ? (
                                  <p className="font-sans text-xs leading-relaxed whitespace-pre-wrap text-fg">
                                    {entry.detail}
                                  </p>
                                ) : (
                                  <p className="font-sans text-xs text-muted">
                                    No detail written.
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeFrom(book, entry.id)}
                                  className="mt-2 font-sans text-[11px] text-muted hover:text-fg"
                                >
                                  {book && book.id !== bookId
                                    ? `Remove from ${book.title}`
                                    : "Remove"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One list shape for both scopes, so the panel has one render path.
 *
 * `wrote` is why it exists: in the series view an entry is several books'
 * entries, each with its own words, and the writer wants to read book one's
 * description beside book three's rather than a merge of the two.
 */
interface Row {
  id: string;
  kind: EntryKind;
  name: string;
  aka: string[];
  /** `book` is null in the one-book scope, where there is nothing to attribute. */
  wrote: { book: SeriesBook | null; entry: BibleEntry }[];
  /** Where the reader met them. Null in the one-book scope. */
  from: SeriesBook | null;
}

/** A row the open chapter actually names, and how often. */
interface Mentioned extends Row {
  count: number;
}
