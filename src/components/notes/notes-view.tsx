"use client";

import { useMemo, useState } from "react";
import { chapterMatterOf, type ChapterMeta } from "@/lib/library-store";
import { PANEL_TITLES } from "@/lib/panel-tabs";
import { plural } from "@/lib/plural";
import { useEveryNote, useShelf } from "@/lib/use-library";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchGlyph } from "@/components/ui/field";
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { hasNote, NoteFields, notePreview } from "./note-fields";

/**
 * A book's notes, laid over the page in the editor's own area.
 *
 * **It was a 23.5rem column holding two textareas**, and it could only ever
 * show the chapter the writer was standing in. That is the wrong half of the
 * job: a note is written in chapter four *for* chapter nineteen, and the only
 * way to read it back was to navigate to chapter four and open the panel. This
 * screen is the first one that answers "what did I leave myself, anywhere in
 * this book".
 *
 * **Over the page, not beside it** (2026-10-01, the owner's choice), which
 * makes it the second screen of a book that hides its page — the story bible
 * was the first, and CLAUDE.md records why that is not the old Book View
 * coming back. The same two reasons hold here: the page is **hidden and inert,
 * never unmounted**, so the Tiptap instance, the caret, the undo history and
 * the pagination are exactly where they were when the rail's Notes, or the
 * close here, puts it back; and the rail lights the tab, with a second press
 * closing it.
 *
 * **The shape is Apple Notes' and the list is the point.** Chapters down the
 * left with the first line of each note under the title, the selected
 * chapter's Synopsis and Notes on the right. A row shows what is there without
 * being opened, which is what turns a drawer of two fields into something a
 * writer can read across.
 *
 * **Selecting a row does not navigate.** The manuscript underneath stays on
 * the chapter the writer was writing; this screen is for reading and jotting
 * across the book, and sending somebody to chapter nineteen because they
 * glanced at its note would lose their place. The row they *are* on says so.
 */
