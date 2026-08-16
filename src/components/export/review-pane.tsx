"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  buildMarkdownFile,
  loadChapters,
  type Format,
} from "@/lib/export";
import type { LoadedChapter } from "@/lib/export/blocks";
import { printDocument } from "@/lib/export/print";
import { escapeXml } from "@/lib/export/xhtml";
import { trimById, type TypesetOptions } from "@/lib/export/typeset";
import { withoutReplaced, writtenPages } from "@/lib/export/front-matter";
import type { Book } from "@/lib/library-store";

/**
 * The book as the file will have it, before the file exists.
 *
 * **Every one of these renders the real artifact, and that is the whole design
 * rather than a detail of it.** A preview assembled from its own code path
 * agrees with the export on the day it is written and quietly stops agreeing
 * afterwards — which is the one failure a "check before you export" cannot
 * have, because a writer who has checked stops looking. So:
 *
 * - **PDF** is the finished file, fetched from `/api/export/pdf` — the same
 *   call the export makes, the same bytes — and drawn by Chrome's own viewer.
 *   Not a second pagination of it: see the note on that pane.
 * - **Word** is the real `.docx`, built and then read back by `docx-preview`.
 *   Nothing describes the file second-hand: the bytes are made and rendered.
 * - **EPUB** is the XHTML the packager puts in the file, under the book's own
 *   typography.
 * - **Markdown** is the text that will be written, shown as text.
 *
 * **What this is not is a *device* preview, and each pane says so for
 * itself.** Building the real artifact settles what is *in* the file — the
 * pages, their order, the stylesheet, the metadata. It cannot settle what the
 * file will *look like* wherever it is opened, and for two of the four that
 * gap is real: an e-reader substitutes its own font, spacing and margins and
 * picks its own page, and `docx-preview` is a viewer rather than Word. The
 * other two have no gap at all — the PDF pane is the finished file drawn by a
 * PDF viewer, and Markdown is the text itself.
 *
 * So a caption here is not decoration. Each states what its pane can back and
 * stops: exact for PDF and Markdown, *structure rather than looks* for EPUB,
 * *content exact and layout close* for Word. A pane that let a writer believe
 * their Kindle would look like this screen would be the wrong kind of preview,
 * and the house rule is that a claim the code cannot back is cut rather than
 * reworded.
 *
 * **It owns no frame.** `PreviewSheet` is what puts it over the window, and
 * this is a flex column that fills whatever it is given — so the one thing a
 * caller owes it is a bounded height.
 */
export function ReviewPane({
  book,
  output,
  typeset,
  manuscript,
  cover,
}: {
  book: Book;
  output: Format;
  typeset: TypesetOptions;
  /** Word's manuscript furniture — the same flag the export takes. */
  manuscript: boolean;
  /**
   * The book's cover as a data URL.
   *
   * Only the EPUB pane wants it, and it wants it because that pane packages a
   * real file: a cover is a page in the spine, so a file built without one
   * would be a book one document short of the one it previews.
   */
  cover: string | null;
}) {
  /* Derived here the way `runExport` derives it, from the book and nothing
     else, so the review cannot be looking at a different set of chapters from
     the one about to be written. Memoised on the book: `loadChapters` parses
     every chapter's stored JSON, and re-parsing a forty-chapter novel on each
     keystroke elsewhere in the wizard is work nobody asked for.

     `single` is the whole-book case. The wizard exports a whole book — the
     per-chapter export is a different entry point — so there is no flag here
     to get out of step with. */
  /* Filtered exactly as `runExport` filters it, so the review is looking at the
     book the file will contain and not at a longer one. */
  const chapters = useMemo(
    () => withoutReplaced(loadChapters(book), typeset.replaceWritten),
    [book, typeset.replaceWritten],
  );

  /* Only the formats that generate front matter can have a generated page
     stand down, so only those carry the note. Word joined them on 2026-08-16;
     markdown builds no title, copyright or contents page of its own. */
  const written = useMemo(
    () => (output === "markdown" ? null : writtenPages(chapters)),
    [chapters, output],
  );

  /* A flex column rather than a stack with gaps: `PreviewSheet` gives this the
     whole window, and the stage inside takes whatever the note above it does
     not. `min-h-0` so it may shrink below its contents — without it a long book
     pushes the sheet's own header off the top. */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {written && <YoursInstead written={written} />}
      {output === "pdf" && (
        <PagedReview book={book} chapters={chapters} typeset={typeset} />
      )}
      {output === "docx" && (
        <DocxReview
          book={book}
          chapters={chapters}
          manuscript={manuscript}
          typeset={typeset}
        />
      )}
      {output === "epub" && (
        <EpubReview
          book={book}
          chapters={chapters}
          typeset={typeset}
          cover={cover}
        />
      )}
      {output === "markdown" && (
        <MarkdownReview book={book} chapters={chapters} single={false} />
      )}
    </div>
  );
}

const PAGE_NAMES: Record<string, string> = {
  title: "title page",
  copyright: "copyright page",
  contents: "contents page",
};

