"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { relativeTime } from "@/lib/relative-time";
import {
  bookWordCount,
  chapterMatterOf,
  chapterNumberOf,
  createChapter,
  createMatterSection,
  importIntoBook,
  type Book,
} from "@/lib/library-store";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import type { ImportedChapter } from "@/lib/import/split";
import { ImportModeDialog } from "@/components/editor/import-mode-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";

export type BookPanelMode = "book" | "chapters";

/**
 * The book navigator, on the right of the editor between the manuscript and the
 * tool rail. Two faces of the same thing:
 *
 * - **Book View** — the cover, large, with the two page steppers and the way in
 *   to the chapter list. The book as an object.
 * - **Chapters** — the cover small beside its figures, the make-and-import
 *   controls, then front matter, every chapter as a pill, and back matter — a
 *   table of contents you scroll and click. The book as its parts.
 *
 * The mode changes only this panel; the manuscript in the centre is untouched.
 * Previous / Next Page step to the page either side of the open one — front
 * matter, body, back matter, in the book's own order — so the centre and the
 * cover thumbnail on the tool rail both move with it.
 */
export function BookPanel({
  book,
  chapterId,
  cover,
  mode,
  onMode,
  onPrevPage,
  onNextPage,
}: {
  book: Book;
  chapterId: string | null;
  cover: string | null;
  mode: BookPanelMode;
  onMode: (mode: BookPanelMode) => void;
  /** Scroll the manuscript by a page — the steppers move pages, not chapters. */
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const router = useRouter();
  const bookId = book.id;

  // Importing a file into this book — mirrors the left panel: a read in flight,
  // any error, the hidden input, and a parsed file waiting on add-or-replace.
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportedChapter[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chapters = book.chapters;
  const bodyChapters = chapters.filter((c) => chapterMatterOf(c) === "body");
  const front = chapters.find((c) => c.matterKey === "front") ?? null;
  const back = chapters.find((c) => c.matterKey === "back") ?? null;

  const open = (id: string) => router.push(`/book/${bookId}/chapter/${id}`);

  const handleCreate = () => open(createChapter(bookId));

  // Front / back matter: open the page, seeding it from the template the first
  // time it is asked for.
  const openMatter = (matter: "front" | "back") => {
    const existing = matter === "front" ? front : back;
    const id = existing?.id ?? createMatterSection(bookId, matter);
    if (id) open(id);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const parsed = await importFile(file);
      // Already wrote here? Ask add-or-replace. An empty book just takes it in.
      if (bookWordCount(book) > 0) {
        setPending(parsed.chapters);
        return;
      }
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
    showImportBanner(bookId, result.undo, chapters.length);
    open(result.firstId);
  };

  return (
    <aside
      aria-label="Book"
      className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface lg:flex"
    >
      {mode === "book" ? (
        <div className="scroll-slim flex h-full flex-col items-center overflow-y-auto px-6 py-8">
          <div className="w-44 max-w-full">
            <BookCover
              title={book.title}
              subtitle={book.subtitle}
              author={book.author}
              words={bookWordCount(book)}
              image={cover}
              bare={book.bareCover}
              seed={book.id}
            />
          </div>

          {/* The book's details, under the cover — its name and the figures the
              old info card carried. */}
          <div className="mt-6 w-full">
            <p className="font-serif text-xl font-medium text-fg">{book.title}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 font-sans">
              <Figure
                label="Chapters"
                value={bodyChapters.length.toLocaleString()}
              />
              <Figure
                label="Words"
                value={bookWordCount(book).toLocaleString()}
              />
              <div className="col-span-2">
                <Figure
                  label="Last opened"
                  value={relativeTime(book.lastOpenedAt)}
                />
              </div>
            </dl>
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-2">
            <PageStep label="Previous" onClick={onPrevPage} />
            <PageStep label="Next Page" onClick={onNextPage} />
          </div>

          <button
            type="button"
            onClick={() => onMode("chapters")}
            className="mt-3 w-full rounded-lg bg-accent py-2.5 font-sans text-sm
                       font-semibold text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/50"
          >
            Chapters
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col px-5 py-6">
          {/* A small step back to the cover. */}
          <button
            type="button"
            onClick={() => onMode("book")}
            className="flex items-center gap-1 self-start rounded-md px-2 py-1
                       font-sans text-xs font-medium text-accent outline-none
                       transition-colors hover:bg-accent/10 focus-visible:ring-2
                       focus-visible:ring-accent/50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 5l-5 5 5 5" />
            </svg>
            Back
          </button>

          {/* Make a chapter, or bring a manuscript in — the same pair the left
              panel carries, kept here so the panel is a complete navigator. */}
          <div className="mt-5 flex items-stretch gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 rounded-lg bg-accent py-2.5 font-sans text-sm
                         font-semibold text-white outline-none transition-colors
                         hover:bg-accent-strong focus-visible:ring-2
                         focus-visible:ring-accent/50"
            >
              New chapter
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              aria-label={importing ? "Reading file…" : "Import a file"}
              title="Import a file"
              className="flex shrink-0 items-center justify-center rounded-lg border
                         border-line px-3 text-fg outline-none transition-colors
                         hover:border-accent/60 hover:bg-raised focus-visible:ring-2
                         focus-visible:ring-accent/50 disabled:opacity-50"
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
              e.target.value = "";
              if (file) void handleImport(file);
            }}
          />

          {importError && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-line bg-raised px-2.5 py-2
                         font-sans text-xs leading-relaxed"
              style={{ color: "var(--color-danger)" }}
            >
              {importError}
            </p>
          )}

          {/* Front matter opens the book, the body is the story, back matter
              closes it. The list scrolls so a long book stays in reach. */}
          <ul className="scroll-slim mt-4 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
            <MatterPill
              label="Front matter"
              exists={!!front}
              active={front?.id === chapterId}
              onClick={() => openMatter("front")}
            />

            {bodyChapters.length > 0 ? (
              bodyChapters.map((c) => (
                <ChapterPill
                  key={c.id}
                  number={chapterNumberOf(book, c.id)}
                  title={c.title}
                  active={c.id === chapterId}
                  onClick={() => open(c.id)}
                />
              ))
            ) : (
              <li className="px-1 py-2 font-sans text-xs text-muted italic">
                No chapters yet.
              </li>
            )}

            <MatterPill
              label="Back matter"
              exists={!!back}
              active={back?.id === chapterId}
              onClick={() => openMatter("back")}
            />
          </ul>
        </div>
      )}

      {pending && (
        <ImportModeDialog
          existingCount={bodyChapters.length}
          importCount={pending.length}
          onAdd={() => runImport(pending, "add")}
          onReplace={() => runImport(pending, "replace")}
          onClose={() => setPending(null)}
        />
      )}
    </aside>
  );
}