export function NotesView({
  bookId,
  chapterId,
  onClose,
}: {
  bookId: string;
  /** The chapter open on the page underneath. Where this screen opens. */
  chapterId: string;
  /** Back to the page. The rail's Notes does the same; this is the one always drawn. */
  onClose: () => void;
}) {
  const shelf = useShelf();
  const book = shelf.books.find((b) => b.id === bookId) ?? null;
  const chapters = useMemo(() => book?.chapters ?? [], [book]);

  /* One subscription for the whole book rather than one per row — see
     `useEveryNote` for why a list this long cannot have a hook each. */
  const ids = useMemo(() => chapters.map((c) => c.id), [chapters]);
  const notes = useEveryNote(ids);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(chapterId);
  /* Which of the two the narrow layout is showing. Ignored from `md` up, where
     both are on screen at once. It opens on the note, because the writer
     pressed Notes from a chapter and that chapter's note is what they meant. */
  const [showing, setShowing] = useState<"list" | "note">("note");

  /* A chapter can be deleted from another tab while this is open, so the
     selection is checked against the book rather than trusted. */
  const selected =
    chapters.find((c) => c.id === picked)?.id ?? chapters[0]?.id ?? null;

  const written = chapters.filter((c) => hasNote(notes[c.id] ?? "")).length;

  const term = query.trim().toLowerCase();
  const matches = (c: ChapterMeta) =>
    !term ||
    c.title.toLowerCase().includes(term) ||
    (notes[c.id] ?? "").toLowerCase().includes(term);

  const partOf = (part: "front" | "body" | "back") =>
    chapters.filter((c) => chapterMatterOf(c) === part && matches(c));

  const groups = [
    { key: "front", title: "Front matter", rows: partOf("front") },
    { key: "body", title: "Chapters", rows: partOf("body") },
    { key: "back", title: "Back matter", rows: partOf("back") },
  ].filter((group) => group.rows.length > 0);

  const choose = (id: string) => {
    setPicked(id);
    setShowing("note");
  };

  return (
    <section
      aria-label={PANEL_TITLES.notes}
      className="absolute inset-0 z-10 flex flex-col font-sans"
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-5 pt-7 pb-6 sm:px-8">
        <header className="flex shrink-0 items-start justify-between gap-6 pb-5">
          <div className="min-w-0">
            {/* iOS's large title: the name of the place, set big once at the
                top, rather than a label repeated in a bar. */}
            <h1 className="text-[28px] leading-tight font-bold tracking-tight text-fg">
              {PANEL_TITLES.notes}
            </h1>
            <p className="mt-1 truncate text-[13px] text-muted tabular-nums">
              {book?.title}
              {written > 0 && ` · ${plural(written, "chapter")} with notes`}
            </p>
          </div>

          {/* **The way back to the page is always drawn.** The rail's Notes
              does the same thing, but a phone has no rail, and a view that
              hides the manuscript must never be one you have to know how to
              leave. A neutral disc, as a sheet's close is on iOS: it is a way
              out, not a way forward, so it does not take the accent. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the page"
            title="Back to the page"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised
                       text-muted outline-none transition-colors hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
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
        </header>

        <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-8">
          {/* The list, with its own scroller: a forty-chapter book must not
              take the fields down the page with it. */}
          <aside
            className={`min-h-0 flex-col gap-3 ${
              showing === "list" ? "flex" : "hidden"
            } md:flex`}
          >
            {chapters.length > 1 && (
              <Field
                glyph={<SearchGlyph />}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                clearLabel="Clear the search"
                placeholder="Search notes"
                aria-label="Search notes"
                className="shrink-0"
              />
            )}

            <div className="scroll-slim -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
              {groups.length === 0 ? (
                <EmptyState
                  glyph={
                    <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
                  }
                  title="Nothing matches"
                >
                  No chapter title or note has those words in it.
                </EmptyState>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className="mb-4 last:mb-0">
                    <SectionHeader trailing={group.rows.length}>
                      {group.title}
                    </SectionHeader>
                    <ListGroup as="ul">
                      {group.rows.map((chapter) => {
                        const preview = notePreview(notes[chapter.id] ?? "");
                        return (
                          <li key={chapter.id}>
                            <ListRow
                              active={chapter.id === selected}
                              onClick={() => choose(chapter.id)}
                              /* A dot for "there is something here", and an
                                 empty one of the same size where there is not:
                                 the slot has to hold its width, or every title
                                 in the list shifts as notes are written. */
                              leading={
                                <span
                                  aria-hidden="true"
                                  className={`block h-1.5 w-1.5 rounded-full ${
                                    preview ? "bg-accent" : "bg-transparent"
                                  }`}
                                />
                              }
                              title={chapter.title}
                              detail={preview || "No notes yet"}
                              /* Where the writer actually is. The row selects
                                 like any other; this only says which chapter the
                                 page behind this screen is on. */
                              trailing={
                                chapter.id === chapterId ? (
                                  <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                                    On the page
                                  </span>
                                ) : undefined
                              }
                            />
                          </li>
                        );
                      })}
                    </ListGroup>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div
            className={`min-h-0 flex-col ${
              showing === "note" ? "flex" : "hidden"
            } md:flex`}
          >
            {selected ? (
              <>
                <div className="mb-3 flex shrink-0 items-center gap-2">
                  {/* Only where the list is not on screen beside it. */}
                  <button
                    type="button"
                    onClick={() => setShowing("list")}
                    className="-ml-1 flex items-center gap-1 rounded-md px-1 py-1 text-[13px]
                               text-accent outline-none transition-colors hover:text-fg
                               focus-visible:ring-2 focus-visible:ring-accent/60 md:hidden"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M15 5l-7 7 7 7" />
                    </svg>
                    All chapters
                  </button>

                  <h2 className="min-w-0 truncate text-[15px] font-semibold text-fg">
                    {chapters.find((chapter) => chapter.id === selected)?.title}
                  </h2>
                </div>

                {/* Keyed on the chapter, which is what makes moving between
                    rows safe: the fields unmount, and their unmount is what
                    writes the half-second of typing the debounce is still
                    holding. See `NoteFields`. */}
                <div className="min-h-0 flex-1">
                  <NoteFields key={selected} chapterId={selected} />
                </div>
              </>
            ) : (
              <EmptyState
                glyph={
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6" />
                }
                title="No chapters yet"
              >
                Notes are kept against a chapter, so the book needs one first.
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
