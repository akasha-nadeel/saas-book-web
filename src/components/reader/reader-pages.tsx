"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PageMetrics } from "@/lib/page-setup";
import { escapeXml } from "@/lib/export/xhtml";

/**
 * The book laid out as real pages.
 *
 * A page is a fixed sheet at the book's trim size; when a chapter's prose runs
 * past the bottom, it continues on the next sheet, the way Word and a PDF break
 * a document — not one endless page per chapter. The browser has no on-screen
 * pagination, so this measures the rendered blocks off-screen and packs them
 * into page-height groups itself.
 *
 * Measurement runs in a hidden column at the page's true content width, kept
 * out of the zoomed wrapper so `zoom` never distorts the numbers. It re-runs
 * once the manuscript font has loaded, since glyph metrics change how many
 * lines a paragraph takes and therefore where the pages break.
 */

const PX_PER_IN = 96;

export interface ReaderChapter {
  id: string;
  title: string;
  /** The spelled "Chapter Five" label, or null when the title is its own label
   *  (a generic "Chapter 5") or the chapter is front/back matter. */
  label: string | null;
  html: string;
  empty: boolean;
}

/** Split one chapter's prose into pages of block HTML, measuring in `col`. The
 *  first page leaves room for the chapter opener (its label and title). */
function paginate(col: HTMLElement, chapter: ReaderChapter, contentH: number): string[] {
  // The opener sits on the first page and eats into its height. Measured with
  // the very markup the page renders, so the space reserved matches the space
  // taken.
  const labelHtml = chapter.label
    ? `<p class="chapter-label">${escapeXml(chapter.label)}</p>`
    : "";
  col.innerHTML = `<div class="chapter-opener reader-opener-link">${labelHtml}<h2 class="reader-title">${escapeXml(
    chapter.title,
  )}</h2></div>`;
  const openerH = (col.firstElementChild as HTMLElement).getBoundingClientRect()
    .height;

  col.innerHTML = `<div class="tiptap">${chapter.html}</div>`;
  const tiptap = col.firstElementChild as HTMLElement;
  const kids = Array.from(tiptap.children) as HTMLElement[];
  if (kids.length === 0) return [""];

  // Positions relative to the top of the flow, so inter-block margins show up
  // as the gaps between one block's bottom and the next block's top.
  const base = tiptap.getBoundingClientRect().top;
  const blocks = kids.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - base, bottom: r.bottom - base, html: el.outerHTML };
  });

  const pages: string[] = [];
  let current: string[] = [];
  let pageTop = 0;
  let first = true;

  for (const block of blocks) {
    const budget = first ? contentH - openerH : contentH;
    // A block that would spill past the page's bottom starts the next page —
    // unless the page is empty, so a block taller than a page still lands
    // somewhere rather than looping.
    if (current.length && block.bottom - pageTop > budget) {
      pages.push(current.join(""));
      current = [];
      pageTop = block.top;
      first = false;
    }
    current.push(block.html);
  }
  pages.push(current.join(""));
  return pages;
}

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
    // A first pass may run before the serif has loaded; its metrics differ, so
    // re-measure once it has and let the breaks settle.
    if (typeof document !== "undefined" && document.fonts?.status !== "loaded") {
      document.fonts?.ready.then(run).catch(() => {});
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
          const opener = (
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
          );

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
                  className="tiptap"
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
                className={`tiptap${index > 0 ? " reader-cont" : ""}`}
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
