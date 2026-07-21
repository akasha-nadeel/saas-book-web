"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  bookWordCount,
  chaptersInPart,
  createChapter,
  deleteChapter,
  findBook,
  addPart,
  moveChapter,
  isBuiltinPart,
  partsOf,
  removePart,
  renameBook,
  setChapterPart,
  toggleBookmark,
  type Book,
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
 * ordered list rather than three lists.
 *
 * The three are steps rather than accordions. Expanding all of them at once
 * gave a list with three headers scattered through it and no way to see one
 * section's shape without the others in the way; stepping into one shows that
 * section and nothing else. The cost is that the other two sections are no
 * longer on screen to drag onto, so they reappear as drop targets while a
 * chapter is being dragged — the only moment they are wanted.
 */

/**
 * What each built-in section is for, shown when it is empty. Sections a writer
 * adds get the generic line — we know what a book's front matter holds, but not
 * what they meant by "Interludes".
 */
const PART_HINTS: Record<string, string> = {
  front: "Copyright, dedication…",
  body: "Drag chapters here",
  back: "Acknowledgements, notes…",
};

const EMPTY_HINT = "No chapters here yet";

export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overPart, setOverPart] = useState<ChapterPart | null>(null);
  // A blank string means the new-section row is open and still empty, which is
  // different from null: null is "not naming anything".
  const [naming, setNaming] = useState<string | null>(null);
  // Enter, Escape and blur can all fire for a single naming session: committing
  // unmounts the row, and a browser that then fires blur would run the handler
  // again with the name still in its closure and add the section twice. First
  // one through wins.
  const namingSettled = useRef(false);

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  const activeChapter = book?.chapters.find((c) => c.id === activeId) ?? null;
  const activePart: ChapterPart | null = activeChapter
    ? (activeChapter.part ?? "body")
    : null;

  // null means the section list. Opens inside whichever section holds the open
  // chapter, and follows the route when it moves to another one — arriving from
  // a bookmark or the editor's next-chapter arrow must not leave the panel
  // showing a list that does not contain the chapter on screen.
  //
  // Adjusting state during render is React's documented answer to this. An
  // effect would paint the wrong section first and then correct it, and the
  // set-state-in-effect rule rejects it besides.
  const [browsing, setBrowsing] = useState<ChapterPart | null>(activePart);
  const [followed, setFollowed] = useState<ChapterPart | null>(activePart);
  if (activePart !== followed) {
    setFollowed(activePart);
    if (activePart) setBrowsing(activePart);
  }

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

  const parts = partsOf(book);
  const current = browsing ? parts.find((p) => p.id === browsing) : null;

  // A section deleted in another tab leaves this one pointing at nothing. Fall
  // back to the list rather than rendering a header with no name in it.
  if (browsing !== null && !current) {
    setBrowsing(null);
  }

  const startNaming = () => {
    namingSettled.current = false;
    setNaming("");
  };

  const cancelNaming = () => {
    namingSettled.current = true;
    setNaming(null);
  };

  const handleAddPart = () => {
    if (namingSettled.current) return;
    namingSettled.current = true;

    const id = addPart(bookId, naming ?? "");
    setNaming(null);
    // Step into what was just made: naming a section and then having to find it
    // in the list is a click nobody needs.
    if (id) setBrowsing(id);
  };

  const handleRemovePart = (partId: ChapterPart, label: string) => {
    const held = chaptersInPart(book, partId).length;
    const warning = held
      ? `Delete “${label}”? Its ${held} ${held === 1 ? "chapter moves" : "chapters move"} to Body.`
      : `Delete “${label}”?`;
    if (!window.confirm(warning)) return;

    removePart(bookId, partId);
    setBrowsing(null);
  };

  const written = bookWordCount(book);

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
        {/* Only from the list. Adding a chapter belongs to the section it goes
            into, so that button lives in the section's own header rather than
            up here where it would be a second full-width claim on attention. */}
        {!current && (
          <button
            type="button"
            onClick={startNaming}
            className="mt-3 w-full rounded-md bg-accent py-2.5 font-sans text-sm
                       font-semibold text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            New section
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {browsing === null ? (
          <ul>
            {parts.map(({ id, label }) => {
              const count = chaptersInPart(book, id).length;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setBrowsing(id)}
                    className="flex w-full items-center gap-2 border-b
                               border-line px-4 py-3.5 text-left font-sans
                               text-sm font-semibold text-fg outline-none
                               transition-colors hover:bg-raised
                               focus-visible:ring-inset focus-visible:ring-2
                               focus-visible:ring-accent/60"
                  >
                    <span className="flex-1 truncate">{label}</span>
                    <span className="shrink-0 font-normal tabular-nums text-muted">
                      {count}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-muted">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}

            {naming !== null && (
              <li className="border-b border-line px-4 py-2.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddPart();
                  }}
                >
                  <input
                    value={naming}
                    onChange={(e) => setNaming(e.target.value)}
                    onBlur={handleAddPart}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancelNaming();
                    }}
                    placeholder="Section name…"
                    aria-label="New section name"
                    autoFocus
                    className="w-full rounded-md border border-accent bg-surface
                               px-2.5 py-1.5 font-sans text-sm text-fg
                               placeholder:text-muted placeholder:font-normal
                               outline-none"
                  />
                </form>
              </li>
            )}
          </ul>
        ) : (
          <>
            <div className="flex items-center gap-1 border-b border-line px-2 py-2">
              <button
                type="button"
                onClick={() => setBrowsing(null)}
                className="flex flex-1 items-center gap-1.5 truncate rounded-md
                           px-2 py-1.5 text-left font-sans text-sm font-semibold
                           text-fg outline-none transition-colors
                           hover:bg-raised focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                <span aria-hidden="true">‹</span>
                <span className="truncate">{current?.label}</span>
              </button>

              {/* Sits with the section it adds to, so which section a new
                  chapter lands in is never a guess. */}
              {current && (
                <button
                  type="button"
                  onClick={() => handleCreate(current.id)}
                  title={`New chapter in ${current.label}`}
                  className="shrink-0 rounded-md bg-accent px-2.5 py-1.5
                             font-sans text-xs font-semibold text-white
                             outline-none transition-colors
                             hover:bg-accent-strong focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  New chapter
                </button>
              )}

              {/* Only sections the writer added. Front matter, Body and Back
                  matter are the shape of a book, not a preference. */}
              {current && !isBuiltinPart(current.id) && (
                <button
                  type="button"
                  onClick={() => handleRemovePart(current.id, current.label)}
                  aria-label={`Delete section ${current.label}`}
                  title="Delete section"
                  className="shrink-0 rounded-md px-2 py-1.5 font-sans text-sm
                             leading-none text-muted outline-none
                             transition-colors hover:text-red-400
                             focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  ×
                </button>
              )}
            </div>

            <SectionChapters
              book={book}
              bookId={bookId}
              part={browsing}
              activeId={activeId}
              dragId={dragId}
              onDragId={setDragId}
              onOverPart={setOverPart}
              onDelete={handleDelete}
            />

            {/* The other two sections, shown only while something is being
                dragged. Stepping into a section took them off screen, and a
                chapter you can pick up but cannot put anywhere is worse than
                a permanent strip nobody reads. */}
            {dragId && (
              <div className="sticky bottom-0 z-10 mt-4 border-t border-line bg-panel px-3 pt-3 pb-1">
                <p className="pb-2 font-sans text-xs text-muted">Move to</p>
                {parts
                  .filter((p) => p.id !== browsing)
                  .map(({ id, label }) => (
                    <div
                      key={id}
                      onDragOver={(e) => {
                        // Without preventDefault the browser refuses the drop.
                        e.preventDefault();
                        setOverPart(id);
                      }}
                      onDragLeave={() => setOverPart(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOn(id);
                        setBrowsing(id);
                      }}
                      className={`mb-1.5 rounded-md border border-dashed py-3
                                  text-center font-sans text-sm
                                  transition-colors ${
                                    overPart === id
                                      ? "border-accent bg-accent-deep/40 text-fg"
                                      : "border-line text-muted"
                                  }`}
                    >
                      {label}
                    </div>
                  ))}
              </div>
            )}
          </>
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
 * One section's chapters.
 *
 * Numbering runs on the book's own order, not the section's, so a chapter keeps
 * the number it has in the manuscript rather than being renumbered from 1 in
 * every section.
 */
function SectionChapters({
  book,
  bookId,
  part,
  activeId,
  dragId,
  onDragId,
  onOverPart,
  onDelete,
}: {
  book: Book;
  bookId: string;
  part: ChapterPart;
  activeId: string | null;
  dragId: string | null;
  onDragId: (id: string | null) => void;
  onOverPart: (part: ChapterPart | null) => void;
  onDelete: (chapter: ChapterMeta) => void;
}) {
  const chapters = chaptersInPart(book, part);
  const empty = PART_HINTS[part] ?? EMPTY_HINT;

  if (chapters.length === 0) {
    return (
      <p className="px-4 py-6 text-center font-sans text-sm text-muted italic">
        {empty}
      </p>
    );
  }

  return (
    <ol>
      {chapters.map((chapter) => {
        const isActive = chapter.id === activeId;
        const index = book.chapters.indexOf(chapter);

        return (
          <li
            key={chapter.id}
            draggable
            onDragStart={() => onDragId(chapter.id)}
            onDragEnd={() => {
              onDragId(null);
              onOverPart(null);
            }}
            className={`group relative ${
              dragId === chapter.id ? "opacity-40" : ""
            }`}
          >
            <Link
              href={`/book/${bookId}/chapter/${chapter.id}`}
              aria-current={isActive ? "page" : undefined}
              // Native drag is mouse-only, so reordering also needs a keyboard
              // path or it is unreachable for some.
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
              className={`flex items-center gap-2.5 border-l-4 py-3 pr-16 pl-3
                          font-sans text-sm outline-none transition-colors
                          focus-visible:ring-inset focus-visible:ring-2
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

            {/* A marked chapter keeps its star; an unmarked one shows it on
                hover, so rows stay quiet until wanted. */}
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
              className={`absolute top-1/2 right-9 -translate-y-1/2 rounded-sm
                          px-1 py-0.5 text-sm leading-none outline-none
                          transition-opacity focus-visible:opacity-100
                          focus-visible:ring-2 focus-visible:ring-accent/60 ${
                            chapter.bookmarked
                              ? "text-accent-strong opacity-100"
                              : "text-muted opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-fg"
                          }`}
            >
              {chapter.bookmarked ? "★" : "☆"}
            </button>

            <button
              type="button"
              onClick={() => onDelete(chapter)}
              aria-label={`Delete ${chapter.title}`}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm
                         px-1.5 py-0.5 font-sans text-sm leading-none text-muted
                         opacity-0 outline-none transition-opacity
                         group-hover:opacity-60 hover:!opacity-100
                         hover:text-red-400 focus-visible:opacity-100
                         focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              ×
            </button>
          </li>
        );
      })}
    </ol>
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
      <p className="mt-1 font-sans text-xs text-muted tabular-nums">
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
