"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addLink,
  connectionsOf,
  entryMatches,
  KINDS,
  mentionedIn,
  parseBible,
  removeEntry,
  type BibleEntry,
  type BibleLink,
  type EntryKind,
} from "@/lib/bible";
import { getBibleRaw, saveBibleRaw } from "@/lib/library-store";
import { PANEL_TITLES } from "@/lib/panel-tabs";
import { plural } from "@/lib/plural";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchGlyph } from "@/components/ui/field";
import { ListFooter, SectionHeader } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import { ConnectPage } from "./connect-page";
import { EntryCard } from "./entry-card";
import {
  EntryPage,
  NewEntryPage,
  type BibleEdit,
  type Copy,
  type Draft,
} from "./entry-page";
import { KindDot } from "./kind-marks";

/**
 * The story bible, laid over the page in the editor's own area.
 *
 * From the research: *"keeping track of details across multiple books must be
 * tricky"*, and *"I do get stuck sometimes… I usually forget some of my ideas.
 * I started writing notes on my phone."* A discovery writer invents a
 * character's sister in chapter four and needs her name in chapter nineteen,
 * by which point the only copy is somewhere in sixty thousand words.
 *
 * **Over the page, not in the side panel** (2026-09-27, the owner's choice
 * over a view beside the page). A gallery of a book's world wants the width a
 * 23.5rem panel cannot give it — four cards to a row rather than two. This is
 * the one screen of a book that hides its page, and CLAUDE.md says why it is
 * not the Book View coming back: the page is never unmounted — the editor
 * hides it and makes it inert — so the caret, the undo history and the
 * pagination are exactly where they were when the rail's Bible, or the ✕
 * here, puts it back.
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
 * **A gallery, and a page per entry.** The entries are cards — each is a small
 * document, and `docs/styling.md` records why that earns a card where the
 * panels use grouped rows — and pressing one *pushes* its page, the way iOS
 * opens a contact, rather than growing the card in place and reflowing the
 * grid under it. The pages are a stack: following a connection pushes the
 * next entry, and back returns along the same path.
 *
 * **The series scope is the same view reading wider**, and it opens on the
 * series when there is one. That default is the whole point rather than a
 * preference: a writer on book three whose bible answers "none of them, by
 * name at least" about a chapter full of book one's cast has been told
 * something false by a feature that was supposed to be the reliable half. See
 * `series.ts` for what a series is and how two books' entries become one.
 *
 * Two things about scope are decided here rather than in the module. **Adding
 * always writes to the book being written**, whichever scope is showing,
 * because that is where the writer just invented whoever it is. And **every
 * other change is written to the book whose copy is on screen**, and says so
 * where it could surprise — an unlabelled Delete in the series view would take
 * something out of a manuscript the writer is not looking at.
 *
 * **Links live inside one book's bible**, because an entry's id is only unique
 * there.
 */
