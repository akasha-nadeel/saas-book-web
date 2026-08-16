"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { bookWordCount, findBook } from "@/lib/library-store";
import { PAGE_SIZES } from "@/lib/page-setup";
import {
  BLEED,
  estimatePages,
  inches,
  mm,
  PAPER,
  paperbackSpec,
  type PaperbackSpec,
  type PaperStock,
} from "@/lib/paperback";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Every number a paperback needs, worked out instead of guessed at.
 *
 * *"I'm just cursed when it comes to setting up paperbacks — it always takes
 * ten times as long as it should."* It takes ten times as long because four
 * numbers all depend on the page count and the page count is the last thing a
 * writer learns. None of it is hard. All of it is fiddly, and one wrong figure
 * means a rejected upload or a spine with the title printed off the edge.
 *
 * **The wrap is drawn to scale**, and that is the point of the screen rather
 * than a decoration on it. This was four numbers in four boxes, which is a
 * calculator — and a writer who has never made a cover does not know that the
 * width they are being given is *back, spine and front side by side*, nor that
 * the outer eighth of an inch is cut off. Seeing the shape answers both before
 * either becomes a reprint. The proportions come from the same `spec` the
 * numbers do, so the picture cannot disagree with them.
 *
 * **The page count is an input, with an estimate offered.** The real number
 * comes out of the exported PDF, because it depends on trim, type size, leading
 * and where every chapter happens to break — so the writer types what their PDF
 * says, and the estimate is there for before they have one.
 *
 * **It does not pretend to replace the shop's template**, and says so twice. A
 * printer's file is the one place being approximately right is worth nothing.
 * What this is for is knowing the numbers before you get there, and checking
 * that the template you were sent is the one you asked for.
 */
