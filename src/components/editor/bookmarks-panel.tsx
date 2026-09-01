"use client";

import Link from "next/link";
import { bookmarks, toggleBookmark } from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Every bookmarked chapter in the library, not just this book's.
 *
 * Scoped to one book it would only be the chapter list with rows missing. Across
 * the library it is somewhere to collect the threads you mean to come back to,
 * wherever they are.
 *
 * **Free, and it used to be Pro.** It was the weakest paid row the app had:
 * a filtered view of stars the writer had already set, computed entirely in the
 * browser, so the gate was a client-side check on a list that was sitting in
 * `localStorage` a devtools panel away. A paid feature whose gate is visibly
 * decorative teaches a reader that the rest of them are too — which is an
 * expensive thing to teach on the one screen where trust is the product.
 *
 * It earns more as a free feature than it ever did as a paid one: it is a
 * reason to keep several books in here, and the paid rows are now things that
 * either cost money to run or only matter once a book is selling.
 */
export function BookmarksPanel({ bookId }: { bookId: string }) {
  const marks = bookmarks(useShelf());

  if (marks.length === 0) {
    return (
      <div className="scroll-slim flex h-full flex-col overflow-y-auto p-4">
        {/* **Where the star actually is.** This said "the Chapters tab" — a
            tab neither screen offers any more, because the book panel beside
            the manuscript became the chapter list and the rail stopped drawing
            a second one. An empty state that sends a writer to a control that
            is not there is worse than one that says nothing. */}
        <EmptyState
          glyph={<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />}
          title="No bookmarks yet"
        >
          Open Body matter beside the manuscript and use a chapter&rsquo;s ⋯
          menu to star it. Starred chapters are kept here, across every book.
        </EmptyState>
      </div>
    );
  }

  return (
    <ol className="scroll-slim flex h-full flex-col gap-0.5 overflow-y-auto p-2">
      {marks.map(({ book, chapter }) => (
        <li key={`${book.id}:${chapter.id}`} className="group relative">
          <Link
            href={`/book/${book.id}/chapter/${chapter.id}`}
            className="block rounded-md py-2 pr-8 pl-3 outline-none
                       transition-colors hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="block truncate font-sans text-[13px] text-fg">
              {chapter.title}
            </span>
            {/* Which book it lives in — the point of a library-wide list. */}
            <span className="mt-0.5 block truncate font-sans text-[11px] text-muted">
              {book.id === bookId ? "This book" : book.title}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => toggleBookmark(book.id, chapter.id)}
            aria-label={`Remove bookmark from ${chapter.title}`}
            title="Remove bookmark"
            /* A control with a target rather than a glyph at an inset: it was
               a 1.5×0.5 padding box around a text star, which on a touch screen
               is a press most people miss. Same size as the row actions
               everywhere else in the pass. */
            className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center
                       justify-center rounded-[7px] text-accent-strong
                       outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
          </button>
        </li>
      ))}
    </ol>
  );
}