/**
 * Which generated pages stood down for one of the writer's own.
 *
 * **The front-matter step says this beside the switch; this says it beside the
 * result**, and the difference is where the question gets asked. A writer who
 * has written their own contents page is looking at *their* page numbers here
 * — typed by hand, and wrong the moment a chapter grows — while ours would
 * have carried the folios the chapters actually land on. Without this the
 * review reads as the feature failing rather than as their own page winning,
 * which is the report that came back from the person using it.
 *
 * A note rather than a warning: nothing is wrong, and a writer who wrote their
 * own meant it. So it says what is happening and how to hand the job back,
 * and claims nothing about which is better.
 */
function YoursInstead({ written }: { written: ReadonlySet<string> }) {
  const names = ["title", "copyright", "contents"]
    .filter((id) => written.has(id))
    .map((id) => PAGE_NAMES[id]);
  if (names.length === 0) return null;

  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div className="rounded-xl border border-note-line bg-note-bg px-4 py-3.5">
      <p className="font-sans text-sm font-semibold text-note-fg">
        {names.length === 1
          ? `This is your own ${list}`
          : `These are your own ${list}s`}
      </p>
      <p className="mt-1 font-sans text-xs leading-relaxed text-note-fg/80">
        {names.includes("contents page")
          ? "Your page is used as you wrote it, so the generated contents — the one that works the page numbers out from where the chapters actually land — stands down for it. Rename or delete your page to use ours instead."
          : "Your page is used as you wrote it, so the generated one stands down for it. Rename or delete your page to use ours instead."}
      </p>
    </div>
  );
}

/** The shell every pane sits in: one scrolling stage with a caption over it. */
function Stage({
  caption,
  zoom,
  bare = false,
  children,
}: {
  caption: React.ReactNode;
  /** Omitted by a pane with nothing to scale. */
  zoom?: Zoom;
  /**
   * For a pane that brings its own frame — which is the PDF one, since
   * Chrome's viewer paints its own dark ground, its own desk and its own
   * padding around the page. Ours underneath it is a grey border drawn around
   * a grey border, and the padding is a strip of book nobody gets to see.
   */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The caption and the zoom sit on one row: the sentence explains what is
          below, the controls act on it, and putting them anywhere else would
          separate a control from the thing it controls. The row is dropped
          entirely when there is neither — an empty 2rem strip above a page is
          2rem of page nobody gets to see. */}
      {(caption || zoom) && (
        <div className="mb-3 flex shrink-0 items-end justify-between gap-4">
          <p className="font-sans text-xs text-muted">{caption}</p>
          {zoom && <ZoomBar {...zoom} />}
        </div>
      )}
      {/* A grey desk, so the white of the page is the page rather than the
          screen. Bounded and scrolling: a four-hundred-page book cannot push
          the wizard's own controls off the bottom of the window.

          **It takes the height it is given rather than working one out**, and
          that changed on 2026-08-17 when the review left the wizard's flow for
          a sheet of its own. It used to be
          `clamp(20rem, calc(100dvh - 11rem), 64rem)` — the window less the
          action bar and the caption, with the step's heading and deck above
          allowed to scroll away. None of that chrome is here any more, so the
          arithmetic has nothing left to guess at: the sheet is a flex column
          and this is what is left of it. That is also the honest version,
          since the old sum was a guess at chrome that could change without
          this number changing with it.

          A real height either way, which is what `useFitToStage` needs — it
          measures this box to decide the scale, so a height that came from the
          contents would be a circle. `min-h-0` is what lets a flex item shrink
          below its content; without it a long book pushes the action bar off
          the window, which is the shape this replaced. */}
      <div
        className={`scroll-slim min-h-0 flex-1 overflow-auto rounded-xl
                    border border-line ${bare ? "" : "bg-raised p-4"}`}
      >
        {children}
      </div>
    </div>
  );
}

/** What `useZoom` hands the stage. */
type Zoom = {
  /** The scale to draw at: 1 is the page at its true size. */
  scale: number;
  percent: number;
  atFit: boolean;
  canIn: boolean;
  canOut: boolean;
  In: () => void;
  Out: () => void;
  toFit: () => void;
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.25;

/**
 * The reader's own scale, over the top of the fitted one.
 *
 * **Fit is the default, not a mode you have to ask for**, which is why the
 * state starts `null` rather than at 1. A preview's first duty is to show the
 * whole page; wanting a closer look at the type is the second thing anybody
 * does, and every document reader offers it. Pressing in or out from the
 * fitted scale simply continues from wherever that landed, so the ladder has
 * no fixed rungs and cannot jump on the first press.
 *
 * The number shown is the true one — 100% is the page at the size it will be
 * printed or read at, not "however big the box happens to make it". A
 * percentage that meant something different on every window would be worth
 * less than no percentage at all.
 */
function useZoom(fit: number): Zoom {
  const [chosen, setChosen] = useState<number | null>(null);
  const scale = chosen ?? fit;

  const to = (next: number) =>
    setChosen(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));

  return {
    scale,
    percent: Math.round(scale * 100),
    atFit: chosen === null,
    canIn: scale < ZOOM_MAX - 0.001,
    canOut: scale > ZOOM_MIN + 0.001,
    In: () => to(scale * ZOOM_STEP),
    Out: () => to(scale / ZOOM_STEP),
    toFit: () => setChosen(null),
  };
}

