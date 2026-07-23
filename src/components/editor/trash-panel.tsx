"use client";

import { useRouter } from "next/navigation";
import {
  deleteChapterForever,
  findBook,
  restoreChapter,
  trashedChapters,
} from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";
import { relativeTime } from "@/lib/relative-time";

/**
 * Deleted chapters for this book, and the way back.
 *
 * Deletion is recoverable: a deleted chapter keeps its prose and sits here until
 * the writer restores it or clears it for good. A tab of its own — always in the
 * rail — so it is somewhere a writer knows to look, not a section that only
 * appears once something is gone.
 */
export function TrashPanel({ bookId }: { bookId: string }) {
  const router = useRouter();
  const book = findBook(useShelf(), bookId);
  const trash = book ? trashedChapters(book) : [];

  const restore = (chapterId: string) => {
    restoreChapter(bookId, chapterId);
    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  const deleteForever = (chapter: { id: string; title: string }) => {
    if (
      !window.confirm(
        `Permanently delete “${chapter.title}”? This cannot be undone.`,
      )
    )
      return;
    deleteChapterForever(bookId, chapter.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-line px-4">
        <span className="font-sans text-xs tracking-wide text-muted uppercase">
          Deleted chapters
        </span>
      </div>

      {trash.length === 0 ? (
        <div className="p-4">
          <p className="font-sans text-sm text-muted">Nothing deleted.</p>
          <p className="mt-2 font-sans text-xs text-muted">
            A chapter you delete from the manuscript is kept here, so you can
            bring it back.
          </p>
        </div>
      ) : (
        <ul className="scroll-slim flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {trash.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1.5 rounded-md py-1.5 pr-1 pl-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-sm text-fg">
                  {item.title}
                </span>
                <span className="mt-0.5 block font-sans text-xs text-muted">
                  deleted {relativeTime(item.trashedAt)}
                  {item.words > 0
                    ? ` · ${item.words.toLocaleString()} words`
                    : ""}
                </span>
              </span>

              <button
                type="button"
                onClick={() => restore(item.id)}
                aria-label={`Restore ${item.title}`}
                title="Restore"
                className="shrink-0 rounded-md p-1.5 text-muted outline-none
                           transition-colors hover:bg-raised hover:text-fg
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M3.4 9.6a6.6 6.6 0 1 1 1.9 4.6" />
                  <path d="M3.2 5.4v4.2h4.2" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => deleteForever(item)}
                aria-label={`Delete ${item.title} forever`}
                title="Delete forever"
                className="shrink-0 rounded-md p-1.5 text-muted outline-none
                           transition-colors hover:bg-red-400/15 hover:text-red-400
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
