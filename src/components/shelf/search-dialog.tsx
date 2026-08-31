"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DialogClose, Shell } from "@/components/ui/dialog";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import { BookThumb } from "@/components/shelf/book-thumb";
import { hasResults, recentBooks, searchShelf } from "@/lib/shelf-search";
import { plural } from "@/lib/plural";
import type { Book } from "@/lib/library-store";

/**
 * Finding a book or a chapter by name.
 *
 * **It replaces the search box that used to sit in the dashboard's top bar**,
 * and it can do a thing that box could not: reach a *chapter*. The box filtered
 * one list of books in place, so a writer who knew the chapter's name but not
 * which book it was in had nowhere to type it.
 *
 * **Names only — the prose is not searched here.** Titles live in the shelf
 * index, which is held in memory, so every keystroke is answered without
 * touching the disk. Searching the writing means loading every chapter body out
 * of IndexedDB; `search.ts` does that for one book at a time inside the editor,
 * which is the right place for it.
 *
 * The list is keyboard-first: the field takes focus on open, the arrows move
 * through results, Return opens the highlighted one. Escape and the focus trap
 * are the native `<dialog>`'s, through `Shell`.
 */

/** One row's worth of what a result is and where it goes. */
interface Row {
  key: string;
  title: string;
  /** The line under the title — a book's size, or a chapter's book. */
  note: string;
  /** Drawn at the head of the row: a cover for a book, a glyph for a chapter. */
  lead: React.ReactNode;
  go: () => void;
}

export function SearchDialog({
  books,
  onClose,
  onPickBook,
}: {
  books: readonly Book[];
  onClose: () => void;
  /**
   * What to do with a chosen book.
   *
   * The dashboard sends the writer to Write with the shelf filtered, which is
   * where a book was always opened from — so this keeps the path the old search
   * box had rather than inventing a second one.
   */
  onPickBook: (book: Book) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const results = useMemo(() => searchShelf(books, query), [books, query]);
  const recent = useMemo(() => recentBooks(books), [books]);

  /* Two shapes, one list of rows: the arrow keys and Return should not care
     whether they are moving through search results or through the recent
     books, and building the rows once here is what stops that becoming two
     nearly-identical keyboard handlers. */
  const groups: { heading: string; rows: Row[] }[] = useMemo(() => {
    const bookRow = (book: Book): Row => ({
      key: `book:${book.id}`,
      title: book.title,
      note: plural(book.chapters.length, "chapter"),
      lead: <BookThumb book={book} />,
      go: () => {
        onPickBook(book);
        onClose();
      },
    });

    if (!trimmed) {
      return recent.length
        ? [{ heading: "Recent books", rows: recent.map(bookRow) }]
        : [];
    }

    const out: { heading: string; rows: Row[] }[] = [];
    if (results.books.length) {
      out.push({ heading: "Books", rows: results.books.map(bookRow) });
    }
    if (results.chapters.length) {
      out.push({
        heading: "Chapters",
        rows: results.chapters.map(({ book, chapter }) => ({
          key: `chapter:${book.id}:${chapter.id}`,
          title: chapter.title,
          note: book.title,
          lead: (
            /* A chapter is not a book and should not wear a cover — the row
               already names the book it is in underneath. Boxed to the cover's
               width so both groups' titles line up. */
            <span className="flex w-8 shrink-0 justify-center text-tremor-content [&>svg]:h-5 [&>svg]:w-5">
              {shelfIcons.write}
            </span>
          ),
          go: () => {
            router.push(`/book/${book.id}/chapter/${chapter.id}`);
            onClose();
          },
        })),
      });
    }
    return out;
  }, [trimmed, recent, results, onPickBook, onClose, router]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (rows.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wraps, because a list this short is faster to come round than to
      // arrow back up through.
      setActive((i) => (i + step + rows.length) % rows.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      rows[active]?.go();
    }
  };

  /* Keep the highlighted row in view when the arrows walk past the fold. */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let index = -1;

  return (
    <Shell onClose={onClose} width="w-[40rem]" align="top">
      <DialogClose onClose={onClose} />

      <label className="flex items-center gap-3 pr-8">
        <span className="shrink-0 text-tremor-content [&>svg]:h-5 [&>svg]:w-5">
          {shelfIcons.search}
        </span>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            /* Back to the top whenever the list changes underneath. In the
               handler rather than an effect on `query`: typing *is* the event,
               and an effect that sets state on every keystroke is a second
               render for something already known here. Without it the
               highlight stays on row four while the results shrink to two,
               and Return opens nothing. */
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search books and chapters…"
          aria-label="Search books and chapters"
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base
                     text-tremor-content-strong outline-none
                     placeholder:text-tremor-content-subtle"
        />
      </label>

      <hr className="my-4 h-px border-0 bg-tremor-border" aria-hidden="true" />

      {/* Capped and scrolled here rather than left to grow: `oc-dialog-scroll`
          caps the whole dialog, and letting the results push the field off the
          top of the window is the one way this shape goes wrong. */}
      <div ref={listRef} className="max-h-[50vh] overflow-y-auto scroll-slim">
        {groups.length === 0 ? (
          /* Said plainly. A blank panel under a search field reads as broken
             rather than as empty. */
          <p className="py-6 text-center text-sm text-tremor-content">
            {trimmed
              ? `Nothing matching “${trimmed}”.`
              : "No books yet. Start one and it will show up here."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.heading} className="mb-4 last:mb-0">
              <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-tremor-content-subtle">
                {group.heading}
              </p>
              <div className="flex flex-col">
                {group.rows.map((row) => {
                  index += 1;
                  const isActive = index === active;
                  const at = index;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      data-active={isActive}
                      onMouseEnter={() => setActive(at)}
                      onClick={row.go}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left
                                  transition-colors ${
                                    isActive
                                      ? "bg-tremor-background-subtle"
                                      : "hover:bg-tremor-background-subtle/60"
                                  }`}
                    >
                      {row.lead}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-tremor-content-strong">
                          {row.title}
                        </span>
                        <span className="block truncate text-xs text-tremor-content">
                          {row.note}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Only once there is something to count, so an empty panel does not
          carry a "0 results" line under it. */}
      {trimmed && hasResults(results) && (
        <p className="mt-3 text-xs text-tremor-content-subtle">
          {plural(rows.length, "result")}. Use ↑ ↓ and Return.
        </p>
      )}
    </Shell>
  );
}