/** Out, the figure, in, and the way back to a whole page. */
function ZoomBar({ percent, atFit, canIn, canOut, In, Out, toFit }: Zoom) {
  const button =
    "flex h-7 w-7 items-center justify-center rounded-md border border-line " +
    "font-sans text-sm text-fg transition-colors hover:bg-raised " +
    "disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={Out}
        disabled={!canOut}
        className={button}
        aria-label="Zoom out"
      >
        −
      </button>
      {/* Tabular figures, or the row jostles as the number changes width. */}
      <span className="w-11 text-center font-sans text-xs tabular-nums text-muted">
        {percent}%
      </span>
      <button
        type="button"
        onClick={In}
        disabled={!canIn}
        className={button}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={toFit}
        disabled={atFit}
        className="ml-1 rounded-md border border-line px-2 py-1 font-sans text-xs
                   font-semibold text-fg transition-colors hover:bg-raised
                   disabled:opacity-35 disabled:hover:bg-transparent"
      >
        Fit
      </button>
    </div>
  );
}

function Working({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-8 font-sans text-sm text-muted">
      <Spinner />
      {what}
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="px-1 py-8 font-sans text-sm"
      style={{ color: "var(--color-danger)" }}
    >
      {message}
    </p>
  );
}

/**
 * Shrink a stack of real pages until one fits the stage across.
 *
 * **Scaled to the column, and measured rather than guessed.** A page box is its
 * real printed size — 794px across for A4, and whatever the writer's trim comes
 * to — while the wizard's column is narrower than that, so at true size the
 * writer gets a horizontal scrollbar and a screenful of one page's margin.
 * There is no honest constant to use instead: the trim is the writer's own
 * setting and the column moves with the window.
 *
 * Three things in it are load-bearing:
 *
 * - **`zoom`, not a transform.** A transform leaves the element's original
 *   height behind, so the stage would scroll through a book's worth of empty
 *   space under the last page.
 * - **Neither measurement is taken through the zoom**, which is the whole
 *   reason for the two elements. `zoom` scales the coordinate system inside the
 *   element it is on, so a page's rect and the box holding it both come back in
 *   scaled units and their ratio no longer says what fraction of the room the
 *   page needs — measure through it and every pass shrinks the page again. So
 *   the *room* is an outer element that is never zoomed, and the page's true
 *   width is recorded by the caller at the one moment it is known: after the
 *   pages exist and before any scale is applied.
 * - **A `ResizeObserver` rather than a one-shot measure.** The wizard's column
 *   moves with the window, and a scale worked out once is wrong the moment
 *   somebody resizes. It also fires on `observe`, so the first fit costs no
 *   extra pass.
 *
 * **Both dimensions bind, which is what makes a page a whole page.** Fitting
 * the width alone left the top and bottom of every page outside the box —
 * a preview of a page that never showed one. So the scale is the smaller of
 * what the width allows and what the height allows, which is the "fit page"
 * every PDF reader offers and the only setting under which somebody can check
 * a title page's balance or see where a chapter opening sits on the sheet.
 * Whichever way round the two come out, the page is whole; a portrait page in
 * a wider box simply leaves a margin either side, as it does in a reader.
 */
