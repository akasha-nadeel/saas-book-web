"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  buildMarkdownFile,
  loadChapters,
  type Format,
} from "@/lib/export";
import type { LoadedChapter } from "@/lib/export/blocks";
import { dropPagedStyles, paginate, printDocument } from "@/lib/export/print";
import { toBlocks } from "@/lib/export/blocks";
import { blocksToXhtml, escapeXml } from "@/lib/export/xhtml";
import { typesetCss, type TypesetOptions } from "@/lib/export/typeset";
import {
  frontSections,
  withoutReplaced,
  writtenPages,
} from "@/lib/export/front-matter";
import { plural } from "@/lib/plural";
import type { Book } from "@/lib/library-store";

/**
 * The book as the file will have it, before the file exists.
 *
 * **Every one of these renders the real artifact, and that is the whole design
 * rather than a detail of it.** A preview assembled from its own code path
 * agrees with the export on the day it is written and quietly stops agreeing
 * afterwards — which is the one failure a "check before you export" step cannot
 * have, because a writer who has checked stops looking. So:
 *
 * - **PDF** is the actual Paged.js pagination, from `printDocument` — the same
 *   markup and stylesheet the print path hands the browser. The folios and the
 *   running heads are the ones the PDF will carry, because they were worked out
 *   here by the same engine.
 * - **Word** is the real `.docx`, built and then read back by `docx-preview`.
 *   Nothing describes the file second-hand: the bytes are made and rendered.
 * - **EPUB** is the XHTML the packager puts in the file, under the book's own
 *   typography.
 * - **Markdown** is the text that will be written, shown as text.
 *
 * What this is not is a *device* preview. An e-reader picks its own page, its
 * own font and often its own margins, so a page count for the EPUB would be
 * invented — see the note on the EPUB pane. The PDF's page count is real
 * because a PDF has real pages.
 */
