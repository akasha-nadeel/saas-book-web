"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PageMetrics } from "@/lib/page-setup";
import {
  needsSecondPass,
  paginate,
  picturesSettled,
  type ReaderChapter,
} from "@/lib/reader/page-flow";

/**
 * The book laid out as real pages.
 *
 * A page is a fixed sheet at the book's trim size; when a chapter's prose runs
 * past the bottom, it continues on the next sheet, the way Word and a PDF break
 * a document — not one endless page per chapter. The browser has no on-screen
 * pagination, so this measures the rendered blocks off-screen and cuts them
 * into page-height sheets itself; the whole of that lives in
 * `lib/reader/page-flow.ts`, over the same `pageBreaks` the editor uses.
 *
 * Measurement runs in a hidden column at the page's true content width, kept
 * out of the zoomed wrapper so `zoom` never distorts the numbers. It re-runs
 * once the manuscript font has loaded, since glyph metrics change how many
 * lines a paragraph takes and therefore where the pages break.
 */

const PX_PER_IN = 96;

// Both live in page-flow now; re-exported because the flip-book and the Book
// View preview already reach for them here.
export { paginate, type ReaderChapter };

export function ReaderPages({
  chapters,
  metrics,
  paper,
  zoom,
  bookId,
  typographyKey,
}: {
  chapters: ReaderChapter[];
  metrics: PageMetrics;
  paper: string;
  zoom: number;
  bookId: string;
  /** Changes when the book's typography does, so the pages are re-measured —
   *  a bigger face or looser leading breaks the pages in different places. */
  typographyKey: string;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Record<string, string[]> | null>(null);

  const contentW = (metrics.width - metrics.left - metrics.right) * PX_PER_IN;
  const contentH = (metrics.height - metrics.top - metrics.bottom) * PX_PER_IN;

  useLayoutEffect(() => {
    let cancelled = false;

    const run = () => {
      const host = measureRef.current;
      if (cancelled || !host) return;
      const col = host.firstElementChild as HTMLElement;
      col.style.width = `${contentW}px`;

      const next: Record<string, string[]> = {};
      for (const chapter of chapters) {
        next[chapter.id] = chapter.empty
          ? [""]
          : paginate(col, chapter, contentH);
      }
      if (!cancelled) setLayout(next);
    };

    run();
    // A first pass may run before the serif has loaded and before the pictures
    // have a size; both change how much fits on a page — see `picturesSettled`
    // — so re-measure once they have settled and let the breaks settle with
    // them.
    if (needsSecondPass(chapters)) {
      Promise.all([document.fonts?.ready, picturesSettled(chapters)])
        .then(run)
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [chapters, contentW, contentH, paper, typographyKey]);

  const pageStyle = {
    width: `${metrics.width}in`,
    height: `${metrics.height}in`,
    paddingTop: `${metrics.top}in`,
    paddingBottom: `${metrics.bottom}in`,
    paddingLeft: `${metrics.left}in`,
    paddingRight: `${metrics.right}in`,
  } as const;

  return (
    <>
      {/* The off-screen measuring column. Outside the zoom wrapper below, so
          getBoundingClientRect reads true pixels whatever the zoom. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        data-paper={paper}
        className="manuscript"
        style={{
          position: "fixed",
          top: 0,
          left: "-99999px",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div className="reader-col" />
      </div>

      <div
        style={{ zoom }}
        className="flex flex-col items-center gap-8 px-3 py-8 md:py-12"
      >
        {chapters.map((chapter) => {
          // The prose setting, or the front-matter one for a page this app
          // built — the same split the flip-book makes. See `.reader-front`.
          const body = chapter.generated ? "reader-front" : "tiptap";
          // Apparatus prints no title of its own; see `printsHeading`.
          const opener = chapter.heading ? (
            <Link
              href={`/book/${bookId}/chapter/${chapter.id}`}
              title="Edit this chapter"
              className="chapter-opener reader-opener-link"
            >
              {chapter.label && (
                <p className="chapter-label">{chapter.label}</p>
              )}
              <h2 className="reader-title">{chapter.title}</h2>
            </Link>
          ) : null;

          if (chapter.empty) {
            return (
              <article
                key={chapter.id}
                style={pageStyle}
                className="paper reader-page rounded-sm shadow-lg"
              >
                {opener}
                <p className="reader-empty">This chapter is empty.</p>
              </article>
            );
          }

          const pages = layout?.[chapter.id];

          // Until measured, the chapter is one sheet that grows to its content,
          // so nothing is hidden while the page breaks are worked out.
          if (!pages) {
            return (
              <article
                key={chapter.id}
                style={{ ...pageStyle, height: "auto", minHeight: pageStyle.height }}
                className="paper reader-page rounded-sm shadow-lg"
              >
                {opener}
                <div
                  className={body}
                  dangerouslySetInnerHTML={{ __html: chapter.html }}
                />
              </article>
            );
          }

          return pages.map((html, index) => (
            <article
              key={`${chapter.id}:${index}`}
              style={pageStyle}
              className="paper reader-page rounded-sm shadow-lg"
            >
              {index === 0 && opener}
              <div
                className={`${body}${index > 0 && !chapter.generated ? " reader-cont" : ""}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </article>
          ));
        })}

        {chapters.length === 0 && (
          <p className="py-16 text-center font-sans text-sm text-muted">
            This book has no chapters yet.
          </p>
        )}
      </div>
    </>
  );
}