function useFitToStage(
  /** The unzoomed box the pages have to fit inside. */
  room: React.RefObject<HTMLDivElement | null>,
  /** The page's size before anything scaled it, in CSS pixels. */
  natural: React.RefObject<{ w: number; h: number }>,
  ready: boolean,
): number {
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const box = room.current;
    if (!ready || !box) return;

    const watch = new ResizeObserver(() => {
      const { w, h } = natural.current;
      if (w <= 0) return;
      /* A height of nought means "no height to fit" rather than an unmeasured
         one — the markdown pane is a column of text that runs as long as it
         runs, so only its measure binds. Left as a division it would be
         `Infinity`, which `Math.min` would ignore anyway; stated, it is a
         decision rather than an accident. */
      const byHeight = h > 0 ? box.clientHeight / h : Infinity;
      setFit(Math.min(1, box.clientWidth / w, byHeight));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, [room, natural, ready]);

  return fit;
}

/**
 * Off-screen, but *laid out*.
 *
 * **`display: none` is not a slower layout here, it is a failed one.** Paged.js
 * decides where every page ends by measuring the real box with
 * `getBoundingClientRect`, and inside a hidden container every rect is zero —
 * measured, it lays two pages and then throws
 * `Cannot read properties of null` out of its own `Layout` constructor. So the
 * pages are always in flow while they are being set, and parked out of sight
 * instead. Exactly the reason `printBook`'s iframe is 1200×900 at
 * `left:-10000px` rather than 0×0, and the note there says the same thing.
 */
const OFF_SCREEN: React.CSSProperties = {
  position: "fixed",
  left: -10000,
  top: 0,
  width: 1200,
};

/**
 * The PDF itself, rendered by the same route the export uses.
 *
 * **It re-ran the pagination in this page until 2026-08-17, and the re-run was
 * wrong.** Paged.js truncates a long generated contents list when it lays out
 * inside the application's own document — measured on a 45-chapter book, five
 * entries shown against forty-five in the file, and a page count one short
 * because the contents never overflowed onto its second sheet. Everything else
 * agreed. The cause is somewhere in its chunker reacting to this document;
 * `display: flex` on the leader, `target-counter`, the anchors, the list
 * markup, `list-item` display, the contents' own CSS, break-avoid, page size,
 * the title page's flex layout, Tailwind's `box-sizing` reset and the
 * stylesheet scoping were each removed and re-measured, and none of them is it.
 *
 * So this stopped guessing at the file and started showing it. `/api/export/pdf`
 * renders the book in a browser that has nothing else on it — the same call the
 * export makes, byte for byte the same file — and Chrome draws it natively.
 * That is what the note at the top of this module always claimed for the other
 * three panes: *the real artifact, not a picture of one*. It also means this
 * pane can never drift again, because there is no second code path left to
 * drift.
 *
 * The cost is honest and worth stating: opening the preview renders the book on
 * the server, so a writer who previews and then exports pays for two renders.
 * That is the price of a preview that cannot lie.
 *
 * **The page count is gone from the caption.** It was read off the pagination
 * this pane used to run; Chrome's viewer prints the real one in its own toolbar,
 * and a number quoted here would be a second answer to a question the file has
 * already answered.
 */
function PagedReview({
  book,
  chapters,
  typeset,
}: {
  book: Book;
  chapters: LoadedChapter[];
  typeset: TypesetOptions;
}) {
  /*
   * **One identity per run, and the state carries it.**
   *
   * Resetting to "working" from the effect body would be a second render on
   * every settings change, and — the half that matters — between the change and
   * that reset the pane would still be showing the *previous* book's PDF as
   * though it were the new one. Keyed instead: a result belongs to the run that
   * produced it, and anything from an older run simply is not this run's, so
   * the pane reads as working until the new file lands.
   */
  const run = useMemo(
    () => [book, chapters, typeset] as const,
    [book, chapters, typeset],
  );
  const [result, setResult] = useState<{
    run: object;
    url: string | null;
  } | null>(null);

  const done = result?.run === run && result.url !== null;
  const failed = result?.run === run && result.url === null;

  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const trim = trimById(typeset.trim);
        const response = await fetch("/api/export/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...printDocument(book, chapters, typeset),
            title: book.title,
            width: trim.width,
            height: trim.height,
          }),
        });
        if (!response.ok) throw new Error(`the route answered ${response.status}`);

        const blob = await response.blob();
        if (!blob.size) throw new Error("the route answered with nothing");
        /* Superseded or unmounted: drop it rather than paint a book nobody is
           looking at, and never leak the object URL. */
        if (!live) return;

        objectUrl = URL.createObjectURL(blob);
        setResult({ run, url: objectUrl });
      } catch (err) {
        if (!live) return;
        // Worth the console: this is the same route the export uses, so a
        // failure here is a failure the writer is about to meet again.
        console.error("[review] the PDF could not be rendered", err);
        setResult({ run, url: null });
      }
    })();

    return () => {
      live = false;
      // Revoked on the way out, or every settings change leaks a book.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book, chapters, typeset, run]);

  return (
    <Stage
      /* Nothing to say once the file is on screen: it is the file, Chrome's
         own toolbar is over it with the page count and the zoom, and a
         sentence there would be describing a thing the writer is looking
         at. While it is being laid out there is nothing to look at, so the
         caption carries the only news there is. */
      caption={done ? null : "Laying the book out on pages…"}
      // Chrome's viewer is a desk of its own — see `bare`.
      bare
    >
      {/* Padded here rather than by the stage, which is `bare` for the
          viewer's sake — these two are the only things in this pane that are
          not the file. */}
      {!done && !failed && (
        <div className="px-4">
          <Working what="Setting the pages…" />
        </div>
      )}
      {failed && (
        <div className="px-4">
          <Failed message="That PDF could not be laid out. If you press Export it will fail the same way — the two use the same renderer." />
        </div>
      )}
      {/* **Chrome's own PDF viewer, toolbar and all.** Hiding it with
          `#toolbar=0` made the pane look like the others and cost the two
          things a reader of a PDF actually wants: the page count and a zoom.
          The count matters here more than most — this pane used to print one in
          its caption, taken from the pagination it ran itself, and that number
          was wrong (65 against the file's 66). The viewer's is the file's own.
          `view=Fit` opens on a whole page rather than a slice of one, which is
          what a writer checking their layout is looking for. `title` because an
          iframe without one is an unnamed region to a screen reader. */}
      {done && result?.url && (
        <iframe
          title={`${book.title} as a PDF`}
          src={`${result.url}#view=Fit`}
          className="h-full w-full rounded-xl border-0 bg-sheet"
        />
      )}
    </Stage>
  );
}

/**
 * The Word file, built and then read back.
 *
 * `docx-preview` renders the actual `.docx` — so what is on screen has been
 * through the packager, the same bytes an editor or an agent would open. It is
 * loaded on demand for the reason every other heavy library here is.
 */
