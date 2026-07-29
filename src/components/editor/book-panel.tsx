"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PagePreview } from "@/components/editor/page-preview";
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
  paper,
  mode,
  onMode,
}: {
  book: Book;
  chapterId: string | null;
  cover: string | null;
  /** The page-colour preference, handed to the print preview. */
  paper: string;
  mode: BookPanelMode;
  onMode: (mode: BookPanelMode) => void;
}) {
  const router = useRouter();
  const bookId = book.id;

  // Importing a file into this book — mirrors the left panel: a read in flight,
  // any error, the hidden input, and a parsed file waiting on add-or-replace.
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportedChapter[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The Book View flip-book: page 0 is the cover, 1…N the chapter's printed
  // pages. The preview reports its page count so the pager can clamp.
  const [previewIndex, setPreviewIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const prevPage = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPage = () => setPreviewIndex((i) => Math.min(pageCount, i + 1));

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
      // Transparent, with no divider: the gradient wash and the seamless blend
      // into the paper come from the shared row in the editor layout, so the
      // book panel and the manuscript read as one surface.
      // Widens with the window rather than taking one fixed number. 18rem was
      // set for the cover, which is the narrower of the two things this panel
      // shows; the chapter list wants room for a title, its number and its word
      // count without the title truncating. It only appears at lg and up, so
      // the manuscript keeps its measure on a laptop and gains from a monitor.
      className="hidden w-80 shrink-0 flex-col lg:flex xl:w-[22rem] 2xl:w-96"
    >
      {mode === "book" ? (
        /* Three bands, in the order a writer reads them: the page, what the
           book is, and the way out of here. `gap-7` sets the rhythm once
           instead of a different margin on each child, and the action is
           pushed to the foot by mt-auto so it sits in the same place whether
           the book is one chapter or forty. */
        <div className="scroll-slim flex h-full flex-col gap-7 overflow-y-auto px-6 py-8">
          {/* The cover on page 0; every page after it is the chapter as it will
              print, so the writer can flip through the finished pages here. */}
          <div className="flex flex-col items-center gap-3">
            <PagePreview
              book={book}
              cover={cover}
              paper={paper}
              index={previewIndex}
              onPageCount={setPageCount}
            />

            {/* A pager, not two arrows over the page.
                Laid on the preview they covered the prose — which is the one
                thing the preview exists to show, so the controls were hiding
                their own subject. Set beside the caption they cover nothing,
                the page keeps its full width, and the three parts read as one
                control: back, where you are, forward.

                Tabular figures so the number does not jog sideways as the count
                passes a wider digit and shifts the arrows under the cursor. */}
            <div className="flex items-center gap-1">
              <PageArrow
                label="Previous page"
                disabled={previewIndex === 0}
                onClick={prevPage}
                direction="left"
              />
              <span className="min-w-[7.5rem] text-center font-sans text-xs tabular-nums text-muted">
                {previewIndex === 0
                  ? "Cover"
                  : `Page ${previewIndex} of ${pageCount}`}
              </span>
              <PageArrow
                label="Next page"
                disabled={previewIndex >= pageCount}
                onClick={nextPage}
                direction="right"
              />
            </div>
          </div>

          {/* Title, figures and the way in to the chapters, as one block on a
              card rather than three things loose on the panel.

              They were loose, with the action pinned to the foot — which left a
              hand's width of nothing between the last line and the button. A
              gap that size reads as something failing to load. Grouping them
              gives the text an edge to sit against and puts the action where
              the reader already is, and the empty space falls below the block
              where it looks like room rather than a hole.

              The figures are one quiet line, not a grid of labelled cells:
              three numbers do not need a table, and the labels were louder than
              the values they described. */}
          <div className="rounded-xl border border-line bg-panel/70 p-4">
            <h2 className="font-serif text-lg leading-snug font-medium text-fg">
              {book.title}
            </h2>

            <p className="mt-1.5 font-sans text-sm text-muted">
              <span className="font-medium text-fg">
                {bodyChapters.length.toLocaleString()}
              </span>{" "}
              {bodyChapters.length === 1 ? "chapter" : "chapters"}
              <span aria-hidden="true" className="px-1.5 text-line">
                |
              </span>
              <span className="font-medium text-fg">
                {bookWordCount(book).toLocaleString()}
              </span>{" "}
              words
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted">
              Opened {relativeTime(book.lastOpenedAt)}
            </p>

            <button
              type="button"
              onClick={() => onMode("chapters")}
              className="mt-4 w-full cursor-pointer rounded-lg bg-accent py-2.5
                         font-sans text-sm font-semibold text-white outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Chapters
            </button>
          </div>
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
          {/* gap-0.5, not gap-2.5: rows this close read as a list, and a book
              of forty chapters is worth being able to see the shape of. */}
          <ul className="scroll-slim mt-4 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
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
                  words={c.words}
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

/** One of the two page steppers under the cover in Book View — each flips the
 *  print preview by a page. */
/**
 * One end of the pager under the page.
 *
 * Quiet by default and lit on hover, because a pager sits under something worth
 * looking at and should not compete with it. Disabled it dims rather than
 * disappearing: the pair keeps its shape, so the caption between them does not
 * shift sideways at the first and last page.
 *
 * Icon-only, so it carries a label for anyone not looking at it — the arrow
 * tells a sighted reader which way and a screen reader nothing at all.
 */
function PageArrow({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      // bg-panel, not white: it is white on the light theme and the lifted
      // slate on the dark one, so the disc stays a disc in both rather than
      // becoming a bright hole at night.
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center
                 rounded-full border border-line bg-panel text-fg shadow-sm
                 outline-none transition-[background-color,box-shadow,color]
                 hover:bg-raised hover:shadow focus-visible:ring-2
                 focus-visible:ring-accent/60 disabled:pointer-events-none
                 disabled:opacity-30"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"} />
      </svg>
    </button>
  );
}

/** A body chapter as a pill — numbered, the soft blue wash, filled when open. */
/** 1,240 → "1.2k". A sidebar column has no room for a thousands separator. */
function shortCount(words: number): string {
  if (words < 1000) return String(words);
  const thousands = words / 1000;
  return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
}

/**
 * One chapter in the contents.
 *
 * These were filled pills, every row carrying a tinted block — which made the
 * list a stack of buttons and left the open chapter competing with nine others
 * for attention. A contents list is mostly read, not pressed: the rows are
 * plain now, a hover shows what is under the pointer, and the fill is spent on
 * the one row that has something to say, which is where you are.
 *
 * Losing the fills and the padding roughly doubles how many chapters are in
 * view — the point of a contents list being to see the shape of the book.
 */
function ChapterPill({
  number,
  title,
  words,
  active,
  onClick,
}: {
  number: number | null;
  title: string;
  words: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg
                    px-2.5 py-2 text-left font-sans text-sm outline-none
                    transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/50 ${
                      active
                        ? "bg-accent font-medium text-white"
                        : "text-fg hover:bg-raised"
                    }`}
      >
        {/* Fixed width and right-aligned, so the titles line up whether the
            number is 1 or 40 rather than stepping right as the book grows. */}
        <span
          className={`w-5 shrink-0 text-right text-xs tabular-nums ${
            active ? "text-white/70" : "text-muted"
          }`}
        >
          {number ?? ""}
        </span>

        <span className="min-w-0 flex-1 truncate">{title}</span>

        {/* Silent on an empty chapter: "0" is noise on every row of a book that
            has only been outlined. */}
        {words > 0 && (
          <span
            className={`shrink-0 text-[0.7rem] tabular-nums ${
              active ? "text-white/70" : "text-muted"
            }`}
          >
            {shortCount(words)}
          </span>
        )}
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
        // Matched to a chapter row's height and padding so the three parts of
        // the book read as one list. It keeps the dashed outline while it does
        // not exist yet, which is the one thing about it worth saying loudly.
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg
                    px-2.5 py-2 text-left font-sans text-sm font-medium
                    outline-none transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/50 ${
                      active
                        ? "bg-accent text-white"
                        : exists
                          ? "text-fg hover:bg-raised"
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
