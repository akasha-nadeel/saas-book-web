"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExportDialog } from "@/components/export/export-dialog";
import {
  bookWordCount,
  createBook,
  deleteBook,
  migrateLegacy,
  type Book,
} from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useHydrated, useShelf } from "@/lib/use-library";

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const router = useRouter();

  const [exporting, setExporting] = useState<Book | null>(null);
  const [query, setQuery] = useState("");

  // migrateLegacy is idempotent, but running it twice is still wasted work and
  // React runs effects twice in development.
  const migrated = useRef(false);
  useEffect(() => {
    if (!hydrated || migrated.current) return;
    migrated.current = true;
    migrateLegacy();
  }, [hydrated]);

  // Most recently opened first — the book you were writing yesterday is the
  // one you want today.
  const books = useMemo(
    () => [...shelf.books].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [shelf.books],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((b) => b.title.toLowerCase().includes(needle));
  }, [books, query]);

  const totalWords = useMemo(
    () => books.reduce((sum, b) => sum + bookWordCount(b), 0),
    [books],
  );

  const handleCreate = () => {
    const { bookId, chapterId } = createBook();
    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  const handleDelete = (book: Book) => {
    const words = bookWordCount(book);
    // The most destructive action in the app: this takes every chapter with it.
    const warning =
      words > 0
        ? `Delete “${book.title}” and all ${words.toLocaleString()} words in it? This cannot be undone.`
        : `Delete “${book.title}”? This cannot be undone.`;
    if (window.confirm(warning)) deleteBook(book.id);
  };

  if (!hydrated) return null;

  return (
    <div className="flex h-full">
      <ShelfNav
        bookCount={books.length}
        totalWords={totalWords}
        onCreate={handleCreate}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col rounded-lg bg-panel p-8">
          <div className="flex items-baseline justify-between gap-6">
            <h1 className="font-serif text-2xl text-fg">All books</h1>
            <p className="shrink-0 font-sans text-sm text-muted">
              {totalWords.toLocaleString()} words written
            </p>
          </div>

          <label className="relative mt-6 block">
            <span className="sr-only">Search books</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4
                         -translate-y-1/2 text-muted"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="m13.5 13.5 3 3" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in all books…"
              className="w-full rounded-md border border-line bg-surface py-2.5
                         pr-3 pl-10 font-sans text-sm text-fg
                         placeholder:text-muted focus-visible:border-accent
                         focus-visible:outline-none"
            />
          </label>

          {books.length === 0 ? (
            <Empty onCreate={handleCreate} />
          ) : visible.length === 0 ? (
            <p className="mt-10 font-sans text-sm text-muted">
              No book matches “{query.trim()}”.
            </p>
          ) : (
            <BookTable
              books={visible}
              // Only the genuinely most-recent book, not merely the first row
              // after a search has reordered what you can see.
              continueId={query.trim() ? null : (books[0]?.id ?? null)}
              onExport={setExporting}
              onDelete={handleDelete}
            />
          )}
        </div>
      </main>

      {exporting && (
        <ExportDialog book={exporting} onClose={() => setExporting(null)} />
      )}
    </div>
  );
}

function ShelfNav({
  bookCount,
  totalWords,
  onCreate,
}: {
  bookCount: number;
  totalWords: number;
  onCreate: () => void;
}) {
  return (
    <aside
      className="flex w-(--sidebar-width) shrink-0 flex-col border-r
                 border-line bg-surface px-4 py-6"
      aria-label="Library"
    >
      <div className="px-2">
        <p className="font-serif text-lg text-fg">OpenChapter</p>
        <p className="mt-1 font-sans text-xs text-muted">
          A place to write your novel
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-6 w-full rounded-full bg-accent py-2.5 font-sans text-sm
                   font-semibold text-white outline-none transition-colors
                   hover:bg-accent-strong focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        New book
      </button>

      <nav className="mt-6">
        {/* One item, because one is all that is real. Overleaf's Archived and
            Trashed correspond to features this app does not have, and a dead
            link is worse than a short list. */}
        <span
          aria-current="page"
          className="block rounded-md bg-accent-deep px-3 py-2 font-sans text-sm
                     text-white"
        >
          All books
        </span>
      </nav>

      <div className="mt-auto border-t border-line px-3 pt-4 font-sans text-xs text-muted">
        {bookCount} {bookCount === 1 ? "book" : "books"}
        {" · "}
        {totalWords.toLocaleString()} words
      </div>
    </aside>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 text-center">
      <p className="font-serif text-lg text-fg">Nothing on the shelf yet.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-full bg-accent px-4 py-2 font-sans text-sm
                   font-semibold text-white outline-none transition-colors
                   hover:bg-accent-strong focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        Start your first book
      </button>
    </div>
  );
}

function BookTable({
  books,
  continueId,
  onExport,
  onDelete,
}: {
  books: Book[];
  continueId: string | null;
  onExport: (book: Book) => void;
  onDelete: (book: Book) => void;
}) {
  return (
    <table className="mt-6 w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line font-sans text-xs tracking-wide text-muted uppercase">
          <th scope="col" className="py-3 pr-4 font-medium">
            Title
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Chapters
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Words
          </th>
          <th scope="col" className="py-3 pr-4 font-medium">
            Last opened
          </th>
          <th scope="col" className="py-3 text-right font-medium">
            Actions
          </th>
        </tr>
      </thead>

      <tbody>
        {books.map((book) => (
          <tr
            key={book.id}
            className="group border-b border-line/60 transition-colors
                       last:border-0 hover:bg-raised/60"
          >
            <td className="py-3.5 pr-4">
              <Link
                href={`/book/${book.id}`}
                className="rounded-sm font-sans text-sm text-fg outline-none
                           hover:text-accent focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                {book.title}
              </Link>
              {book.id === continueId && (
                <span className="ml-3 rounded-full bg-accent-deep px-2 py-0.5 font-sans text-[0.65rem] tracking-wide text-white uppercase">
                  Continue
                </span>
              )}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm tabular-nums text-muted">
              {book.chapters.length}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm tabular-nums text-muted">
              {bookWordCount(book).toLocaleString()}
            </td>

            <td className="py-3.5 pr-4 font-sans text-sm text-muted">
              {relativeTime(book.lastOpenedAt)}
            </td>

            <td className="py-3.5">
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onExport(book)}
                  aria-label={`Export ${book.title}`}
                  title="Export"
                  className="rounded-md p-1.5 text-muted outline-none
                             transition-colors hover:bg-raised hover:text-accent
                             focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" />
                    <path d="M4 14v2.5h12V14" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(book)}
                  aria-label={`Delete ${book.title}`}
                  title="Delete"
                  className="rounded-md p-1.5 text-muted opacity-0
                             outline-none transition-all hover:bg-raised
                             hover:text-red-400 group-hover:opacity-100
                             focus-visible:opacity-100 focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.5 9.5h6l.5-9.5" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