function DocxReview({
  book,
  chapters,
  manuscript,
  typeset,
}: {
  book: Book;
  chapters: LoadedChapter[];
  manuscript: boolean;
  typeset: TypesetOptions;
}) {
  const host = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  // A Word page is its printed size too — see `useFitToStage`.
  const fit = useFitToStage(room, natural, state === "done");
  const zoom = useZoom(fit);

  useEffect(() => {
    const into = host.current;
    if (!into) return;

    let live = true;
    into.replaceChildren();
    setState("working");

    void (async () => {
      try {
        const [{ buildDocx }, docxPreview] = await Promise.all([
          import("@/lib/export/docx"),
          import("docx-preview"),
        ]);
        const blob = await buildDocx(book, chapters, { manuscript, typeset });
        if (!live) return;
        await docxPreview.renderAsync(blob, into, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreLastRenderedPageBreak: false,
        });
        if (!live) return;
        // Before anything scales it — see `useFitToStage`.
        const first = into.querySelector("section")?.getBoundingClientRect();
        natural.current = { w: first?.width ?? 0, h: first?.height ?? 0 };
        setState("done");
      } catch {
        if (live) setState("failed");
      }
    })();

    return () => {
      live = false;
    };
  }, [book, chapters, manuscript, typeset]);

  return (
    <Stage
      zoom={state === "done" ? zoom : undefined}
      caption={
        manuscript
          ? "The real .docx, opened back up by a viewer rather than by Word — so the content is exact and the layout is close. Set in manuscript format: double spaced, with the running header agents ask for."
          : "The real .docx, opened back up by a viewer rather than by Word — so the content is exact and the layout is close."
      }
    >
      {state === "working" && <Working what="Building the Word file…" />}
      {state === "failed" && (
        <Failed message="That file could not be shown here. The export itself is unaffected — you can still produce it and open it in Word." />
      )}
      {/* Parked off-screen rather than hidden while it builds, and scaled from
          an outer box that is never scaled itself — both for the reasons the
          PDF pane gives. */}
      <div ref={room} className="h-full">
        <div
          ref={host}
          style={state === "done" ? { zoom: zoom.scale } : OFF_SCREEN}
        />
      </div>
    </Stage>
  );
}

/**
 * The paper the EPUB's own pages are drawn on.
 *
 * Literal values rather than the `--color-sheet` tokens, because an iframe
 * inherits no custom properties from the page that wrote it. Safe to repeat:
 * those two tokens are stated *identically* in both theme blocks, for the
 * standing reason that drawn artwork of a real object stays literal — what
 * leaves this app is dark ink on light paper for every reader, so a preview
 * that turned charcoal after sunset would be a picture of a file nobody will
 * open. If `globals.css` ever moves them, move these.
 */
const SHEET = "#fcfbf7";
const SHEET_INK = "#1f1d1a";
/** The sheet's own hairline. Without it two off-whites a gap apart do not read
 *  as two documents — the desk behind is near-white too, so the seam between
 *  one sheet and the next was a line you had to look for. */
const SHEET_EDGE = "#d9d7d0";

/**
 * The reading pane the EPUB is shown in, in CSS pixels.
 *
 * **Fixed, and that is the fix.** The sheets were sized in `rem` and `vh`,
 * both of which the *window* decides — so browser zoom, which changes how many
 * CSS pixels the window holds, changed the shape of the page. Zoomed out, the
 * viewport grew and the sheet grew tall and slender; zoomed in, `42rem`
 * outran the frame and the same sheet came out squat and full-bleed with the
 * type looming. A preview whose page changes proportion depending on the
 * reader's zoom is not showing them their book.
 *
 * So the frame is a box of a fixed size and everything inside it — the sheet,
 * the measure, the type against the margins — is laid out against that box and
 * nothing else. The window can then only decide how big the whole picture is
 * drawn, never its shape, which is exactly the arrangement the PDF pane has
 * had all along. It is scaled to fit by the same hook, capped at 1 so it never
 * grows past its natural size and simply sits centred in a large stage.
 *
 * The proportions are a reading screen's rather than a sheet of paper's,
 * because that is what an EPUB is read on, and the width is chosen for the
 * measure: at the templates' 11pt body this leaves a line of about sixty
 * characters, which is the range a book is set in.
 */
const PANE = { w: 620, h: 880 };

/** Every `src` on an `<img>`, so a document's pictures can be loaded before it
 *  is rewritten. Cheap and good enough: the markup is our own, one attribute
 *  per tag, always double-quoted, written by `blocksToXhtml`. */
const IMG_SRC = /<img[^>]+src="([^"]+)"/g;
/** A scheme — `https:`, `data:` — which is what tells a package path from a
 *  reference to somewhere else entirely. */
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The frame the file's own documents are shown in.
 *
 * The stylesheet is the one **out of the zip** rather than a fresh
 * `typesetCss` call, which is the point of the whole pane: what styles these
 * sheets is the file that will be uploaded. What follows it is preview chrome
 * only, and it is deliberately the last word so it cannot be mistaken for part
 * of the book's own styling — the sheets, the grey between them, and a guard
 * on pictures so an oversized one cannot push a column sideways.
 *
 * **The language is on the `<html>`, and it is not decoration.** The
 * stylesheet sets `text-align: justify` and `hyphens: auto` together, and a
 * browser cannot hyphenate without knowing what language it is reading — so a
 * frame with no `lang` sets the book justified and *unhyphenated*, which on a
 * narrow column stretches the spaces instead of breaking the words. Measured in
 * Chrome on one paragraph at 180px: 108px tall with no language against 90px
 * with `lang="en"`, five lines instead of six. The file's own documents all
 * carry it; this frame takes their bodies and leaves their `<html>` behind, so
 * it has to be carried across by hand. Omitted rather than guessed at when a
 * document declares none: hyphenating a Finnish novel by English rules is worse
 * than not hyphenating it.
 *
 * The markup is ours: written by our own packager out of the writer's document
 * and escaped on the way through, then parsed and re-serialised by `DOMParser`,
 * which is the strictest thing it passes through. Nothing here comes from a
 * model or off the network — and the frame is sandboxed regardless.
 */