export function ReviewPane({
  book,
  output,
  typeset,
  manuscript,
}: {
  book: Book;
  output: Format;
  typeset: TypesetOptions;
  /** Word's manuscript furniture — the same flag the export takes. */
  manuscript: boolean;
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

  /* Only the two formats that generate front matter can have a generated page
     stand down, so only those two carry the note. `docx` and `markdown` build
     no title, copyright or contents page of their own. */
  const written = useMemo(
    () => (output === "pdf" || output === "epub" ? writtenPages(chapters) : null),
    [chapters, output],
  );

  return (
    <div className="space-y-4">
      {written && <YoursInstead written={written} />}
      {output === "pdf" && (
        <PagedReview book={book} chapters={chapters} typeset={typeset} />
      )}
      {output === "docx" && (
        <DocxReview book={book} chapters={chapters} manuscript={manuscript} />
      )}
      {output === "epub" && (
        <EpubReview book={book} chapters={chapters} typeset={typeset} />
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
  children,
}: {
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 font-sans text-xs text-muted">{caption}</p>
      {/* A grey desk, so the white of the page is the page rather than the
          screen. Bounded and scrolling: a four-hundred-page book cannot push
          the wizard's own controls off the bottom of the window.

          **A real height rather than a `max-height`, and it is what lets a
          whole page be a whole page.** At `max-h-[60vh]` the box took its
          height from its contents and stopped at the cap, so a page — which is
          taller than that at any sensible scale — arrived cropped at the top
          and the bottom, which is the one thing a page preview must not be. A
          fixed box is also what `useFitToStage` needs: it measures this to
          decide the scale, so a height that came from the contents would be a
          circle.

          Sized off the window less only what is *permanently* on screen — the
          action bar, and room for the caption above. The heading, the deck and
          the stepper all scroll away with the column, so budgeting for them
          too (the first attempt took 21rem out) left a page at a third of its
          size in a box with half the window empty beneath it. Floored so it
          survives a short screen and capped so it does not become a wall on a
          tall one. */}
      <div
        style={{ height: "clamp(20rem, calc(100dvh - 11rem), 64rem)" }}
        className="scroll-slim overflow-y-auto rounded-xl border border-line
                   bg-raised p-4"
      >
        {children}
      </div>
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
      if (w <= 0 || h <= 0) return;
      setFit(Math.min(1, box.clientWidth / w, box.clientHeight / h));
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
 * The PDF, laid out by the engine that lays out the PDF.
 *
 * Rendered into *this* document rather than an iframe, which is why it needs no
 * style copying — see `paginate`. The styles Paged.js writes are global while
 * the pane is mounted, so they are taken out again on the way off the screen;
 * they are all scoped under its own `.pagedjs_*` classes, so nothing of the
 * app's is disturbed in the meantime.
 *
 * **Each run gets a box of its own inside the host**, rather than clearing the
 * host and rendering into it. React runs this effect twice in development, so
 * two Previewers can be in flight at once; sharing one container means the
 * second wipes the first's tree mid-layout and neither finishes. A run that is
 * superseded simply takes its own box away and the live one is untouched.
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
  const host = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [pages, setPages] = useState(0);
  const fit = useFitToStage(room, natural, state === "done");

  useEffect(() => {
    const into = host.current;
    if (!into) return;

    let live = true;
    let styles: HTMLStyleElement[] = [];
    const box = document.createElement("div");
    into.appendChild(box);
    setState("working");

    void paginate(printDocument(book, chapters, typeset), box)
      .then((flow) => {
        // Unmounted mid-layout, or the settings changed under it: throw the
        // work away rather than painting a book nobody is looking at.
        if (!live) {
          dropPagedStyles(flow.adoptedStyles);
          box.remove();
          return;
        }
        styles = flow.adoptedStyles;
        // Whatever a superseded run left behind goes now, not before: the host
        // has to hold a laid-out box the whole way through.
        for (const other of [...into.children]) {
          if (other !== box) other.remove();
        }
        // Recorded here because here is the one moment it is knowable: the
        // pages exist and nothing has scaled them yet. See `useFitToStage`.
        const first = box.querySelector(".pagedjs_page")?.getBoundingClientRect();
        natural.current = { w: first?.width ?? 0, h: first?.height ?? 0 };
        setPages(flow.pages);
        setState("done");
      })
      .catch((err) => {
        box.remove();
        // The writer is told, but the reason is worth having: this is somebody
        // else's layout engine and the message is the only thing that says why.
        console.error("[review] the pages could not be laid out", err);
        if (live) setState("failed");
      });

    return () => {
      live = false;
      dropPagedStyles(styles);
      box.remove();
    };
  }, [book, chapters, typeset]);

  return (
    <Stage
      caption={
        state === "done"
          ? `${plural(pages, "page")} at ${typeset.trim ? "your trim size" : "the page size you set"}. This is the pagination the PDF will have — the page numbers in the contents are the pages these chapters actually land on.`
          : "Laying the book out on pages…"
      }
    >
      {state === "working" && <Working what="Setting the pages…" />}
      {state === "failed" && (
        <Failed message="The pages could not be laid out. The export itself is unaffected — you can still produce the file." />
      )}
      {/* Two elements, and the outer one is never scaled — it is what says how
          much room there is. The inner is kept mounted *and laid out* through
          every state, because Paged.js needs a real box to measure against, so
          it is parked off-screen rather than hidden until the pages are set.
          See `OFF_SCREEN` and `useFitToStage`. */}
      <div ref={room} className="h-full">
        <div
          ref={host}
          className="oc-review-pages"
          style={state === "done" ? { zoom: fit } : OFF_SCREEN}
        />
      </div>
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
}: {
  book: Book;
  chapters: LoadedChapter[];
  manuscript: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  // A Word page is its printed size too — see `useFitToStage`.
  const fit = useFitToStage(room, natural, state === "done");

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
        const blob = await buildDocx(book, chapters, { manuscript });
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
  }, [book, chapters, manuscript]);

  return (
    <Stage
      caption={
        manuscript
          ? "The Word file itself, opened back up. Set in manuscript format — double spaced, with the running header agents ask for."
          : "The Word file itself, opened back up."
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
        <div ref={host} style={state === "done" ? { zoom: fit } : OFF_SCREEN} />
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

/**
 * The EPUB's own documents, under the book's own typography.
 *
 * **No page count and no page furniture, deliberately.** An EPUB is reflowable:
 * the reader's device picks the page, the type size and usually the margins, so
 * a number here would be a fact about this screen dressed up as a fact about
 * the file. The reading order, the front matter, the chapter openings and the
 * typography are all real — those are the things the file actually fixes.
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
}: {
  book: Book;
  chapters: LoadedChapter[];
  typeset: TypesetOptions;
}) {
  const room = useRef<HTMLDivElement>(null);
  /* Constants rather than a measurement: the pane's size is the fixed thing
     here, and that is the whole point of it. */
  const natural = useRef(PANE);
  const fit = useFitToStage(room, natural, true);

  /* Derived, not stored. This was `useState` filled from an effect, which is
     the pattern React's lint rule forbids and it was right to: the markup is a
     pure function of the book and the settings, so holding it in state buys a
     second render and a moment on screen with nothing in it. */
  const srcDoc = useMemo(() => {
    const files = [
      ...frontSections(book, chapters, typeset).map((s) => s.html),
      ...chapters.map((chapter) => {
        const number =
          chapter.number !== null
            ? `<p class="chapter-number">${chapter.number}</p>`
            : "";
        return `<section>${number}<h1>${escapeXml(chapter.title)}</h1>${blocksToXhtml(
          toBlocks(chapter.doc),
        )}</section>`;
      }),
    ];

    /* `typesetCss(_, false)` is the sheet that goes into the file — the same
       call `buildEpub` makes — so the type here is the type in the file. What
       follows it is preview chrome only, and it is deliberately the last word
       so it cannot be mistaken for part of the book's own styling: the sheets,
       the grey between them, and a guard on pictures so an oversized one
       cannot push a column sideways. */
    const css = `${typesetCss(typeset, false)}
html { background: transparent; }
body { margin: 0; padding: 0.6rem 0.6rem 0; background: transparent; color: ${SHEET_INK}; }
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
     a fixed height rather than something the window can move. Border-box, or
     the padding would be added on top of the minimum and overshoot by six
     ems. (No backticks in this comment: it sits inside a template literal and
     one would end the string.) */
  box-sizing: border-box;
  min-height: calc(100vh - 1.25rem);
}
.oc-file > :first-child { margin-top: 0; }
img { max-width: 100%; height: auto; }`;

    // The markup is ours: built by `blocksToXhtml` from the writer's own
    // document and escaped on the way through. Nothing here comes from a model
    // or off the network — and the frame is sandboxed regardless.
    return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${files
      .map((html) => `<div class="oc-file">${html}</div>`)
      .join("")}</body></html>`;
  }, [book, chapters, typeset]);

  return (
    <Stage caption="The documents the EPUB packages, each on its own sheet, in the book's own typography. No page numbers: an e-reader picks its own page, so a count here would be about this screen rather than about the file.">
      <div ref={room} className="flex h-full justify-center">
        {/* The scaled footprint. A transform paints smaller but reserves the
            element's original size, so the box that holds the frame carries the
            scaled numbers and the frame inside it keeps its own. */}
        <div
          style={{ width: PANE.w * fit, height: PANE.h * fit }}
          className="shrink-0"
        >
          {/* `sandbox` with no permissions: no scripts, no forms, no
              navigation. The content is ours, and a preview of a book has no
              business doing any of those things. */}
          <iframe
            title="The EPUB's pages"
            sandbox=""
            srcDoc={srcDoc}
            style={{
              width: PANE.w,
              height: PANE.h,
              transform: `scale(${fit})`,
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

  return (
    <Stage
      caption={
        single
          ? "The file itself, character for character."
          : "The first file, character for character. One is written per chapter."
      }
    >
      <pre
        className="scroll-slim overflow-x-auto rounded-lg bg-sheet p-6 font-mono
                   text-xs leading-relaxed whitespace-pre-wrap text-sheet-ink"
      >
        {text}
      </pre>
    </Stage>
  );
}
