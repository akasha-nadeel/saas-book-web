"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import type { PageMetrics } from "@/lib/page-setup";
import type { Book } from "@/lib/library-store";
import { BookCover } from "@/components/shelf/book-cover";
import { paginate, type ReaderChapter } from "@/components/reader/reader-pages";

const PX_PER_IN = 96;
/** One page's display width at 100% zoom; the zoom control scales from here. */
const BASE_PAGE_W = 340;
/** How long a turn takes; the CSS leaf/opening animations match it. */
const TURN_MS = 660;

/** One page of the flowed book — its content HTML and whether it opens a chapter. */
interface FlatPage {
  chapterId: string;
  title: string;
  label: string | null;
  html: string;
  empty: boolean;
  first: boolean;
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
  zoom,
  bookId,
  typographyKey,
}: {
  chapters: ReaderChapter[];
  book: Book;
  cover: string | null;
  metrics: PageMetrics;
  paper: string;
  zoom: number;
  bookId: string;
  typographyKey: string;
}) {
  const router = useRouter();

  const trueW = metrics.width * PX_PER_IN;
  const trueH = metrics.height * PX_PER_IN;
  const contentW = (metrics.width - metrics.left - metrics.right) * PX_PER_IN;
  const contentH = (metrics.height - metrics.top - metrics.bottom) * PX_PER_IN;

  const pageW = BASE_PAGE_W * zoom;
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
    if (typeof document !== "undefined" && document.fonts?.status !== "loaded") {
      document.fonts?.ready.then(run).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, contentW, contentH, typographyKey]);

  const flat: FlatPage[] = [];
  for (const chapter of chapters) {
    const pages =
      layout?.[chapter.id] ?? (chapter.empty ? [""] : [chapter.html]);
    pages.forEach((html, i) =>
      flat.push({
        chapterId: chapter.id,
        title: chapter.title,
        label: chapter.label,
        html,
        empty: chapter.empty,
        first: i === 0,
      }),
    );
  }
  const pageAt = (i: number): FlatPage | null => flat[i] ?? null;

  const spreadCount = Math.max(1, Math.ceil(flat.length / 2));
  // The target view, 0…spreadCount. 0 is the closed cover; s≥1 is the open
  // spread with left page flat[2s-2] and right page flat[2s-1].
  const [spread, setSpread] = useState(0);
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

  const next = useCallback(
    () => setSpread((s) => Math.min(spreadCount, s + 1)),
    [spreadCount],
  );
  const prev = useCallback(() => setSpread((s) => Math.max(0, s - 1)), []);

  // Arrow keys turn the pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const dark = paper === "slate" || paper === "black";

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
      leftPage = from >= 1 ? pageAt(2 * from - 2) : null;
      rightPage = pageAt(2 * target - 1);
    } else {
      leftPage = pageAt(2 * target - 2);
      rightPage = pageAt(2 * from - 1);
    }
  } else if (target >= 1) {
    leftPage = pageAt(2 * target - 2);
    rightPage = pageAt(2 * target - 1);
  }

  // The turning leaf's two faces.
  const leafFront: FlatPage | null = coverFront
    ? null
    : dir === "next"
      ? pageAt(2 * from - 1)
      : pageAt(2 * from - 2);
  const leafBack: FlatPage | null =
    dir === "next" ? pageAt(2 * target - 2) : pageAt(2 * target - 1);

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
          {p.first && !p.empty && (
            <div
              className="chapter-opener reader-opener-link"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/book/${bookId}/chapter/${p.chapterId}`);
              }}
              role="link"
              tabIndex={0}
              title="Edit this chapter"
            >
              {p.label && <p className="chapter-label">{p.label}</p>}
              <h2 className="reader-title">{p.title}</h2>
            </div>
          )}
          {p.empty ? (
            <p className="reader-empty">This chapter is empty.</p>
          ) : (
            <div
              className={`tiptap${p.first ? "" : " reader-cont"}`}
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="relative">
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
          {target === 0
            ? "Cover"
            : `Pages ${target * 2 - 1}–${target * 2} of ${flat.length}`}
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
