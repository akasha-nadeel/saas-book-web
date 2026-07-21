"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  bookWordCount,
  createChapter,
  deleteChapter,
  findBook,
  moveChapter,
  renameBook,
  toggleBookmark,
  type ChapterMeta,
} from "@/lib/library-store";
import { useSaveState } from "@/lib/save-status";
import type { SaveStatus } from "@/lib/use-autosave";
import { useShelf } from "@/lib/use-library";

/**
 * The manuscript: one ordered list of chapters.
 *
 * Deliberately flat. Sections were tried here and cost more than they returned
 * — a level to step into and back out of, a second place a new chapter could
 * land, and numbering that had to be explained. A novel is a sequence, and the
 * panel is at its most useful when it just shows the sequence.
 */
export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  if (!book) return null;

  const handleCreate = () => {
    const id = createChapter(bookId);
    router.push(`/book/${bookId}/chapter/${id}`);
  };

  const handleDelete = (chapter: ChapterMeta) => {
    // A chapter is somebody's prose. Cheap dialog, but never silently.
    if (!window.confirm(`Delete “${chapter.title}”? This cannot be undone.`))
      return;

    // The one that takes its place, or the one before it if this was the last.
    // Landing on the book's first chapter every time loses the writer's place.
    const index = book.chapters.findIndex((c) => c.id === chapter.id);
    const remaining = book.chapters.filter((c) => c.id !== chapter.id);
    const target = remaining[index] ?? remaining[index - 1] ?? null;

    deleteChapter(bookId, chapter.id);

    // Only navigate if the writer just deleted the chapter they were reading.
    if (chapter.id === activeId) {
      router.replace(
        target ? `/book/${bookId}/chapter/${target.id}` : `/book/${bookId}`,
      );
    }
  };

  /** Drop one chapter onto another: the dragged one takes that position. */
  const handleDropOn = (targetId: string) => {
    const from = book.chapters.findIndex((c) => c.id === dragId);
    const to = book.chapters.findIndex((c) => c.id === targetId);
    if (from >= 0 && to >= 0) moveChapter(bookId, from, to);

    setDragId(null);
    setOverId(null);
  };

  const written = bookWordCount(book);

  return (
    <div className="flex h-full flex-col" aria-label="Manuscript">
      <div className="shrink-0 px-4 pt-3 pb-3">
        {/* The book's title, not the word "Manuscript". A book you cannot
            rename is worse than a panel without a label. */}
        <input
          value={book.title}
          onChange={(e) => renameBook(bookId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) renameBook(bookId, "Untitled Book");
          }}
          aria-label="Book title"
          spellCheck={false}
          className="w-full truncate rounded-sm bg-transparent font-sans
                     text-lg font-semibold text-fg outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="mt-3 w-full rounded-md bg-accent py-2.5 font-sans text-sm
                     font-semibold text-white outline-none transition-colors
                     hover:bg-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          New chapter
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {book.chapters.length === 0 ? (
          <p className="px-4 py-6 text-center font-sans text-sm text-muted italic">
            No chapters yet
          </p>
        ) : (
          <ol>
            {book.chapters.map((chapter, index) => {
              const isActive = chapter.id === activeId;

              return (
                <li
                  key={chapter.id}
                  draggable
                  onDragStart={() => setDragId(chapter.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragOver={(e) => {
                    // Without preventDefault the browser refuses the drop.
                    e.preventDefault();
                    if (dragId && dragId !== chapter.id) setOverId(chapter.id);
                  }}
                  onDragLeave={() => setOverId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOn(chapter.id);
                  }}
                  className={`group relative ${
                    dragId === chapter.id ? "opacity-40" : ""
                  } ${overId === chapter.id ? "bg-accent-deep/40" : ""}`}
                >
                  <Link
                    href={`/book/${bookId}/chapter/${chapter.id}`}
                    aria-current={isActive ? "page" : undefined}
                    // Native drag is mouse-only, so reordering also needs a
                    // keyboard path or it is unreachable for some.
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    onKeyDown={(e) => {
                      if (!e.altKey) return;
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        moveChapter(bookId, index, index - 1);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        moveChapter(bookId, index, index + 1);
                      }
                    }}
                    className={`flex items-center gap-2.5 border-l-4 py-3 pr-16
                                pl-3 font-sans text-sm outline-none
                                transition-colors focus-visible:ring-inset
                                focus-visible:ring-2
                                focus-visible:ring-accent/60 ${
                                  isActive
                                    ? "border-accent bg-accent-deep font-medium text-white"
                                    : "border-transparent text-muted hover:bg-raised hover:text-fg"
                                }`}
                  >
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-60">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate">{chapter.title}</span>
                    {chapter.words > 0 && (
                      <span className="shrink-0 text-xs tabular-nums opacity-50">
                        {chapter.words.toLocaleString()}
                      </span>
                    )}
                  </Link>

                  {/* A marked chapter keeps its star; an unmarked one shows it
                      on hover, so rows stay quiet until wanted. */}
                  <button
                    type="button"
                    onClick={() => toggleBookmark(bookId, chapter.id)}
                    aria-label={
                      chapter.bookmarked
                        ? `Remove bookmark from ${chapter.title}`
                        : `Bookmark ${chapter.title}`
                    }
                    aria-pressed={Boolean(chapter.bookmarked)}
                    title="Bookmark"
                    className={`absolute top-1/2 right-9 -translate-y-1/2
                                rounded-sm px-1 py-0.5 text-sm leading-none
                                outline-none transition-opacity
                                focus-visible:opacity-100 focus-visible:ring-2
                                focus-visible:ring-accent/60 ${
                                  chapter.bookmarked
                                    ? "text-accent-strong opacity-100"
                                    : "text-muted opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-fg"
                                }`}
                  >
                    {chapter.bookmarked ? "★" : "☆"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(chapter)}
                    aria-label={`Delete ${chapter.title}`}
                    className="absolute top-1/2 right-3 -translate-y-1/2
                               rounded-sm px-1.5 py-0.5 font-sans text-sm
                               leading-none text-muted opacity-0 outline-none
                               transition-opacity group-hover:opacity-60
                               hover:!opacity-100 hover:text-red-400
                               focus-visible:opacity-100 focus-visible:ring-2
                               focus-visible:ring-accent/60"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* The reference closes the panel with a running total and its wordmark;
          both belong to the manuscript rather than to any one chapter. */}
      <div className="shrink-0 border-t border-line">
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-2 font-sans text-sm text-muted">
            <span>
              {written.toLocaleString()}
              {book.targetWords
                ? ` of ${book.targetWords.toLocaleString()}`
                : ""}{" "}
              words
            </span>
            <SaveIndicator />
          </div>
          {book.targetWords ? (
            <Progress written={written} target={book.targetWords} />
          ) : null}
        </div>
        <p className="border-t border-line px-4 py-3 font-display text-base font-medium text-fg">
          OpenChapter
        </p>
      </div>
    </div>
  );
}

/**
 * Progress toward the target set when the book was created.
 *
 * The bar fills to 100% and stops, but the count above it keeps climbing —
 * passing your target is not an error, and a bar that overflowed its track or
 * a number that froze would both read as one.
 */
function Progress({ written, target }: { written: number; target: number }) {
  const pct = Math.min(100, Math.round((written / target) * 100));

  return (
    <div className="mt-2">
      <div
        role="progressbar"
        aria-valuenow={written}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label="Words written toward your target"
        className="h-1 w-full overflow-hidden rounded-full bg-raised"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-sans text-xs tabular-nums text-muted">
        {pct}%{written >= target ? " · target reached" : ""}
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved",
  saving: "Saving…",
  error: "Save failed",
};

/**
 * Reads from the save store rather than a prop: the editor that knows the
 * status is a cousin of this panel, not a parent.
 *
 * `aria-live="polite"` so a screen reader hears a failed save without having to
 * go looking for it — silent data loss is the one thing this indicator exists
 * to prevent.
 */
function SaveIndicator() {
  const { status, lastSavedAt } = useSaveState();

  return (
    <span
      aria-live="polite"
      className={status === "error" ? "text-accent" : undefined}
    >
      {STATUS_LABEL[status]}
      {status === "saved" && lastSavedAt
        ? ` · ${lastSavedAt.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`
        : null}
    </span>
  );
}
