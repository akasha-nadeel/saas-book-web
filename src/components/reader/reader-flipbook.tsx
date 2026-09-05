"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import type { PageMetrics } from "@/lib/page-setup";
import type { Book } from "@/lib/library-store";
import { BookCover } from "@/components/shelf/book-cover";
import { paginate, type ReaderChapter } from "@/components/reader/reader-pages";
import {
  needsSecondPass,
  picturesSettled,
  withFolios,
} from "@/lib/reader/page-flow";

const PX_PER_IN = 96;
/** One page's display width at 100% zoom; the zoom control scales from here. */
const BASE_PAGE_W = 340;
/** How long a turn takes; the CSS leaf/opening animations match it. */
const TURN_MS = 660;

function subscribeToSinglePage(onChange: () => void) {
  const query = window.matchMedia("(max-width: 47.999rem)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function singlePageSnapshot() {
  return window.matchMedia("(max-width: 47.999rem)").matches;
}

function useSinglePageReader() {
  return useSyncExternalStore(subscribeToSinglePage, singlePageSnapshot, () => false);
}

/** One page of the flowed book — its content HTML and whether it opens a chapter. */
interface FlatPage {
  chapterId: string;
  title: string;
  label: string | null;
  html: string;
  empty: boolean;
  first: boolean;
  /** Whether this page opens with its own title — see `ReaderChapter`. */
  heading: boolean;
  /** A page this app built, so there is no chapter behind it to open. */
  generated: boolean;
  /** Its place in the list the contents was built from — see `ReaderChapter`. */
  source: number | null;
  /**
   * The number printed at the foot of this sheet, one-based.
   *
   * The same count the PDF's `counter(page)` makes: its first page is the first
   * bound page, since nothing puts a cover sheet in front of it. Page one takes
   * no folio, matching `@page :first` in `typesetCss` — a number under a book's
   * title is the mark of a document.
   */
  folio: number;
  /** Whether that number is printed — `printsFolio`, carried through. */
  numbered: boolean;
}

/**
 * The reading view as a book you open and turn.
 *
 * It opens closed, on the cover. Flip forward and the cover swings open around
 * the spine into a two-page spread; from there every leaf turns the same way —
 * a two-faced sheet (the outgoing page on its front, the incoming on its back)
 * rotating across the centre. The two static pages beneath keep their old
 * content until the turning leaf has covered them, so nothing changes early.
 *
 * Every chapter is paginated the reading view's own way, so the breaks match the
 * printed pages. Turn with the side arrows, by clicking a half of the book, or
 * with the ← / → keys.
 */
export function ReaderFlipbook({
  chapters,
  book,
  cover,
  metrics,
  paper,
  darkSheet,
  zoom,
  bookId,
  typographyKey,
}: {
  chapters: ReaderChapter[];
  book: Book;
  cover: string | null;
  metrics: PageMetrics;
  paper: string;
  /** Whether that sheet is a dark one. See `darkPaper`. */
  darkSheet: boolean;
  zoom: number;
  bookId: string;
  typographyKey: string;
}) {
  const singlePage = useSinglePageReader();

  const trueW = metrics.width * PX_PER_IN;
  const trueH = metrics.height * PX_PER_IN;
  const contentW = (metrics.width - metrics.left - metrics.right) * PX_PER_IN;
  const contentH = (metrics.height - metrics.top - metrics.bottom) * PX_PER_IN;

  const pageW = (singlePage ? 280 : BASE_PAGE_W) * zoom;
  const openScale = pageW / trueW;
  const sheetH = trueH * openScale;

  // Paginate every chapter off-screen, the same harness the scrolling reader
  // uses; re-measure once the manuscript font has loaded.
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Record<string, string[]> | null>(null);
  const contentKey = chapters.map((c) => c.id + c.html.length).join("|");
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
    // The first pass can run before the serif has loaded and before the
    // pictures have a size, and both decide how much fits on a page — see
    // `picturesSettled`. Measure again once they have settled.
    if (needsSecondPass(chapters)) {
      Promise.all([document.fonts?.ready, picturesSettled(chapters)])
        .then(run)
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, contentW, contentH, typographyKey]);

  /**
   * The book as one run of sheets, with the contents page's folios filled in.
   *
   * **Two steps, and the order is the whole of it.** The pages have to be cut
   * before anybody knows what page a chapter lands on, and the contents page is
   * one of the pages being cut — so it is written with empty folio slots, the
   * book is flattened, and only then are the numbers put in. Filling a slot
   * changes no height (the folio sits on the line its leader already occupies),
   * so the layout that produced the numbers still holds and there is no second
   * pass to run. See `withFolios`.
   *
   * Memoised because it parses the contents page's markup, and a page turn
   * re-renders this component several times.
   */
  const flat = useMemo<FlatPage[]>(() => {
    const out: FlatPage[] = [];
    for (const chapter of chapters) {
      const pages =
        layout?.[chapter.id] ?? (chapter.empty ? [""] : [chapter.html]);
      pages.forEach((html, i) =>
        out.push({
          chapterId: chapter.id,
          title: chapter.title,
          label: chapter.label,
          html,
          empty: chapter.empty,
          first: i === 0,
          heading: chapter.heading,
          generated: chapter.generated,
          source: chapter.source,
          folio: out.length + 1,
          numbered: chapter.numbered,
        }),
      );
    }

    /* Which sheet each chapter opens on, one-based — the same count the printed
       folio makes, because the PDF's first page is the first bound page too
       (there is no cover sheet in it). */
    const opensOn = new Map<number, number>();
    for (const page of out) {
      if (page.first && page.source !== null) opensOn.set(page.source, page.folio);
    }

    return out.map((page) =>
      page.html.includes("toc-folio")
        ? { ...page, html: withFolios(page.html, (s) => opensOn.get(s) ?? null) }
        : page,
    );
  }, [chapters, layout]);

  const pageAt = (i: number): FlatPage | null => flat[i] ?? null;

  /**
   * Which flat page sits on each side of a spread.
   *
   * **Page one is a right-hand page, and every odd page after it.** That is not
   * a preference: in a left-to-right book the recto is always odd and the verso
   * always even, so a book opens on page 1 *alone*, with the inside of the
   * cover facing it. Pairing the pages two at a time from the start — which is
   * what this did until 2026-08-21 — puts page 1 on the left and every leaf
   * after it on the wrong side of the spine, so a spread that should read 2|3
   * reads 3|4 and the folios sit on the outer edge on one side and the inner on
   * the other.
   *
   * Hence the offset of one leaf: spread 1 is [nothing | page 1], spread 2 is
   * [page 2 | page 3]. A negative index falls out of `pageAt` as null and
   * `renderSheet(null)` draws a blank sheet, which is what faces page one in a
   * real book.
   *
   * Named rather than written out at each of the six sites that need them —
   * the static pair, both faces of the turning leaf, and the label — because
   * six copies of `2 * s - 3` is how one of them keeps the old arithmetic.
   */
  const leftIndex = (s: number) => 2 * s - 3;
  const rightIndex = (s: number) => 2 * s - 2;

  /* One page on the first spread and two on every one after, so the last page
     lands on a spread of its own when the count is even: 1 + 2(S-1) ≥ N. */
  const spreadCount = Math.max(1, Math.ceil((flat.length + 1) / 2));
  // The target view, 0…spreadCount. 0 is the closed cover; s≥1 is the open
  // spread — see `leftIndex`/`rightIndex` above.
  const [spread, setSpread] = useState(0);
  const [singleIndex, setSingleIndex] = useState(0);
  const target = Math.min(Math.max(0, spread), spreadCount);

  // The settled view. It lags `target` for one turn's length, so during a turn
  // the pages beneath still read as the old spread — the leaf, not a content
  // swap, is what changes them.
  const [committed, setCommitted] = useState(0);

  // Closing back onto the cover is a plain reveal, not a turn, so it settles at
  // once. Done during render rather than in the effect below: setting state
  // synchronously in an effect body schedules a second render *after* paint,
  // which is a wasted frame and what React's lint rule calls a cascading
  // render. Adjusting it here re-runs this component before anything is
  // painted, so the cover reveal lands on the same commit.
  if (target === 0 && committed !== 0) setCommitted(0);

  // Every other turn lags `target` for one turn's length, so during a turn the
  // pages beneath still read as the old spread — the leaf, not a content swap,
  // is what changes them.
  useEffect(() => {
    if (committed === target || target === 0) return;
    const t = setTimeout(() => setCommitted(target), TURN_MS);
    return () => clearTimeout(t);
  }, [target, committed]);

  const next = useCallback(() => {
    if (singlePage) {
      setSingleIndex((index) => Math.min(flat.length, index + 1));
      return;
    }
    setSpread((s) => Math.min(spreadCount, s + 1));
  }, [flat.length, singlePage, spreadCount]);
  const prev = useCallback(() => {
    if (singlePage) {
      setSingleIndex((index) => Math.max(0, index - 1));
      return;
    }
    setSpread((s) => Math.max(0, s - 1));
  }, [singlePage]);

  // Arrow keys turn the pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  /* **A spread is not always two pages**, so the label cannot always name two.
     The first holds page one on its own, and when the book has an even number
     of pages the last holds the final one on its own too. Page *numbers* here,
     not indices — one more than the index each side resolves to. */
  const pageLabel = (() => {
    const l = leftIndex(target) + 1;
    const r = rightIndex(target) + 1;
    const total = flat.length;
    if (l < 1) return `Page ${r} of ${total}`;
    if (r > total) return `Page ${l} of ${total}`;
    return `Pages ${l}–${r} of ${total}`;
  })();

  /* Handed down rather than worked out from the name: with a themed sheet
     the paper is `theme`, which is a deferral and not a colour — only the
     screen that knows the theme can answer this. `darkPaper` is that one
     rule, and `book-pages.tsx` has already called it. */
  const dark = darkSheet;

  const from = committed;
  const turning = committed !== target && target >= 1;
  const dir: "next" | "prev" = target > from ? "next" : "prev";
  const coverFront = turning && from === 0;
  const coverClosed = target === 0 && !turning;

  // The two static pages under any turning leaf. The side the leaf is leaving
  // keeps the old page; the side it is heading to shows the new page, revealed
  // as the leaf lifts.
  let leftPage: FlatPage | null = null;
  let rightPage: FlatPage | null = null;
  if (turning) {
    if (dir === "next") {
      leftPage = from >= 1 ? pageAt(leftIndex(from)) : null;
      rightPage = pageAt(rightIndex(target));
    } else {
      leftPage = pageAt(leftIndex(target));
      rightPage = pageAt(rightIndex(from));
    }
  } else if (target >= 1) {
    leftPage = pageAt(leftIndex(target));
    rightPage = pageAt(rightIndex(target));
  }

  // The turning leaf's two faces.
  const leafFront: FlatPage | null = coverFront
    ? null
    : dir === "next"
      ? pageAt(rightIndex(from))
      : pageAt(leftIndex(from));
  const leafBack: FlatPage | null =
    dir === "next" ? pageAt(leftIndex(target)) : pageAt(rightIndex(target));

  // The closed cover, drawn as a real book object at the page size.
  const renderCover = () => (
    <div
      style={{ width: pageW, height: sheetH }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden
                 rounded-l-[2px] rounded-r-md bg-panel
                 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.35),0_20px_42px_-12px_rgba(0,0,0,0.9)]"
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
      {cover && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r
                       from-black/30 via-black/[0.08] to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-[4px] w-px bg-black/20"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-1 right-0 w-[5px]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(0,0,0,0.18) 0 1px, rgba(255,255,255,0.85) 1px 2px)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-r-md"
            style={{ boxShadow: "inset 0 0 24px rgba(0,0,0,0.22)" }}
          />
        </>
      )}
    </div>
  );

  // One page on a sheet at the display size; a null page is a blank leaf.
  const renderSheet = (p: FlatPage | null) => (
    <div
      style={{ width: pageW, height: sheetH }}
      className="relative overflow-hidden bg-[var(--paper-bg)]"
    >
      {p && (
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
            transform: `scale(${openScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Apparatus opens with no title of its own — see `printsHeading`.
              The condition is `heading` rather than the part of the book,
              because that is the exporters' own answer and this screen exists
              to agree with them. */}
          {p.first && p.heading && !p.empty && (
            <Link
              href={`/book/${bookId}/chapter/${p.chapterId}`}
              className="chapter-opener reader-opener-link"
              onClick={(e) => {
                e.stopPropagation();
              }}
              title="Edit this chapter"
            >
              {p.label && <p className="chapter-label">{p.label}</p>}
              <h2 className="reader-title">{p.title}</h2>
            </Link>
          )}
          {p.empty ? (
            <p className="reader-empty">This chapter is empty.</p>
          ) : p.generated ? (
            /* Front matter this app built, set as front matter rather than as
               prose. `reader-cont` has nothing to say about it either: that
               class is about the indent on a paragraph a page break cut in
               half, and these pages have no such paragraph. */
            <div
              className="reader-front"
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          ) : (
            <div
              className={`tiptap${p.first ? "" : " reader-cont"}`}
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          )}

          {/* **The folio, in the bottom margin, exactly where the file prints
              it.** `typesetCss` puts `counter(page)` in the PDF's
              `@bottom-center` and drops it on `@page :first` — a number under a
              book's title is the mark of a document rather than a book — so
              this is the same rule, and it counts the same pages because the
              PDF opens on the first bound page too. It sits in the margin, not
              in the text block: the box is the sheet's own bottom padding, so a
              wider margin moves the number rather than the prose. */}
          {p.numbered && (
            <div
              aria-hidden="true"
              className="reader-folio"
              style={{ height: metrics.bottom * PX_PER_IN }}
            >
              {p.folio}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (singlePage) {
    const index = Math.min(singleIndex, flat.length);
    const currentPage = index > 0 ? pageAt(index - 1) : null;

    return (
      <div className="flex h-full min-w-0 flex-col overflow-y-auto px-3 pt-3 pb-[max(0.75rem,var(--oc-safe-bottom))] sm:p-4">
        <div className="my-auto max-w-full shrink-0 self-center overflow-x-auto rounded-sm">
          {index === 0 ? renderCover() : renderSheet(currentPage)}
        </div>

        <nav
          aria-label="Page navigation"
          className="sticky bottom-0 mt-3 flex shrink-0 items-center justify-center gap-3 border-t border-line bg-surface/95 pt-3 backdrop-blur"
        >
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-fg outline-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Previous page"
          >
            ←
          </button>
          <p className="min-w-28 text-center text-xs tabular-nums text-muted">
            {index === 0 ? "Cover" : `Page ${index} of ${flat.length}`}
          </p>
          <button
            type="button"
            onClick={next}
            disabled={index >= flat.length}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-fg outline-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Next page"
          >
            →
          </button>
        </nav>

        <div
          ref={measureRef}
          aria-hidden="true"
          className="manuscript"
          data-paper={paper}
          style={{
            position: "fixed",
            top: 0,
            left: "-99999px",
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          <div />
        </div>
      </div>
    );
  }

  return (
    /* **The book is a fixed size and the window is not.** `sheetH` comes from
       the trim and the zoom rather than from this container, so at 100% on a
       short window the sheet is taller than the space — and the page counter
       under it went off the bottom with three pixels showing. Centring alone
       cannot help: there is genuinely more content than room.

       `overflow-y-auto` with `my-auto` on the child is the pattern that serves
       both — it centres while it fits and scrolls once it does not, where
       `items-center` on its own would clip the top of anything too tall. */
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="relative my-auto shrink-0 self-center">
        {coverClosed ? (
          renderCover()
        ) : (
          <div
            className={`oc-book manuscript${coverFront ? " oc-book-opening" : ""}`}
            data-paper={paper}
            style={
              {
                width: pageW * 2,
                height: sheetH,
                colorScheme: dark ? "dark" : "light",
                "--open-shift": `${pageW / 2}px`,
              } as CSSProperties
            }
          >
            {!coverFront && (
              <div aria-hidden="true" className="oc-book-edge oc-book-edge-left" />
            )}
            {/* Opening from the cover: the left "inside" half is empty until the
                cover leaf finishes turning and lands on it (its back face is that
                same page, so the swap is seamless). A white sheet here would show
                a blank page beside the still-closed cover — the bug. */}
            {coverFront ? (
              <div style={{ width: pageW, height: sheetH }} />
            ) : (
              renderSheet(leftPage)
            )}
            {renderSheet(rightPage)}
            <div aria-hidden="true" className="oc-book-edge oc-book-edge-right" />
            <div aria-hidden="true" className="oc-book-spine" />

            {turning && (
              <div
                key={target}
                className={`oc-leaf oc-leaf-${dir}`}
                style={{
                  width: pageW,
                  height: sheetH,
                  left: dir === "next" ? pageW : 0,
                }}
              >
                <div className="oc-leaf-face">
                  {coverFront ? renderCover() : renderSheet(leafFront)}
                </div>
                <div className="oc-leaf-face oc-leaf-back">
                  {renderSheet(leafBack)}
                </div>
              </div>
            )}

            {/* Click a half to turn: the left half goes back, the right on. */}
            <button
              type="button"
              aria-label="Previous page"
              onClick={prev}
              className="absolute inset-y-0 left-0 z-[3] w-1/2 cursor-w-resize"
            />
            <button
              type="button"
              aria-label="Next page"
              onClick={next}
              disabled={target >= spreadCount}
              className="absolute inset-y-0 right-0 z-[3] w-1/2 cursor-e-resize
                         disabled:cursor-default"
            />
          </div>
        )}

        {/* The side arrows, clear of the book so they never cover the text. */}
        <FlipArrow side="left" onClick={prev} disabled={target <= 0} />
        <FlipArrow side="right" onClick={next} disabled={target >= spreadCount} />

        <p className="mt-4 text-center font-sans text-xs text-muted">
          {target === 0 ? "Cover" : pageLabel}
        </p>
      </div>

      {/* The off-screen measuring column. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="manuscript"
        data-paper={paper}
        style={{
          position: "fixed",
          top: 0,
          left: "-99999px",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div />
      </div>
    </div>
  );
}

/** A round page-turn arrow, floated just outside the book's fore-edge. */
function FlipArrow({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous page" : "Next page"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2
                  items-center justify-center rounded-full border border-line
                  bg-panel text-muted shadow-md outline-none transition-colors
                  hover:bg-raised hover:text-fg focus-visible:ring-2
                  focus-visible:ring-accent/60 disabled:opacity-30
                  disabled:hover:bg-panel ${
                    side === "left" ? "-left-16" : "-right-16"
                  }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {side === "left" ? <path d="M12 5l-5 5 5 5" /> : <path d="M8 5l5 5-5 5" />}
      </svg>
    </button>
  );
}
