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
import { useHydrated, useShelf } from "@/lib/use-library";

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const router = useRouter();

  // migrateLegacy is idempotent, but running it twice is still wasted work and
  // React runs effects twice in development.
  const [exporting, setExporting] = useState<Book | null>(null);

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
    <main className="h-full overflow-y-auto px-6 py-20">
      <div className="mx-auto w-full max-w-(--measure-manuscript)">
        <h1 className="font-serif text-3xl text-ink">Your books</h1>

        {books.length === 0 ? (
          <p className="mt-6 font-sans text-sm text-warmgray">
            Nothing on the shelf yet.
          </p>
        ) : (
          <ol className="mt-12">
            {books.map((book, index) => (
              <li key={book.id} className="group relative">
                <Link
                  href={`/book/${book.id}`}
                  className="flex items-baseline gap-4 rounded-sm border-b
                             border-ink/8 py-4 pr-10 outline-none
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  <span
                    className="flex-1 truncate font-serif text-lg text-ink
                               group-hover:text-burgundy"
                  >
                    {book.title}
                  </span>
                  <span className="shrink-0 font-sans text-xs tabular-nums text-warmgray">
                    {book.chapters.length}{" "}
                    {book.chapters.length === 1 ? "chapter" : "chapters"}
                    {" · "}
                    {bookWordCount(book).toLocaleString()} words
                  </span>
                </Link>

                {index === 0 && (
                  <span
                    className="pointer-events-none absolute -top-5 left-0
                               font-sans text-xs tracking-[0.18em] text-gold
                               uppercase"
                  >
                    Continue writing
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setExporting(book)}
                  aria-label={`Export ${book.title}`}
                  className="absolute top-4 right-7 rounded-sm px-1.5 py-0.5
                             font-sans text-xs leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(book)}
                  aria-label={`Delete ${book.title}`}
                  className="absolute top-4 right-0 rounded-sm px-1.5 py-0.5
                             font-sans text-sm leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={handleCreate}
          className="mt-8 rounded-sm font-sans text-sm text-warmgray outline-none
                     hover:text-burgundy focus-visible:ring-2
                     focus-visible:ring-gold/60"
        >
          + New book
        </button>

        {exporting && (
          <ExportDialog book={exporting} onClose={() => setExporting(null)} />
        )}
      </div>
    </main>
  );
}
