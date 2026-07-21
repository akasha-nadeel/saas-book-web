"use client";

import Link from "next/link";
import { bookmarks, toggleBookmark } from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";

/**
 * Every bookmarked chapter in the library, not just this book's.
 *
 * Scoped to one book it would only be the chapter list with rows missing. Across
 * the library it is somewhere to collect the threads you mean to come back to,
 * wherever they are.
 */
export function BookmarksPanel({ bookId }: { bookId: string }) {
  const marks = bookmarks(useShelf());

  if (marks.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <p className="font-sans text-sm text-muted">No bookmarks yet.</p>
        <p className="mt-2 font-sans text-xs text-muted">
          Star a chapter in the Chapters tab to keep it here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex h-full flex-col gap-0.5 overflow-y-auto p-2">
      {marks.map(({ book, chapter }) => (
        <li key={`${book.id}:${chapter.id}`} className="group relative">
          <Link
            href={`/book/${book.id}/chapter/${chapter.id}`}
            className="block rounded-md py-2 pr-8 pl-3 outline-none
                       transition-colors hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block truncate font-sans text-sm text-fg">
              {chapter.title}
            </span>
            {/* Which book it lives in — the point of a library-wide list. */}
            <span className="mt-0.5 block truncate font-sans text-xs text-muted">
              {book.id === bookId ? "This book" : book.title}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => toggleBookmark(book.id, chapter.id)}
            aria-label={`Remove bookmark from ${chapter.title}`}
            title="Remove bookmark"
            className="absolute top-2 right-1 rounded-sm px-1 py-0.5 text-sm
                       leading-none text-accent-strong outline-none
                       transition-colors hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            ★
          </button>
        </li>
      ))}
    </ol>
  );
}