/** One of the two page steppers under the cover in Book View — each scrolls the
 *  manuscript by a page. */
function PageStep({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-accent/10 py-2 font-sans text-sm font-medium
                 text-accent outline-none transition-colors hover:bg-accent/20
                 focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {label}
    </button>
  );
}

/** A body chapter as a pill — numbered, the soft blue wash, filled when open. */
function ChapterPill({
  number,
  title,
  active,
  onClick,
}: {
  number: number | null;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left
                    font-sans text-sm outline-none transition-colors
                    focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      active
                        ? "bg-accent font-medium text-white"
                        : "bg-accent/10 text-fg hover:bg-accent/20"
                    }`}
      >
        {number !== null && (
          <span
            className={`shrink-0 text-xs tabular-nums ${
              active ? "text-white/80" : "text-muted"
            }`}
          >
            {number}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
    </li>
  );
}

/** Front or back matter as a bracketing pill — a section marker, not numbered;
 *  muted until it has been started. */
function MatterPill({
  label,
  exists,
  active,
  onClick,
}: {
  label: string;
  exists: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        title={exists ? label : `Start the ${label.toLowerCase()}`}
        className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-3
                    text-left font-sans text-sm font-medium outline-none
                    transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      active
                        ? "bg-accent text-white"
                        : exists
                          ? "bg-accent/10 text-fg hover:bg-accent/20"
                          : "border border-dashed border-line text-muted hover:bg-raised hover:text-fg"
                    }`}
      >
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
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    </li>
  );
}

/** A labelled figure in the Book View details — a label over its value. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-sans text-xs text-muted">{label}</dt>
      <dd className="font-sans text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