function frameHtml(
  css: string,
  sheets: readonly string[],
  lang: string | null,
): string {
  const chrome = `
html { background: transparent; }
body { margin: 0; padding: 10px 10px 0; background: transparent; color: ${SHEET_INK}; }
.oc-file {
  background: ${SHEET};
  margin: 0 0 1.25rem;
  padding: 3em 3em 4em;
  border: 1px solid ${SHEET_EDGE};
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
  /* **A sheet is at least a screenful, and that is a claim this can make.**
     Sized to content, a short document — a copyright notice, a dedication —
     came out as a stub a few lines tall between two full ones, which reads as
     a broken page rather than as a short one. The honest minimum is the
     *screen*: an e-reader has no page size either, and what it does have is a
     screen, on which every new document in the spine starts at the top of a
     fresh one. So each sheet fills the view and the next begins below it,
     which says "a new document starts here" without stating a page count
     nothing can know. Here that screen is a fixed box (see PANE), so this is
     a number rather than something the window can move — and it has to be a
     number rather than 100vh, because the frame is sized to its own contents
     so that the *stage* does the scrolling. Against a frame as tall as the
     book, a vh minimum would make every sheet as tall as the book and grow
     without end. Border-box, or the padding would be added on top of the
     minimum and overshoot by six ems. (No backticks in this comment: it sits
     inside a template literal and one would end the string.) */
  box-sizing: border-box;
  min-height: ${PANE.h - 30}px;
}
.oc-file > :first-child { margin-top: 0; }
img { max-width: 100%; height: auto; }`;

  const body = sheets
    .map((html) => `<div class="oc-file">${html}</div>`)
    .join("");

  /* Escaped even though it comes from our own builder, which took it from
     `publishing.language` — a field the writer types into. */
  const tagged = lang ? ` lang="${escapeXml(lang)}"` : "";

  return `<!doctype html><html${tagged}><head><meta charset="utf-8"/><style>${css}${chrome}</style></head><body>${body}</body></html>`;
}

/**
 * The EPUB's own documents, read back out of the finished file.
 *
 * **It builds the real `.epub` and opens the zip**, which it did not until
 * 2026-08-17: it rendered the XHTML `buildEpub` *would* write, under the
 * stylesheet it *would* write, in the order `bindBook` gives. All correct, and
 * all of it the same arithmetic run a second time — so three things the
 * packager does were invisible to it. `extractImages` lifting data URLs into
 * real `OEBPS/images/` entries was never exercised; the manifest and spine,
 * which decide what a reading system opens and in what order, were never read;
 * and `container.xml` was never followed. A preview cannot check the half of
 * the build it skips, and those are exactly the parts a shop's ingestion
 * breaks on. The other three panes had all moved to the real artifact; this
 * was the last one computing its own.
 *
 * It costs a build per visit, which is arithmetic in this browser and no
 * network at all — and it buys a **check**: every document goes through
 * `DOMParser`, so a file that is not well-formed XML says so here rather than
 * at the shop. That is `stripInvalidXml`'s guarantee, tested from the outside
 * for the first time.
 *
 * **No page count and no page furniture, deliberately** — and the caption
 * goes further than that now. An EPUB is reflowable: the reader's device picks
 * the page, the type size and usually the margins, so a number here would be a
 * fact about this screen dressed up as a fact about the file. What this pane
 * settles is the *structure* — which documents are in the book, in what order,
 * with which headings, under the stylesheet that really ships. What it cannot
 * settle is the appearance, because there is no single answer: Kindle converts
 * to its own format and substitutes a good deal, and every reader can change
 * the font under it. The caption says exactly that, because a writer who took
 * this screen for their Kindle would have been misled by a preview built to
 * stop precisely that.
 *
 * **It is an iframe, and that is a correctness fix rather than tidiness.** This
 * was a `<div>` with the file's stylesheet wrapped in `.oc-epub-preview { … }`
 * to scope it — which native CSS nesting turns into descendant selectors, so
 * every rule `typesetCss` writes for `body` became `.oc-epub-preview body` and
 * matched nothing. The result was a preview claiming to show the book's
 * typography while the body text fell through to the app's own sans-serif: the
 * headings were right, because `h1` nests to something real, and the prose —
 * the whole point — was not. A real document is the only place `body` means
 * body. It also stops the app's CSS leaking into a picture of a file it has
 * nothing to do with, which was the other half of the mess.
 *
 * **One sheet per file, not one long scroll.** An EPUB is a set of documents
 * and a reader opens each on a fresh screen; running them together put the
 * copyright notice directly under the author's name as though they shared a
 * page. Each spine document gets its own sheet here, which is what the file
 * actually contains.
 */