export function PaperbackPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [pages, setPages] = useState<string>("");
  const [stock, setStock] = useState<PaperStock>("white");

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  const size = PAGE_SIZES[book.page?.size ?? "6x9"];
  const words = bookWordCount(book);
  const estimated = estimatePages(words);
  const typed = Number(pages);
  const using = Number.isFinite(typed) && typed > 0 ? typed : estimated;
  const spec = paperbackSpec(using, size.width, size.height, stock);

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Paperback setup">
        Spine width, inside margin and the full cover wrap — four numbers that
        all depend on the page count, which is why this takes people an evening.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {/* ---- The two things it needs ---------------------------------- */}
        <section className="grid gap-4 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">Page count</span>
            <input
              type="number"
              min={1}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder={String(estimated || "")}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                         outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
            <span className="text-xs text-muted">
              {pages.trim()
                ? "From your exported PDF — the only figure that is exact."
                : `Estimated ${estimated.toLocaleString()} from ${words.toLocaleString()} words. Export the PDF and type the real one in.`}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">Paper</span>
            <select
              value={stock}
              onChange={(e) => setStock(e.target.value as PaperStock)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-fg"
            >
              {(Object.keys(PAPER) as PaperStock[]).map((key) => (
                <option key={key} value={key}>
                  {PAPER[key].label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Cream is thicker than white, so it changes the spine. Getting this
              wrong is what prints a title off the edge.
            </span>
          </label>
        </section>

        {/* Coloured, because these are the things a printer refuses. They were
            grey boxes indistinguishable from the notes around them. */}
        {spec.problems.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {spec.problems.map((problem) => (
              <li
                key={problem}
                className="flex gap-2.5 rounded-xl border border-note-line bg-note-bg
                           px-4 py-3 text-sm text-fg"
              >
                <span aria-hidden="true" className="font-bold text-note-fg">
                  !
                </span>
                {problem}
              </li>
            ))}
          </ul>
        )}

        {/* ---- The wrap and its arithmetic, side by side ----------------
            The drawing is a tall portrait rectangle and the figures are a
            short grid, so stacked they left half the screen empty beside the
            wrap and pushed the numbers under the fold — a reader checking a
            spine width against the picture of the spine had to scroll between
            the two. They are one thought: the shape, and where the shape came
            from. Paired only from `lg`, since below that the drawing needs the
            full width to stay legible at all. */}
        <div className="mt-8 grid gap-x-8 gap-y-8 lg:grid-cols-2 lg:items-start">
          <section>
            <h2 className="font-bold text-fg">The cover you send</h2>
            <p className="max-w-prose mt-1 text-sm text-muted">
              {/* Not "below" or "beside": the two columns stack under `lg`, so
                  either word is wrong at one width or the other. */}
              One image, this shape — not three files. Drawn to scale from the
              numbers shown.
            </p>
            <CoverWrap spec={spec} trimWidth={size.width} />
          </section>

          <section>
            <h2 className="font-bold text-fg">The numbers</h2>
            {/* Two across while there is room for two, one down the narrower
                column the split creates, and two again on a wide monitor. */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              <Figure
                label="Spine width"
                value={spec.spine}
                note={`${using.toLocaleString()} pages × ${PAPER[stock].perPage}″ per page`}
              />
              <Figure
                label="Inside margin (gutter)"
                value={spec.gutter}
                note="Grows with the page count, because a thick book does not open flat"
              />
              <Figure
                label="Cover width"
                value={spec.coverWidth}
                note={`Back ${size.width}″ + spine + front ${size.width}″ + bleed both sides`}
              />
              <Figure
                label="Cover height"
                value={spec.coverHeight}
                note={`Trim ${size.height}″ + bleed top and bottom`}
              />
            </div>

            <p className="max-w-prose mt-4 text-sm text-muted">
              Trim size is {size.label}, from this book&rsquo;s page setup.
              Outside margins need at least {spec.outsideMargin}″.
            </p>
          </section>
        </div>

        <p className="mt-8 rounded-xl border border-line bg-panel p-5 text-sm text-muted">
          <strong className="text-fg">Check these against the shop.</strong>{" "}
          These are Amazon KDP&rsquo;s published figures, and KDP will generate
          an exact template once it knows your page count. A printer&rsquo;s
          file is the one place where approximately right is worth nothing — use
          this to know the numbers before you get there, and to check that the
          template you were sent is the one you asked for.
        </p>

        <p className="mt-6 text-xs text-muted">
          The PDF this app exports is a clean interior file at your trim size
          with fonts embedded, page numbers, and a running head. It has no
          bleed, no crop marks and no CMYK — the browser writes the file, and
          those are not things it can put in one. If your printer asks for them,
          that step still needs another tool.
        </p>
      </div>
    </div>
  );
}

/**
 * The wrap, at its real proportions.
 *
 * Laid out with percentages rather than drawn as an SVG, so the labels stay at
 * a readable size instead of scaling with the artwork — a 6×9 wrap is nearly
 * 13 inches across, and text sized to fit that box would be unreadable at any
 * width this column has.
 *
 * The spine is the piece that is got wrong, so it is the piece that is
 * coloured. Below about a hundred pages it is genuinely a sliver — the label
 * moves out to the caption rather than being squeezed into two millimetres,
 * because a label that overflows its own panel is worse than one placed beside
 * it.
 */
function CoverWrap({
  spec,
  trimWidth,
}: {
  spec: PaperbackSpec;
  /** One panel's width. The height comes from the spec's own aspect ratio. */
  trimWidth: number;
}) {
  const { coverWidth: W, coverHeight: H, spine } = spec;

  // Guard: a zero or negative spec would divide by zero below, and the page
  // reaches here with the problem already named above.
  if (!(W > 0) || !(H > 0)) return null;

  const trimSpan = trimWidth * 2 + spine;
  const pct = (part: number) => `${(part / trimSpan) * 100}%`;
  const spineShare = spine / trimSpan;

  return (
    <>
      <div
        className="mt-3 w-full max-w-xl rounded-lg border-2 border-dashed border-line bg-raised p-[1.4%]"
        style={{ aspectRatio: `${W} / ${H}` }}
        role="img"
        aria-label={`Cover wrap, ${inches(W)} by ${inches(H)} inches: back cover, a ${inches(spine)} inch spine, then the front cover, with ${BLEED} inch bleed all round.`}
      >
        <div className="flex h-full overflow-hidden rounded-sm">
          <Panel width={pct(trimWidth)} label="Back cover" />
          <div
            style={{ width: pct(spine) }}
            className="grid shrink-0 place-items-center border-x border-white/70 bg-accent/25"
          >
            {/* Only when there is room. Under about a tenth of the width the
                word cannot be set without spilling over the folds. */}
            {spineShare > 0.055 && (
              <span className="text-[10px] font-bold tracking-wide text-accent [writing-mode:vertical-rl]">
                Spine
              </span>
            )}
          </div>
          <Panel width={pct(trimWidth)} label="Front cover" />
        </div>
      </div>

      <p className="mt-2 max-w-xl text-xs text-muted">
        Dashed edge: {BLEED}″ of bleed, trimmed off — keep nothing you need to
        read inside it. The spine is {inches(spine)}″ ({mm(spine)} mm)
        {spineShare > 0.055
          ? ""
          : ", too narrow at this page count to carry text"}
        , and the whole wrap is {inches(W)}″ × {inches(H)}″.
      </p>
    </>
  );
}

function Panel({ width, label }: { width: string; label: string }) {
  return (
    <div
      style={{ width }}
      className="grid shrink-0 place-items-center bg-panel text-[11px] font-semibold text-muted"
    >
      {label}
    </div>
  );
}

/** One measurement, in both units, because not everyone thinks in inches. */
function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-sm font-bold text-fg">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-fg">
        {inches(value)}″
        <span className="ml-2 text-base font-medium text-muted">
          {mm(value)} mm
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
