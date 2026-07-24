"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  chapterLabel,
  chapterNumberOf,
  findBook,
  getBody,
  isGenericChapterTitle,
  orderedChapters,
  pageSetupOf,
  typographyOf,
  type Book,
} from "@/lib/library-store";
import { pageMetrics } from "@/lib/page-setup";
import { typographyVars } from "@/lib/typography";
import { toBlocks } from "@/lib/export/blocks";
import { blocksToXhtml } from "@/lib/export/xhtml";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ReaderPages,
  type ReaderChapter,
} from "@/components/reader/reader-pages";

/**
 * The whole book on one scrolling page.
 *
 * The editor mounts one chapter at a time — a deliberate choice, so opening a
 * forty-chapter book parses no prose. This is the other view: every chapter, in
 * reading order, rendered read-only as continuous pages a writer can scroll
 * end to end, the way a PDF reads. Editing stays in the editor; a chapter's
 * title here is a link back into it.
 *
 * The prose is rendered through the same block IR the exporters use, wrapped in
 * `.manuscript .tiptap` so it inherits the page's own typography for free.
 */

function loadForReading(book: Book): ReaderChapter[] {
  return orderedChapters(book).map((chapter) => {
    const raw = getBody(chapter.id);
    let html = "";
    if (raw) {
      try {
        html = blocksToXhtml(toBlocks(JSON.parse(raw)));
      } catch {
        // A corrupt body reads as an empty chapter rather than breaking the
        // whole scroll — the same call the exporters make.
        html = "";
      }
    }
    // A spelled "Chapter Five" label sits above the title, but only when the
    // title is a real name — a chapter still called "Chapter 5" is its own label.
    const number = chapterNumberOf(book, chapter.id);
    const label =
      number !== null && !isGenericChapterTitle(chapter.title)
        ? chapterLabel(number)
        : null;
    return {
      id: chapter.id,
      title: chapter.title,
      label,
      html,
      empty: html.trim() === "",
    };
  });
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function BookReader({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const prefs = usePrefs();
  const book = findBook(shelf, bookId);

  // How large the pages are drawn. A reading-only preference, so it lives in
  // component state rather than the store — closing the view resets it.
  const [zoom, setZoom] = useState(1);
  const stepZoom = (by: number) =>
    setZoom((z) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + by) * 10) / 10)),
    );

  // Parsing every body is the expensive part, so it is memoised on the shelf
  // snapshot — a rename repaints without re-reading forty documents.
  const chapters = useMemo(() => (book ? loadForReading(book) : []), [book]);

  if (!hydrated) return <LoadingScreen />;
  if (!book) return <MissingBook />;

  // Back into the editor at the chapter last open, or the first one.
  const resumeId = book.chapters.some((c) => c.id === book.lastOpenedId)
    ? book.lastOpenedId
    : (book.chapters[0]?.id ?? null);
  const backHref = resumeId
    ? `/book/${bookId}/chapter/${resumeId}`
    : `/book/${bookId}`;

  const dark = prefs.paper === "slate" || prefs.paper === "black";

  // The book's own face, size and spacing — the same variables the editor sets,
  // so the read-through matches the writing surface exactly.
  const typoVars = typographyVars(typographyOf(book));

  // Each chapter is set on real pages at the book's own trim size, and flows
  // onto further pages when it runs long — the pagination lives in ReaderPages.
  // The `fit` setting (which fills the editor column) is ignored here, exactly
  // as export ignores it.
  const metrics = pageMetrics(pageSetupOf(book));

  return (
    <div className="flex h-dvh flex-col bg-surface">
      {/* App chrome above the page: the way back to editing, and the title. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-3 md:px-6">
        <Link
          href={backHref}
          aria-label="Back to editing"
          title="Back to editing"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md
                     text-muted outline-none transition-colors hover:bg-raised
                     hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M11.5 5 6.5 10l5 5" />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base text-fg md:text-lg">
            {book.title}
          </p>
        </div>

        {/* Zoom: how big the pages are drawn. The percentage resets to 100%. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => stepZoom(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-md
                       text-muted outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M5 10h10" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            title="Reset zoom"
            className="w-12 rounded-md py-1.5 text-center font-sans text-xs
                       tabular-nums text-muted outline-none transition-colors
                       hover:bg-raised hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => stepZoom(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-md
                       text-muted outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M10 5v10M5 10h10" />
            </svg>
          </button>
        </div>
      </header>

      {/* The pages. `data-paper` re-points the palette so the sheets and their
          prose take the writer's chosen page colour, light or dark, independent
          of the app theme — exactly as the editor's surface does. `overflow-auto`
          rather than y-only: a page at its true trim width can be wider than a
          narrow window, and clipping it would hide the text. */}
      <main
        data-paper={prefs.paper}
        style={
          {
            colorScheme: dark ? "dark" : "light",
            ...typoVars,
          } as CSSProperties
        }
        className="scroll-paper manuscript min-h-0 flex-1 overflow-auto bg-surface"
      >
        <ReaderPages
          chapters={chapters}
          metrics={metrics}
          paper={prefs.paper}
          zoom={zoom}
          bookId={bookId}
          typographyKey={JSON.stringify(typoVars)}
        />
      </main>
    </div>
  );
}

function MissingBook() {
  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <div className="text-center">
        <p className="font-serif text-xl text-fg">This book isn’t here.</p>
        <p className="mt-2 font-sans text-sm text-muted">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm font-sans text-sm text-accent
                     underline underline-offset-4 outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Back to your books
        </Link>
      </div>
    </main>
  );
}
