"use client";

import { useState } from "react";
import Link from "next/link";
import { findBook } from "@/lib/library-store";
import { useCover, useHydrated, useShelf } from "@/lib/use-library";
import { LoadingScreen } from "@/components/loading-screen";
import { BookPages } from "@/components/reader/book-pages";

/**
 * The whole book, as a book you open and turn.
 *
 * The editor mounts one chapter at a time — a deliberate choice, so opening a
 * forty-chapter book parses no prose. This is the other view: every chapter, in
 * reading order, set read-only on real page sheets at the book's trim size.
 * Editing stays in the editor; a chapter's opener here is a link back into it.
 *
 * The setting itself is `BookPages`, shared with the export wizard's Preview
 * step; this file is the window around it — the way back, the title and the
 * zoom.
 */

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function BookReader({
  bookId,
  from,
  phase,
}: {
  bookId: string;
  /** The roadmap phase that sent them, when `from` is "roadmap". */
  phase?: string;
  /** Which door the reader was opened by — see backHref below. */
  from?: string;
}) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const cover = useCover(bookId);

  // How large the pages are drawn. A reading-only preference, so it lives in
  // component state rather than the store — closing the view resets it.
  const [zoom, setZoom] = useState(1);
  const stepZoom = (by: number) =>
    setZoom((z) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + by) * 10) / 10)),
    );

  if (!hydrated) return <LoadingScreen />;
  if (!book) return <MissingBook />;

  // Where back goes depends on where you came in from. The reader has two
  // doors: the editor's rail, and Read on the shelf's book dialog. Sending a
  // reader who arrived from the shelf "back" into an editor they never opened
  // is not a return, it is a new place — so the shelf marks its own door with
  // ?from=shelf and this honours it.
  const cameFromShelf = from === "shelf";

  /*
   * The roadmap is the third door, and it had no way back at all.
   *
   * "Read it end to end" is a step on the road, and this screen is where that
   * step is *done* — but it is one of the two destinations that take the whole
   * window rather than opening beside the road, so pressing it left the
   * roadmap entirely and the only exits here were the editor and the shelf. A
   * writer working down eighteen steps had to find their way back through the
   * dashboard and reopen the tool.
   *
   * The phase rides along so they land on the part of the road they left,
   * rather than at the top of it.
   */
  const cameFromRoadmap = from === "roadmap";
  const roadmapHref = `/book/${bookId}/roadmap${
    phase ? `?phase=${encodeURIComponent(phase)}` : ""
  }`;

  /*
   * The export wizard is *not* a door here, and that is deliberate.
   *
   * Its Preview was a link to this screen for part of 2026-08-17, and the cost
   * showed at once: the wizard holds the format, the template, the trim and the
   * front-matter switches in component state, so leaving it threw all of them
   * away and dropped the writer back on step one. Preview is a step of the
   * wizard now, mounting `BookPages` in place — see `export-page.tsx`.
   */

  // Otherwise: back into the editor at the chapter last open, or the first one.
  const resumeId = book.chapters.some((c) => c.id === book.lastOpenedId)
    ? book.lastOpenedId
    : (book.chapters[0]?.id ?? null);
  const backHref = cameFromRoadmap
    ? roadmapHref
    : cameFromShelf
      ? "/"
      : resumeId
        ? `/book/${bookId}/chapter/${resumeId}`
        : `/book/${bookId}`;
  const backLabel = cameFromRoadmap
    ? "Back to the roadmap"
    : cameFromShelf
      ? "Back to your books"
      : "Back to editing";

  return (
    <div className="flex h-dvh flex-col bg-surface">
      {/* App chrome above the page: the way back to editing, and the title. */}
      <header className="flex shrink-0 items-center gap-3 px-4 py-3 md:px-6">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
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

      {/* The pages themselves, given the rest of the window. */}
      <main className="min-h-0 flex-1 bg-surface">
        <BookPages
          book={book}
          cover={cover}
          zoom={zoom}
          className="h-full overflow-hidden"
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
