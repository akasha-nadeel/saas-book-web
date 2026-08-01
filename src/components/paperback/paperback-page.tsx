"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { bookWordCount, findBook } from "@/lib/library-store";
import { PAGE_SIZES } from "@/lib/page-setup";
import {
  estimatePages,
  inches,
  mm,
  PAPER,
  paperbackSpec,
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
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg">
          Paperback setup
        </h1>
        <p className="mt-3 text-muted">
          Spine width, inside margin and the full cover wrap. Four numbers that
          all depend on the page count, which is why this takes people an
          evening.
        </p>

        {/* ---- Inputs -------------------------------------------------- */}
        <section className="mt-8 grid gap-4 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2">
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

        {spec.problems.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {spec.problems.map((problem) => (
              <li
                key={problem}
                className="rounded-lg border border-line bg-panel p-4 text-sm text-fg"
              >
                {problem}
              </li>
            ))}
          </ul>
        )}

        {/* ---- The numbers --------------------------------------------- */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
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
        </section>

        <p className="mt-4 text-sm text-muted">
          Trim size is {size.label}, from this book&rsquo;s page setup. Outside
          margins need at least {spec.outsideMargin}″.
        </p>

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
          with fonts embedded. It has no bleed, no crop marks and no CMYK,
          because it comes from your browser&rsquo;s print engine — if your
          printer asks for those, that step still needs another tool.
        </p>
      </div>
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
