"use client";

import Link from "next/link";
import { bookmarks, toggleBookmark } from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";

/**
 * Every bookmarked chapter in the library, not just this book's.
 *
 * Scoped to one book it would only be the chapter list with rows missing. Across
 * the library it is somewhere to collect the threads you mean to come back to,
 * wherever they are.
 *
 * On the paid plan, where the pricing page has always said it is. The gate is
 * *here* rather than on the rail tab on purpose: the tab still opens, and what
 * it opens says why it is empty and where to go. A tab that silently vanishes
 * is a feature a writer has to guess at.
 *
 * The stars themselves are left alone — a bookmark already set stays set, and
 * setting one on the free plan costs nothing and breaks nothing. What Pro buys
 * is this list across the whole library.
 */
export function BookmarksPanel({ bookId }: { bookId: string }) {
  const marks = bookmarks(useShelf());
  const plan = usePlan();

  // `loading` is not "free": showing the upsell for half a second to somebody
  // who is paying is worse than a moment of nothing.
  if (plan.billing && !plan.pro && !plan.loading) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <p className="font-sans text-sm text-fg">Bookmarks are part of Pro.</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
          Every chapter you star, across every book, collected in one list.
          Stars you have already set are kept.
        </p>
        <Link
          href="/upgrade"
          className="mt-3 inline-block font-sans text-xs font-medium text-accent
                     underline underline-offset-2 outline-none
                     hover:text-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/50"
        >
          See what Pro adds
        </Link>
      </div>
    );
  }

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
    <ol className="scroll-slim flex h-full flex-col gap-0.5 overflow-y-auto p-2">
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
