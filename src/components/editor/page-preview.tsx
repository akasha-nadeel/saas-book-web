"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BOOK_SHADOW, BookCover } from "@/components/shelf/book-cover";
import {
  chapterLabel,
  chapterNumberOf,
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
import { paginate, type ReaderChapter } from "@/components/reader/reader-pages";

const PX_PER_IN = 96;
/** How wide the preview sheet is drawn, in CSS pixels. The cover and every page
 *  share this width, so the frame never shifts as the writer flips. */
const PREVIEW_W = 176;

/** One flipped page: which chapter it belongs to, the block HTML on it, and
 *  whether it is the chapter's first page (so the opener is drawn). */
interface FlatPage {
  key: string;
  title: string;
  label: string | null;
  html: string;
  empty: boolean;
  first: boolean;
}

/**
 * The Book View's flip-book — the whole finished book, a page at a time.
 *
 * `index` 0 is the cover; 1…N are the book's printed pages, every chapter in
 * order, front matter through back matter. The prose is set through the very
 * path the reader, the PDF and the EPUB use (`toBlocks` → `blocksToXhtml`, then
 * the reading view's own `paginate`), so what shows here is what will print. It
 * is a viewer only: flipping it never touches the chapter open in the centre.
 *
 * The cover is drawn on a sheet the same size as the pages, so the frame holds
 * steady from the cover through to the last page.
 */
export function PagePreview({
  book,
  cover,
  paper,
  index,
  onPageCount,
}: {
  book: Book;
  cover: string | null;
  /** The page-colour preference — the sheets take it, matching the surface. */
  paper: string;
  index: number;
  /** The book's printed-page count (the cover aside), so the pager can clamp. */
  onPageCount: (count: number) => void;
}) {
  const metrics = pageMetrics(pageSetupOf(book));
  const typoVars = typographyVars(typographyOf(book)) as CSSProperties;
  const typographyKey = JSON.stringify(typoVars);
  const dark = paper === "slate" || paper === "black";

  const contentW = (metrics.width - metrics.left - metrics.right) * PX_PER_IN;
  const contentH = (metrics.height - metrics.top - metrics.bottom) * PX_PER_IN;

  // Every chapter of the book, in reading order, as printable HTML — the same
  // call the reading view and the exporters make. Read from the saved bodies, so
  // it mirrors what will print; it re-reads whenever the shelf changes (which an
  // autosave does), so edits appear a beat after they are saved.
  const readerChapters = useMemo<ReaderChapter[]>(
    () =>
      orderedChapters(book).map((chapter) => {
        const raw = getBody(chapter.id);
        let html = "";
        if (raw) {
          try {
            html = blocksToXhtml(toBlocks(JSON.parse(raw)));
          } catch {
            html = "";
          }
        }
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
      }),
    [book],
  );

  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Record<string, string[]> | null>(null);

  // Break every chapter into pages off-screen, the same harness the reading view
  // uses; re-run once the manuscript font has loaded, since glyph metrics move
  // the breaks. A concatenation of the HTML keys the effect, so a word-count
  // tick that leaves the prose unchanged does not re-measure.
  const contentKey = readerChapters.map((c) => c.id + c.html.length).join("|");
  useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      const host = measureRef.current;
      if (cancelled || !host) return;
      const col = host.firstElementChild as HTMLElement;
      col.style.width = `${contentW}px`;
      const next: Record<string, string[]> = {};
      for (const chapter of readerChapters) {
        next[chapter.id] = chapter.empty
          ? [""]
          : paginate(col, chapter, contentH);
      }
      if (!cancelled) setLayout(next);
    };
    run();
    if (typeof document !== "undefined" && document.fonts?.status !== "loaded") {
      document.fonts?.ready.then(run).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, contentW, contentH, typographyKey]);

  // The whole book flattened to a single run of pages.
  const flat = useMemo<FlatPage[]>(() => {
    const out: FlatPage[] = [];
    for (const chapter of readerChapters) {
      const pages =
        layout?.[chapter.id] ?? (chapter.empty ? [""] : [chapter.html]);
      pages.forEach((html, i) =>
        out.push({
          key: `${chapter.id}:${i}`,
          title: chapter.title,
          label: chapter.label,
          html,
          empty: chapter.empty,
          first: i === 0,
        }),
      );
    }
    return out;
  }, [readerChapters, layout]);

  useEffect(() => onPageCount(flat.length), [flat.length, onPageCount]);

  const trueW = metrics.width * PX_PER_IN;
  const trueH = metrics.height * PX_PER_IN;
  const scale = PREVIEW_W / trueW;
  const frameStyle = { width: PREVIEW_W, height: trueH * scale } as const;

  // Which way the leaf turns: forward when the page went up, back when it went
  // down. The keyed frame below remounts on each change, replaying the CSS
  // page-turn, so the class has to be right on the very render the page
  // changes — not a frame later.
  //
  // **Derived by adjusting state during render, not by reading a ref.** The
  // previous version kept the last index in a ref and updated it in an effect,
  // which is the pattern React's own lint rule forbids: a ref read during
  // render is not tracked, so nothing guarantees the component re-renders when
  // it matters. It also decayed — once the effect had run, any later render at
  // the same index recomputed `turn` as "" and stripped the class off an
  // element that was still mid-animation. Setting state during render re-runs
  // this component immediately, before paint, so the keyed frame still mounts
  // with its class on the same commit, and the value now *keeps* until the
  // page actually changes again.
  const [prev, setPrev] = useState({ index, turn: "" });
  let turn = prev.turn;
  if (prev.index !== index) {
    turn = index > prev.index ? "oc-page-turn-next" : "oc-page-turn-prev";
    setPrev({ index, turn });
  }

  // The cover, page 0 — drawn on a sheet the size of a page so the frame holds.
  if (index <= 0) {
    return (
      <>
        {/* A real book object, not a flat image: the artwork under a spine
            shading down the left fold, a page-block of hairlines down the right
            fore-edge, and a grounded two-layer shadow — the same treatment the
            shelf covers wear (see BookCover), sized to the page. Wrapped so it
            turns like a leaf when the writer flips back to it. */}
        <div className="oc-page-view">
          <div
            key={index}
            style={frameStyle}
            className={`relative flex shrink-0 items-center justify-center
                       overflow-hidden rounded-l-[2px] rounded-r-md bg-panel
                       ${BOOK_SHADOW}
                       ${turn}`}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="w-full">
                <BookCover
                  title={book.title}
                  subtitle={book.subtitle}
                  author={book.author}
                  words={0}
                  image={null}
                  bare={book.bareCover}
                  seed={book.id}
                />
              </div>
            )}

            {/* Only over artwork — a typeset BookCover already draws its own. */}
            {cover && (
              <>
                {/* The spine: a hard fold with the shading falling away. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r
                             from-black/30 via-black/[0.08] to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-[4px] w-px bg-black/20"
                />
                {/* The page block, edge-on: hairlines so it reads as leaves. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-1 right-0 w-[5px]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, rgba(0,0,0,0.18) 0 1px, rgba(255,255,255,0.85) 1px 2px)",
                  }}
                />
                {/* A soft inner vignette, so the jacket reads as a curved surface
                    under light rather than a flat print. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-r-md"
                  style={{ boxShadow: "inset 0 0 24px rgba(0,0,0,0.22)" }}
                />
              </>
            )}
          </div>
        </div>
        <MeasureColumn ref={measureRef} typoVars={typoVars} paper={paper} />
      </>
    );
  }

  const page = flat[index - 1] ?? null;

  return (
    <div
      className="manuscript shrink-0"
      data-paper={paper}
      style={{ ...typoVars, colorScheme: dark ? "dark" : "light" }}
    >
      {/* The sheet at its true trim size, scaled down; the wrapper clips the
          overflow so only this page shows. The perspective wrapper and the keyed,
          turn-classed frame make it flip like a leaf on each page change. */}
      <div className="oc-page-view">
        <div
          key={index}
          style={frameStyle}
          className={`relative shrink-0 overflow-hidden rounded-sm shadow-lg ${turn}`}
        >
          <div
            className="paper reader-page"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: trueW,
              height: trueH,
              paddingTop: metrics.top * PX_PER_IN,
              paddingBottom: metrics.bottom * PX_PER_IN,
              paddingLeft: metrics.left * PX_PER_IN,
              paddingRight: metrics.right * PX_PER_IN,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {page?.first && !page.empty && (
              <div className="chapter-opener">
                {page.label && <p className="chapter-label">{page.label}</p>}
                <h2 className="reader-title">{page.title}</h2>
              </div>
            )}
            {page?.empty ? (
              <p className="reader-empty">This chapter is empty.</p>
            ) : (
              <div
                className={`tiptap${page && !page.first ? " reader-cont" : ""}`}
                dangerouslySetInnerHTML={{ __html: page?.html ?? "" }}
              />
            )}
          </div>
        </div>
      </div>

      <MeasureColumn ref={measureRef} typoVars={typoVars} paper={paper} />
    </div>
  );
}

/** The off-screen column the pages are measured in — a manuscript surface at the
 *  page's content width, kept out of view. */
function MeasureColumn({
  ref,
  typoVars,
  paper,
}: {
  ref: React.Ref<HTMLDivElement>;
  typoVars: CSSProperties;
  paper: string;
}) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="manuscript"
      data-paper={paper}
      style={{
        position: "fixed",
        top: 0,
        left: "-99999px",
        visibility: "hidden",
        pointerEvents: "none",
        ...typoVars,
      }}
    >
      <div />
    </div>
  );
}