export function BibleView({
  bookId,
  chapterId,
  onClose,
}: {
  bookId: string;
  chapterId: string;
  /** Back to the page. The rail's Bible does the same; this is the one always drawn. */
  onClose: () => void;
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

  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<View[]>([]);
  /* Which way the last move went, so the page arriving slides in from the side
     it came from. Null until the first move, so the gallery does not animate
     on its first paint. */
  const [dir, setDir] = useState<"next" | "back" | null>(null);

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

  /**
   * Each book's own entries, which is what a link is resolved against. The
   * merged list already carries every entry of every book in the series, so
   * this regroups it rather than reading storage a second time.
   */
  const byBook = useMemo(() => {
    const map = new Map<string, BibleEntry[]>([[bookId, [...own]]]);
    if (!wide) return map;
    for (const row of merged) {
      for (const { book, entry } of row.in) {
        if (book.id === bookId) continue;
        const list = map.get(book.id);
        if (list) list.push(entry);
        else map.set(book.id, [entry]);
      }
    }
    return map;
  }, [bookId, own, wide, merged]);

  /** Which row holds an entry — any book's copy of it — for following a link. */
  const rowOf = useMemo(() => {
    const map = new Map<string, Row>();
    for (const row of rows) {
      for (const { entry } of row.wrote) map.set(entry.id, row);
    }
    return map;
  }, [rows]);

  const entriesIn = (book: SeriesBook | null): readonly BibleEntry[] =>
    byBook.get(book?.id ?? bookId) ?? [];

  /** The copy a card shows: this book's when it has one, else the first. */
  const copyFor = (row: Row): Copy =>
    row.wrote.find((w) => (w.book?.id ?? bookId) === bookId) ?? row.wrote[0];

  const visible = query.trim()
    ? rows.filter((row) =>
        entryMatches(
          [row.name, ...row.aka],
          row.wrote.map((w) => w.entry.detail).join("\n"),
          query,
        ),
      )
    : rows;

  // --- Moving between pages -------------------------------------------------

  /* What is on screen is worked out from the stack on every render rather than
     kept in sync with it: an entry deleted in another tab simply stops
     resolving, and the gallery is what shows. */
  const top = stack.at(-1) ?? null;
  const topRow = top && top.type !== "new" ? (rowOf.get(top.entryId) ?? null) : null;
  const page: "list" | View["type"] =
    top?.type === "new" ? "new" : topRow && top ? top.type : "list";

  const prev = stack.length >= 2 ? stack[stack.length - 2] : null;
  const backLabel =
    (prev && prev.type !== "new" && rowOf.get(prev.entryId)?.name) || "Bible";

  /** From the gallery, always a fresh stack — a stale path cannot be walked back into. */
  function open(view: View) {
    setDir("next");
    setStack([view]);
  }

  function push(view: View) {
    setDir("next");
    setStack((s) => [...s, view]);
  }

  /**
   * Back, and focus to whatever was pressed to come here.
   *
   * **Returning to a page, the page is told** (`focus` on its view, read by
   * its own mount effect), because a remounted page focuses its title on
   * arrival and anything done from out here would race that. Returning to the
   * gallery, nothing is remounted, so the card is focused from here — by the
   * effect below, once the gallery has been shown again.
   *
   * **Not a `requestAnimationFrame`**, which is what this was: a frame never
   * comes in a tab the browser is not painting, and focus is not something
   * that may depend on whether a window happens to be in front.
   */
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    document.getElementById(id)?.focus();
  });

  function pop() {
    const leaving = stack.at(-1);
    setDir("back");
    setStack((s) => {
      const rest = s.slice(0, -1);
      const below = rest.at(-1);
      if (below && leaving?.from) {
        rest[rest.length - 1] = { ...below, focus: leaving.from };
      }
      return rest;
    });
    if (stack.length <= 1 && leaving?.from) refocus.current = leaving.from;
  }

  // --- Writing --------------------------------------------------------------

  /**
   * Every change reads that book's own list back rather than working on the
   * merged one: what is written to `bible:<id>` has to be that book's entries
   * and nobody else's, and the merged view is several books at once.
   */
  function change(book: SeriesBook | null, edit: BibleEdit) {
    const id = book?.id ?? bookId;
    const from = id === bookId ? own : parseBible(getBibleRaw(id));
    const next = edit(from);
    if (next !== from) saveBibleRaw(id, JSON.stringify(next));
  }

  /** Into the book being written, whichever scope is on screen — then its page. */
  function create(draft: Draft) {
    const id = crypto.randomUUID();
    saveBibleRaw(
      bookId,
      JSON.stringify([
        ...own,
        {
          id,
          kind: draft.kind,
          name: draft.name.trim(),
          aka: draft.aka
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          detail: draft.detail.trim(),
          at: Date.now(),
        },
      ]),
    );
    setDir("next");
    setStack((s) => [
      ...s.slice(0, -1),
      { type: "entry", entryId: id, bookId: null, from: s.at(-1)?.from },
    ]);
  }

  /** Removing takes every link pointing at the entry with it. */
  function remove(copy: Copy) {
    change(copy.book, (entries) => removeEntry(entries, copy.entry.id));
    pop();
  }

  function connect(book: SeriesBook | null, fromId: string, link: BibleLink) {
    change(book, (entries) => addLink(entries, fromId, link));
    pop();
  }

  // --- The pages ------------------------------------------------------------

  let pageView: React.ReactNode = null;
  if (page === "new") {
    pageView = <NewEntryPage onCancel={pop} onCreate={create} />;
  } else if (topRow && top && top.type !== "new") {
    const wanted = top.bookId ?? bookId;
    const copy =
      topRow.wrote.find((w) => (w.book?.id ?? bookId) === wanted) ?? copyFor(topRow);
    pageView =
      top.type === "connect" ? (
        <ConnectPage
          from={copy.entry}
          entries={entriesIn(copy.book)}
          onBack={pop}
          onConnect={(link) => connect(copy.book, copy.entry.id, link)}
        />
      ) : (
        <EntryPage
          copies={topRow.wrote}
          initialBookId={top.bookId}
          openBookId={bookId}
          entriesIn={entriesIn}
          mentions={here.find((r) => r.id === topRow.id)?.count ?? 0}
          backLabel={backLabel}
          focusId={top.focus}
          onBack={pop}
          onOpenEntry={(entryId, book, fromId) =>
            push({ type: "entry", entryId, bookId: book?.id ?? null, from: fromId })
          }
          onConnect={(c) =>
            push({
              type: "connect",
              entryId: c.entry.id,
              bookId: c.book?.id ?? null,
              from: "bible-add-connection",
            })
          }
          onChange={change}
          onDelete={remove}
        />
      );
  }

  const emptyText = wide
    ? "Add the people, places and things that will have to be the same three books from now."
    : "People, places, factions and events — written down once, and found again in every chapter that names them.";

  return (
    <section aria-label={PANEL_TITLES.bible} className="absolute inset-0 z-10 font-sans">
      {/* **Two layers, each its own scroller.** The gallery stays mounted and
          is only made invisible and inert while a page is open — `visibility`,
          not `display`, because a box that stops being laid out forgets how far
          it was scrolled. The page is a fresh layer that starts at its top.
          `oc-step-in-back` is added as the gallery comes back, which is what
          starts it again. */}
      <div
        inert={page !== "list"}
        className={`scroll-slim absolute inset-0 overflow-y-auto ${
          page === "list" ? (dir === "back" ? "oc-step-in-back" : "") : "invisible"
        }`}
      >
        <div className="@container mx-auto w-full max-w-6xl px-5 pt-7 pb-16 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6">
            <div className="min-w-0">
              {/* iOS's large title: the name of the place, set big once at the
                  top, rather than a label repeated in a bar. */}
              <h1 className="text-[28px] leading-tight font-bold tracking-tight text-fg">
                {PANEL_TITLES.bible}
              </h1>
              <p className="mt-1 truncate text-[13px] text-muted tabular-nums">
                {self?.title}
                {rows.length > 0 && ` · ${plural(rows.length, "entry", "entries")}`}
              </p>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              {rows.length > 0 && (
                <>
                  <Field
                    glyph={<SearchGlyph />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onClear={() => setQuery("")}
                    clearLabel="Clear the search"
                    placeholder="Search the bible"
                    aria-label="Search the bible"
                    className="min-w-0 flex-1 sm:w-72 sm:flex-none"
                  />
                  {/* Adding is the toolbar's "+", the way Contacts and Notes
                      place it: one action among the ones a writer takes here,
                      not the reason for the view. */}
                  <button
                    id="bible-add"
                    type="button"
                    onClick={() => open({ type: "new", from: "bible-add" })}
                    aria-label="Add to the bible"
                    title="Add to the bible"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent
                               text-accent-ink outline-none transition-colors hover:bg-accent-strong
                               focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </>
              )}
              {/* **The way back to the page is always drawn.** The rail's Bible
                  does the same thing, but a phone has no rail, and a view that
                  hides the manuscript must never be one you have to know how
                  to leave. A neutral disc, as a sheet's close is on iOS: it is
                  a way out, not a way forward, so it does not take the accent. */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to the page"
                title="Back to the page"
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised
                           text-muted outline-none transition-colors hover:text-fg
                           focus-visible:ring-2 focus-visible:ring-accent/60 sm:ml-0"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          {hasSeries && (
            <div className="mb-6 max-w-sm">
              {/* The fifth hand-rolled segmented control in the app, now the
                  shared one — an outlined track with a `raised` active segment
                  was a sixth answer to a question `ui/segmented.tsx` settles. */}
              <Segmented
                label="Which books to read"
                value={scope}
                onChange={(next) => {
                  // Rows are keyed differently in the two scopes, so a path
                  // through one means nothing in the other.
                  setScope(next);
                  setStack([]);
                }}
                options={[
                  { value: "book" as const, label: "This book" },
                  { value: "series" as const, label: "The series" },
                ]}
              />
              {wide && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {seriesName ?? "This series"} — {series.length} books on this
                  machine. Bibles are not synced, so a series read elsewhere is
                  whatever that machine holds.
                </p>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="pt-10">
              <EmptyState
                glyph={
                  <>
                    <path d="M3 5.6c3-1 6-.6 9 1.2v13c-3-1.8-6-2.2-9-1.2z" />
                    <path d="M21 5.6c-3-1-6-.6-9 1.2v13c3-1.8 6-2.2 9-1.2z" />
                  </>
                }
                title={wide ? "Nothing written down in these books yet" : "Your book's world"}
              >
                {emptyText}
              </EmptyState>
              <div className="flex justify-center">
                <button
                  id="bible-add-first"
                  type="button"
                  onClick={() => open({ type: "new", from: "bible-add-first" })}
                  className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-semibold
                             text-accent-ink outline-none transition-colors hover:bg-accent-strong
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Add the first entry
                </button>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <EmptyState title="Nothing matches">
              No entry is called or says “{query.trim()}”.
            </EmptyState>
          ) : (
            <>
              {/* First, and deliberately. This is the half a plain file cannot
                  do, and it is right even when the bible is out of date. It
                  steps aside while a search is typed, because a search is the
                  writer asking a different question. */}
              {!query.trim() && (
                <section className="mb-7">
                  <SectionHeader>In this chapter</SectionHeader>
                  {here.length === 0 ? (
                    <p className="px-1 text-[13px] text-muted">
                      None of them, by name at least.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {here.map((row) => {
                        const id = `bible-chip-${row.id}`;
                        const copy = copyFor(row);
                        return (
                          <li key={row.id}>
                            <button
                              id={id}
                              type="button"
                              onClick={() =>
                                open({
                                  type: "entry",
                                  entryId: copy.entry.id,
                                  bookId: copy.book?.id ?? null,
                                  from: id,
                                })
                              }
                              className="flex items-center gap-1.5 rounded-full border border-line bg-raised/40
                                         px-2.5 py-1 text-[12px] text-fg outline-none transition-colors
                                         hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60"
                            >
                              <KindDot kind={row.kind} />
                              {row.name}
                              <span className="text-muted tabular-nums">{row.count}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {borrowed > 0 && (
                    <ListFooter>
                      {borrowed} of {here.length} first written down in an earlier
                      book.
                    </ListFooter>
                  )}
                </section>
              )}

              {KINDS.map((k) => {
                const inKind = visible.filter((row) => row.kind === k.id);
                if (inKind.length === 0) return null;
                return (
                  <section key={k.id} className="mb-7">
                    <SectionHeader trailing={inKind.length}>{k.label}</SectionHeader>
                    {/* One column, two on a phone's width, three from 42rem and
                        four from 56rem — measured on this column rather than the
                        window, since the rail and a phone's chrome take their own
                        share of it. */}
                    <ul className="grid grid-cols-1 gap-3 @xs:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
                      {inKind.map((row) => {
                        const copy = copyFor(row);
                        const id = `bible-card-${row.id}`;
                        return (
                          <li key={row.id}>
                            <EntryCard
                              id={id}
                              kind={row.kind}
                              name={row.name}
                              aka={row.aka}
                              detail={copy.entry.detail}
                              connections={
                                connectionsOf(copy.entry, entriesIn(copy.book)).length
                              }
                              from={
                                wide && row.from && row.from.id !== bookId
                                  ? row.from.index === undefined
                                    ? row.from.title
                                    : `Book ${row.from.index}`
                                  : null
                              }
                              onOpen={() =>
                                open({
                                  type: "entry",
                                  entryId: copy.entry.id,
                                  bookId: copy.book?.id ?? null,
                                  from: id,
                                })
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>

      {pageView && (
        <div
          key={`${stack.length}:${page}:${top && top.type !== "new" ? top.entryId : "new"}`}
          className={`scroll-slim absolute inset-0 overflow-y-auto ${
            dir === "back" ? "oc-step-in-back" : "oc-step-in-next"
          }`}
        >
          {/* A column the full height of the layer, so a page's sticky footer
              sits at the bottom of a short page as well as a long one. */}
          <div className="flex min-h-full flex-col">{pageView}</div>
        </div>
      )}
    </section>
  );
}

/**
 * A page pushed over the gallery. `bookId` says which book's copy to show —
 * null for the open book. `from` is the element on the page below to give
 * focus back to when this one is closed; `focus` is that same id, handed down
 * to the page below as it is revealed again.
 */
type View =
  | {
      type: "entry";
      entryId: string;
      bookId: string | null;
      from?: string;
      focus?: string;
    }
  | {
      type: "connect";
      entryId: string;
      bookId: string | null;
      from?: string;
      focus?: string;
    }
  | { type: "new"; from?: string; focus?: string };

/**
 * One list shape for both scopes, so the view has one render path.
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
