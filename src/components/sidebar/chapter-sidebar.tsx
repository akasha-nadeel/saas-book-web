"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  bookWordCount,
  chapterMatterOf,
  chapterNumberOf,
  createChapter,
  createMatterSection,
  deleteChapter,
  findBook,
  importIntoBook,
  moveChapter,
  renameChapter,
  setPref,
  toggleBookmark,
  type ChapterMeta,
} from "@/lib/library-store";
import { RowMenu, menuIcons } from "@/components/sidebar/row-menu";
import { useShelf } from "@/lib/use-library";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import type { ImportedChapter } from "@/lib/import/split";
import { ImportModeDialog } from "@/components/editor/import-mode-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";

/**
 * A book in three parts: front matter, the body, back matter.
 *
 * The body is the story — chapters the writer adds, numbered from one, reordered
 * by dragging. Front and back matter are two buttons that bracket it: each opens
 * a single page whose template already carries the standard sections of that part
 * (title page, dedication, epigraph … / epilogue, acknowledgements …) as
 * headings, for the writer to fill in. Those pages are named, never numbered.
 */
export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // The chapter whose title is being edited in place, and the text so far.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // Importing a file into this book: whether a read is in flight, any error to
  // show, the hidden file input, and a parsed file waiting on the writer to
  // choose add-or-replace (only when the book already holds prose).
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportedChapter[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /**
   * Read a file and bring its chapters into this book. If the writer has
   * already put prose here, ask first whether to add or replace; an empty book
   * (a fresh one, or one with only blank chapters) just takes the import in.
   * Uses the same parser as the shelf import, so a .docx/.epub/.md/.txt/.html
   * comes in split into chapters — but lands inside the book already open.
   */
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const parsed = await importFile(file);
      // "Already wrote a novel here" = any chapter with words in it.
      if (book && bookWordCount(book) > 0) {
        setPending(parsed.chapters);
        return;
      }
      // Nothing written yet: replace the empty placeholder chapters cleanly,
      // numbered from one, with no question asked.
      runImport(parsed.chapters, "replace");
    } catch (err) {
      setImportError(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
    } finally {
      setImporting(false);
    }
  };

  const runImport = (chapters: ImportedChapter[], mode: "add" | "replace") => {
    setPending(null);
    const result = importIntoBook(bookId, chapters, mode);
    if (!result) {
      setImportError(
        "Those chapters could not be saved — the book may be too large for this browser's storage.",
      );
      return;
    }
    // Show the banner first, then navigate — the banner lives in the book
    // layout, so it survives the chapter change and stays up while the writer
    // checks the order.
    showImportBanner(bookId, result.undo, chapters.length);
    router.push(`/book/${bookId}/chapter/${result.firstId}`);
  };

  const handleDelete = (chapter: ChapterMeta) => {
    // No dialog: deletion goes to the book's trash now, and the deleted-chapters
    // section below restores it — so the safety net is in the UI, not a prompt.
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

  /** Drop one chapter onto another: the dragged one takes that position. Only
   *  the body reorders this way — front and back pages keep the standard order,
   *  and only body rows are draggable, so a drop is always body onto body. */
  const handleDropOn = (targetId: string) => {
    const from = book.chapters.findIndex((c) => c.id === dragId);
    const to = book.chapters.findIndex((c) => c.id === targetId);
    const dragged = book.chapters[from];
    const target = book.chapters[to];
    if (
      from >= 0 &&
      to >= 0 &&
      from !== to &&
      chapterMatterOf(dragged) === "body" &&
      chapterMatterOf(target) === "body"
    ) {
      moveChapter(bookId, from, to);
    }

    setDragId(null);
    setOverId(null);
  };

  const startRename = (chapter: ChapterMeta) => {
    setRenamingId(chapter.id);
    setDraftTitle(chapter.title);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const next = draftTitle.trim();
    // A chapter with no name is unfindable in the list, so a cleared field
    // means "leave it alone" rather than "call it nothing".
    if (next) renameChapter(bookId, renamingId, next);
    setRenamingId(null);
  };

  /** The in-place rename field, shared by body chapters and matter pages. */
  const renameForm = (chapter: ChapterMeta) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commitRename();
      }}
      className="border-l-4 border-accent py-1.5 pr-2 pl-3"
    >
      <input
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          // Escape abandons the edit; blur would otherwise commit whatever
          // half-typed text is in the field.
          if (e.key === "Escape") setRenamingId(null);
        }}
        aria-label={`Rename ${chapter.title}`}
        autoFocus
        className="w-full rounded-md border border-accent bg-surface px-2
                   py-1.5 font-sans text-sm text-fg outline-none"
      />
    </form>
  );

  /** One body chapter row: numbered, draggable, star/rename/delete. */
  const renderChapter = (chapter: ChapterMeta) => {
    const index = book.chapters.findIndex((c) => c.id === chapter.id);
    const isActive = chapter.id === activeId;
    const number = chapterNumberOf(book, chapter.id);

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
        {renamingId === chapter.id ? (
          renameForm(chapter)
        ) : (
          <Link
            href={`/book/${bookId}/chapter/${chapter.id}`}
            aria-current={isActive ? "page" : undefined}
            // A link is draggable by default — the browser would drag its URL
            // and never fire the row's reorder drag. Turning that off lets the
            // row (the draggable <li>) be dragged.
            draggable={false}
            // Native drag is mouse-only, so reordering also needs a keyboard
            // path or it is unreachable for some.
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            onKeyDown={(e) => {
              if (!e.altKey) return;
              const step =
                e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
              if (!step) return;
              e.preventDefault();
              const target = index + step;
              const neighbour = book.chapters[target];
              // Stay inside the body — a nudge never carries a chapter into the
              // front or back matter, which keep the standard order.
              if (neighbour && chapterMatterOf(neighbour) === "body") {
                moveChapter(bookId, index, target);
              }
            }}
            className={`flex items-center gap-2.5 border-l-4 py-3 pr-10 pl-3
                        font-sans text-sm outline-none transition-colors
                        focus-visible:ring-inset focus-visible:ring-2
                        focus-visible:ring-accent/60 ${
                          isActive
                            ? "border-accent bg-selected font-medium text-selected-fg"
                            : "border-transparent text-fg hover:bg-raised"
                        }`}
          >
            <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-100">
              {number ?? ""}
            </span>
            <span className="flex-1 truncate">{chapter.title}</span>
            {/* A starred chapter keeps its mark in the row: the menu can say
                whether it is starred, but only when open. */}
            {chapter.bookmarked && (
              <span
                aria-label="Starred"
                className="shrink-0 text-xs text-accent-strong"
              >
                ★
              </span>
            )}
          </Link>
        )}

        {renamingId !== chapter.id && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">
            <RowMenu
              label={chapter.title}
              active={isActive}
              items={[
                {
                  label: chapter.bookmarked ? "Unstar" : "Star",
                  hint: "S",
                  icon: chapter.bookmarked
                    ? menuIcons.starFilled
                    : menuIcons.star,
                  onSelect: () => toggleBookmark(bookId, chapter.id),
                },
                {
                  label: "Rename",
                  hint: "R",
                  icon: menuIcons.rename,
                  onSelect: () => startRename(chapter),
                },
                {
                  label: "Delete",
                  hint: "D",
                  icon: menuIcons.trash,
                  onSelect: () => handleDelete(chapter),
                  danger: true,
                },
              ]}
            />
          </span>
        )}
      </li>
    );
  };

  const bodyChapters = book.chapters.filter(
    (c) => chapterMatterOf(c) === "body",
  );

  /**
   * One matter part as a single button that brackets the body — front above the
   * chapters, back below. It opens that part's page, seeding it with the standard
   * template the first time. Once written it is a real page: the button becomes
   * a highlight-when-open row with a ⋯ menu to rename or clear it.
   */
  const renderMatterButton = (matter: "front" | "back") => {
    const existing = book.chapters.find((c) => c.matterKey === matter);
    const label = matter === "front" ? "Front matter" : "Back matter";
    const isActive = existing?.id === activeId;

    const open = () => {
      const id = existing?.id ?? createMatterSection(bookId, matter);
      if (id) router.push(`/book/${bookId}/chapter/${id}`);
    };

    // The book icon — front matter opens the book, back matter closes it, so the
    // two mirror. A single glyph reads as a section marker, not a chapter.
    const icon = (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10v14H5.5A1.5 1.5 0 0 1 4 15.5z" />
        <path d="M16 4.5A1.5 1.5 0 0 0 14.5 3H10v14h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </svg>
    );

    if (existing && renamingId === existing.id) {
      return renameForm(existing);
    }

    return (
      <div className="group relative">
        <button
          type="button"
          onClick={open}
          aria-current={isActive ? "page" : undefined}
          title={existing ? label : `Start the ${label.toLowerCase()}`}
          className={`flex w-full items-center gap-2.5 border-l-4 py-3 pr-10 pl-3
                      text-left font-sans text-sm font-medium outline-none
                      transition-colors focus-visible:ring-inset
                      focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        isActive
                          ? "border-accent bg-selected text-selected-fg"
                          : existing
                            ? "border-transparent text-fg hover:bg-raised"
                            : "border-transparent text-muted hover:bg-raised hover:text-fg"
                      }`}
        >
          {icon}
          <span className="flex-1 truncate">{label}</span>
        </button>

        {existing && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">
            <RowMenu
              label={label}
              active={isActive}
              items={[
                {
                  label: "Rename",
                  hint: "R",
                  icon: menuIcons.rename,
                  onSelect: () => startRename(existing),
                },
                {
                  label: "Delete",
                  hint: "D",
                  icon: menuIcons.trash,
                  onSelect: () => handleDelete(existing),
                  danger: true,
                },
              ]}
            />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col" aria-label="Manuscript">
      {/* The wordmark opens the shelf. Beside it, the collapse control hides the
          panel and leaves the rail standing — the rail's tabs bring it back. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <Link
          href="/"
          className="rounded-sm font-display text-xl font-semibold tracking-tight
                     text-fg outline-none transition-opacity hover:opacity-90
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Open<span style={{ color: "#3a86d4" }}>Chapter</span>
        </Link>

        <button
          type="button"
          onClick={() => setPref("leftPanel", false)}
          aria-label="Hide panel"
          title="Hide panel"
          className="-mr-1 shrink-0 rounded-md p-1.5 text-muted outline-none
                     transition-colors hover:bg-raised hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
            <path d="M7.5 3.5v13" />
          </svg>
        </button>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-3">
        {/* New chapter leads, Import sits beside it as a compact button — one
            row rather than two stacked. */}
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={handleCreate}
            className="flex-1 rounded-md bg-accent py-2.5 font-sans text-sm
                       font-semibold text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            New chapter
          </button>

          {/* Bring an existing manuscript into this book — reads the file and
              appends its chapters here. Icon only, so the row stays compact. */}
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            aria-label={importing ? "Reading file…" : "Import a file"}
            title="Import a file"
            className="flex shrink-0 items-center justify-center gap-2 rounded-md
                       border border-muted/60 px-3 font-sans text-sm font-medium
                       text-fg outline-none transition-colors
                       hover:border-accent/60 hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" />
              <path d="M3.5 12.5v2A1.5 1.5 0 0 0 5 16h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
            </svg>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset, or choosing the same file twice fires nothing.
            e.target.value = "";
            if (file) void handleImport(file);
          }}
        />

        {importError && (
          <p
            role="alert"
            className="mt-2 rounded-md border border-line bg-raised px-2.5 py-2
                       font-sans text-xs leading-relaxed"
            style={{ color: "var(--color-danger)" }}
          >
            {importError}
          </p>
        )}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto pb-3">
        {/* A book, top to bottom: front matter opens it, the body is the story,
            back matter closes it. Front and back are single buttons that open a
            templated page; the body is the chapter list itself. */}
        <div className="border-y border-line">{renderMatterButton("front")}</div>

        {bodyChapters.length > 0 ? (
          <ol>{bodyChapters.map(renderChapter)}</ol>
        ) : (
          <p className="px-4 py-3 font-sans text-xs text-muted italic">
            No chapters yet.
          </p>
        )}

        <div className="border-y border-line">{renderMatterButton("back")}</div>
      </div>

      {pending && (
        <ImportModeDialog
          existingCount={bodyChapters.length}
          importCount={pending.length}
          onAdd={() => runImport(pending, "add")}
          onReplace={() => runImport(pending, "replace")}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
