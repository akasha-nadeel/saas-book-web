"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  bookWordCount,
  chaptersInPart,
  createChapter,
  deleteChapter,
  findBook,
  moveChapter,
  renameBook,
  setChapterPart,
  toggleBookmark,
  type ChapterMeta,
  type ChapterPart,
} from "@/lib/library-store";
import { useSaveState } from "@/lib/save-status";
import type { SaveStatus } from "@/lib/use-autosave";
import { useShelf } from "@/lib/use-library";

/**
 * The manuscript: front matter, body, back matter.
 *
 * A part is a field on the chapter, so this is three filtered views of one
 * ordered list rather than three lists. Dragging between sections therefore
 * moves a chapter *and* reassigns it, which is what the reference does too.
 */

const PARTS: { key: ChapterPart; label: string; empty: string }[] = [
  { key: "front", label: "Front matter", empty: "Copyright, dedication…" },
  { key: "body", label: "Body", empty: "Drag chapters here" },
  { key: "back", label: "Back matter", empty: "Acknowledgements, notes…" },
];

export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overPart, setOverPart] = useState<ChapterPart | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  if (!book) return null;

  const handleCreate = (part: ChapterPart) => {
    const id = createChapter(bookId);
    if (part !== "body") setChapterPart(bookId, id, part);
    router.push(`/book/${bookId}/chapter/${id}`);
  };

  const handleDelete = (chapter: ChapterMeta) => {
    // A chapter is somebody's prose. Cheap dialog, but never silently.
    if (!window.confirm(`Delete “${chapter.title}”? This cannot be undone.`))
      return;

    const remaining = book.chapters.filter((c) => c.id !== chapter.id);
    deleteChapter(bookId, chapter.id);

    // Only navigate if the writer just deleted the chapter they were reading.
    if (chapter.id === activeId) {
      router.replace(
        remaining.length
          ? `/book/${bookId}/chapter/${remaining[0].id}`
          : `/book/${bookId}`,
      );
    }
  };

  /** Drop onto a section: reassign, and move to that section's end. */
  const handleDropOn = (part: ChapterPart) => {
    if (!dragId) return;

    const chapter = book.chapters.find((c) => c.id === dragId);
    if (chapter && (chapter.part ?? "body") !== part) {
      setChapterPart(bookId, dragId, part);
    }
    setDragId(null);
    setOverPart(null);
  };

  return (
    <div className="flex h-full flex-col" aria-label="Manuscript">
      <div className="shrink-0 px-4 pt-3 pb-3">
        {/* The book's title, not the word "Manuscript". The bar that used to
            carry it is gone, and a book you cannot rename is worse than a
            panel without a label. */}
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
        {/* Full width and solid, matching New book on the shelf. Creating a
            chapter is this panel's primary action and now looks like one. */}
        <button
          type="button"
          onClick={() => handleCreate("body")}
          className="mt-3 w-full rounded-md bg-accent py-2.5 font-sans text-sm
                     font-semibold text-white outline-none transition-colors
                     hover:bg-accent-strong focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          New chapter
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {PARTS.map(({ key, label, empty }) => {
          const chapters = chaptersInPart(book, key);
          const isOpen = !collapsed[key];

          return (
            <section
              key={key}
              onDragOver={(e) => {
                // Without preventDefault the browser refuses the drop.
                e.preventDefault();
                setOverPart(key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOn(key);
              }}
              className={
                overPart === key && dragId ? "bg-accent-deep/25" : undefined
              }
            >
              <div className="flex items-center justify-between gap-2 bg-raised/40 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  aria-expanded={isOpen}
                  className="flex items-center gap-2 rounded-sm font-sans
                             text-sm font-semibold text-fg outline-none
                             hover:text-accent-strong focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  <span
                    aria-hidden="true"
                    className={`text-[0.6rem] transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    ▶
                  </span>
                  {label}
                </button>

                <button
                  type="button"
                  onClick={() => handleCreate(key)}
                  aria-label={`Add to ${label}`}
                  title={`Add to ${label}`}
                  className="rounded-sm px-1 font-sans text-sm text-muted
                             outline-none hover:text-fg focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  add
                </button>
              </div>

              {isOpen && chapters.length === 0 && (
                <p className="px-4 py-3 font-sans text-sm text-muted italic">
                  {empty}
                </p>
              )}

              {isOpen && chapters.length > 0 && (
                <ol>
                  {chapters.map((chapter) => {
                    const isActive = chapter.id === activeId;
                    // Numbering runs within the part, as it does in a book.
                    const index = book.chapters.indexOf(chapter);

                    return (
                      <li
                        key={chapter.id}
                        draggable
                        onDragStart={() => setDragId(chapter.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverPart(null);
                        }}
                        className={`group relative ${
                          dragId === chapter.id ? "opacity-40" : ""
                        }`}
                      >
                        <Link
                          href={`/book/${bookId}/chapter/${chapter.id}`}
                          aria-current={isActive ? "page" : undefined}
                          // Native drag is mouse-only, so reordering also needs
                          // a keyboard path or it is unreachable for some.
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
                          className={`flex items-center gap-2.5 border-l-4 py-3
                                      pr-16 pl-3 font-sans text-sm outline-none
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
                          <span className="flex-1 truncate">
                            {chapter.title}
                          </span>
                          {chapter.words > 0 && (
                            <span className="shrink-0 text-xs tabular-nums opacity-50">
                              {chapter.words.toLocaleString()}
                            </span>
                          )}
                        </Link>

                        {/* A marked chapter keeps its star; an unmarked one
                            shows it on hover, so rows stay quiet until wanted. */}
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
                                      focus-visible:opacity-100
                                      focus-visible:ring-2
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
                                     leading-none text-muted opacity-0
                                     outline-none transition-opacity
                                     group-hover:opacity-60 hover:!opacity-100
                                     hover:text-red-400 focus-visible:opacity-100
                                     focus-visible:ring-2
                                     focus-visible:ring-accent/60"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      {/* The reference closes the panel with a running total and its wordmark;
          both belong to the manuscript rather than to any one chapter. */}
      <div className="shrink-0 border-t border-line">
        <div className="flex items-baseline justify-between gap-2 px-4 py-3 font-sans text-sm text-muted">
          <span>{bookWordCount(book).toLocaleString()} words</span>
          <SaveIndicator />
        </div>
        <p className="border-t border-line px-4 py-3 font-display text-base font-medium text-fg">
          OpenChapter
        </p>
      </div>
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