function EpubReview({
  book,
  chapters,
  typeset,
  cover,
}: {
  book: Book;
  chapters: LoadedChapter[];
  typeset: TypesetOptions;
  /** The book's cover as a data URL, so the packaged file carries one. */
  cover: string | null;
}) {
  const room = useRef<HTMLDivElement>(null);
  /* Constants rather than a measurement: the pane's size is the fixed thing
     here, and that is the whole point of it. */
  const natural = useRef(PANE);

  /* Keyed state rather than a bare `useState`, the shape `PagedReview` uses and
     for the same two reasons: setting state from an effect body is what the
     lint rule forbids, and a settings change must not leave the previous
     book's sheets on screen while the next file is built. */
  const run = useMemo(
    () => [book, chapters, typeset, cover] as const,
    [book, chapters, typeset, cover],
  );
  const [result, setResult] = useState<{
    run: object;
    doc: string | null;
  } | null>(null);
  const done = result?.run === run && result.doc !== null;
  const failed = result?.run === run && result.doc === null;

  useEffect(() => {
    let live = true;
    /* Every picture in the book becomes one of these, and they are why this
       effect has a cleanup worth reading: a blob URL is a reference the browser
       holds until it is told otherwise, so a writer changing the trim six times
       would leak six books' worth of artwork. */
    const urls: string[] = [];

    void (async () => {
      try {
        const [{ buildEpub }, { default: JSZip }, preview] = await Promise.all([
          import("@/lib/export/epub"),
          import("jszip"),
          import("@/lib/export/epub-preview"),
        ]);

        const file = await buildEpub(book, chapters, typeset, { cover });
        const zip = await JSZip.loadAsync(file);

        const read = async (path: string) => {
          const entry = zip.file(path);
          return entry ? entry.async("string") : null;
        };

        /* Followed rather than assumed — the whole reason for reading the file
           back is that a path this code already knows proves nothing. */
        const container = await read("META-INF/container.xml");
        const opfHref = container ? preview.opfPath(container) : null;
        const opf = opfHref ? await read(opfHref) : null;
        if (!opfHref || !opf) throw new Error("no package document");

        const root = preview.dirOf(opfHref);
        const css = await read(preview.joinPath(root, "style.css"));

        /* One blob URL per picture, made once and shared by every document that
           refers to it — which is the packager's own de-duplication showing
           through: a repeated ornament is one entry in the zip, so it is one
           URL here. */
        const pictures = new Map<string, string>();
        const picture = async (path: string) => {
          const held = pictures.get(path);
          if (held) return held;
          const entry = zip.file(path);
          if (!entry) return null;
          const url = URL.createObjectURL(await entry.async("blob"));
          urls.push(url);
          pictures.set(path, url);
          return url;
        };

        const sheets: string[] = [];
        /* The first document that declares one wins. Every document in one of
           our own EPUBs carries the same language, so this is a read rather
           than a vote — and a file that somehow carried two would be set in
           the one its first page names, which is the reading system's own
           behaviour. */
        let lang: string | null = null;

        for (const href of preview.spineHrefs(opf, opfHref)) {
          const xhtml = await read(href);
          if (xhtml === null) continue;
          lang ??= preview.documentLang(xhtml);

          /* Loaded ahead of the rewrite because `documentBody` is pure and
             synchronous while reading a zip entry is neither. Every relative
             `src` in the document is collected, fetched out of the zip, and
             then handed over from a map. */
          const here = preview.dirOf(href);
          const loaded = new Map<string, string>();
          for (const [, src] of xhtml.matchAll(IMG_SRC)) {
            // A data URL renders as it stands, and a remote one is the one kind
            // the packager leaves alone — see `documentBody`.
            if (src.startsWith("data:") || ABSOLUTE.test(src)) continue;
            const url = await picture(preview.joinPath(here, src));
            if (url) loaded.set(src, url);
          }

          const body = preview.documentBody(
            xhtml,
            (src) => loaded.get(src) ?? null,
          );
          /* Null means this document is not well-formed XML, which is a book no
             shop would take — so it fails loudly rather than quietly dropping a
             page out of the preview. */
          if (body === null) throw new Error(href + " is not well-formed");
          sheets.push(body);
        }

        if (sheets.length === 0) throw new Error("nothing in the spine");
        if (!live) return;
        setResult({ run, doc: frameHtml(css ?? "", sheets, lang) });
      } catch (err) {
        console.error("[export] could not read the EPUB back", err);
        if (live) setResult({ run, doc: null });
      }
    })();

    return () => {
      live = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [book, chapters, typeset, cover, run]);

  const srcDoc = done ? (result?.doc ?? "") : "";

  /* Measured only once the file is built and its frame is in flow. Passing
     `true` here would have the observer take the room's width while the
     `Working` line is the only thing in it, which is a different box. */
  const fit = useFitToStage(room, natural, done);
  const zoom = useZoom(fit);

  /**
   * How tall the frame has to be to hold the whole book without scrolling.
   *
   * **The frame must not scroll, so that the stage can.** Left at the pane's
   * own height it scrolled internally, which put its scrollbar *inside* the
   * desk, hard against the right edge of the sheet — and the stage's own
   * scrollbar beside it, two bars for one document. The PDF pane never had
   * that because its pages are laid into the stage directly. Growing the frame
   * to its contents gets the same arrangement here: one column of sheets on
   * the desk, one scrollbar, at the edge of the window where the other panes
   * put theirs.
   *
   * Measured rather than guessed, because only the frame knows how long the
   * book set out to be. A `ResizeObserver` on its document keeps it right when
   * the manuscript font lands and every line re-wraps a moment after load.
   */
  const frame = useRef<HTMLIFrameElement>(null);
  const [tall, setTall] = useState(PANE.h);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;

    let watch: ResizeObserver | null = null;

    const attach = () => {
      const doc = el.contentDocument;
      if (!doc) return;
      watch?.disconnect();
      // Fires once on `observe`, so the first measurement costs no extra pass —
      // and setting state from an observer is a subscription rather than the
      // synchronous effect-body write the lint rule refuses.
      watch = new ResizeObserver(() =>
        setTall(Math.max(PANE.h, doc.documentElement.scrollHeight)),
      );
      watch.observe(doc.documentElement);
    };

    // `srcDoc` can already have landed by the time this runs, in which case no
    // further load event is coming.
    el.addEventListener("load", attach);
    attach();
    return () => {
      el.removeEventListener("load", attach);
      watch?.disconnect();
    };
  }, [srcDoc]);

  return (
    <Stage
      zoom={done ? zoom : undefined}
      /* One line. It has two things to say and no room to say a third: that
         these sheets come out of the built file, and why there are no page
         numbers on them — an e-reader picks its own page, so a count here
         would be a fact about this screen. The long version of that second
         half is in the note above this function; a caption is not the place
         to argue it. */
      caption={
        done
          ? "The documents inside the finished .epub — the right pages, in the right order, with the file's own stylesheet. Trust it for structure rather than for looks: e-readers substitute their own font, spacing and margins, and each one picks its own page."
          : "Packaging the book…"
      }
    >
      {!done && !failed && <Working what="Building the EPUB…" />}
      {/* Only reachable if the file we have just written is not well-formed
          XML or has nothing in its spine — a book EPUBCheck would refuse and
          no shop would take. So it says the export is affected too, which is
          the opposite of what the Word pane says, and it is the truth in both
          cases: that one fails at the *viewer*, this one at the file. */}
      {failed && (
        <Failed message="That EPUB could not be read back after it was built, which means the file itself is wrong rather than the preview. Pressing Export would produce the same file — worth reporting." />
      )}
      {/* `items-start`, or a flex child shorter than the row would be stretched
          to it and the frame would scroll after all. */}
      <div
        ref={room}
        className="flex h-full items-start justify-center"
        hidden={!done}
      >
        {/* The scaled footprint. A transform paints smaller but reserves the
            element's original size, so the box that holds the frame carries the
            scaled numbers and the frame inside it keeps its own. Its height is
            the *measured* one, so the stage scrolls the whole book. */}
        <div
          style={{ width: PANE.w * zoom.scale, height: tall * zoom.scale }}
          className="shrink-0"
        >
          {/* **`allow-same-origin` and nothing else.** The frame has to be
              readable from here to be measured, and with no `allow-scripts`
              nothing can run inside it to make that a risk — no scripts, no
              forms, no navigation. The content is ours either way. */}
          <iframe
            ref={frame}
            title="The EPUB's pages"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            scrolling="no"
            style={{
              width: PANE.w,
              height: tall,
              transform: `scale(${zoom.scale})`,
              transformOrigin: "top left",
            }}
            className="border-0"
          />
        </div>
      </div>
    </Stage>
  );
}

/** The markdown that will be written, as text. */
function MarkdownReview({
  book,
  chapters,
  single,
}: {
  book: Book;
  chapters: LoadedChapter[];
  single: boolean;
}) {
  const text = buildMarkdownFile(book, chapters, { single });

  const room = useRef<HTMLDivElement>(null);
  /* A markdown file has no page, so the sheet is the *measure* — a plain-text
     column of a fixed width, which is the one thing that makes zooming it mean
     anything. Only the width binds: the text runs as long as it runs, so a
     height here would either crop the file or pad it with nothing. */
  const natural = useRef({ w: PANE.w, h: 0 });
  const fit = useFitToStage(room, natural, true);
  const zoom = useZoom(fit);

  return (
    <Stage
      zoom={zoom}
      /* It said "the first file… one is written per chapter", which is a claim
         about the export that the export does not honour: `buildMarkdownFile`
         writes the whole book into one `.md` with the title as an `h1` and
         each chapter an `h2`. A caption is held to what ships like any other
         line in this app. */
      caption={
        single
          ? "The chapter's own file, character for character."
          : "The file itself, character for character — the whole book in one .md, with each chapter a heading."
      }
    >
      <div ref={room} className="flex h-full justify-center">
        {/* `zoom` rather than a transform here, unlike the EPUB's frame: this
            is ordinary text, so zoom reflows it and the box keeps a real
            height. A transform would paint it smaller while reserving the
            unscaled height, and the stage would scroll through a screenful of
            nothing under a long file. */}
        <pre
          style={{ width: PANE.w, zoom: zoom.scale }}
          className="h-fit rounded border border-sheet-edge bg-sheet p-8
                     font-mono text-xs leading-relaxed whitespace-pre-wrap
                     text-sheet-ink shadow-sm"
        >
          {text}
        </pre>
      </div>
    </Stage>
  );
}
