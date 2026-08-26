"use client";

import { summaryPhrase, type ImportSummary } from "@/lib/import/split";

/**
 * The bar across the top after an import, until the writer decides.
 *
 * Chapter detection and ordering are a guess, so nothing is final the moment it
 * lands — this invites the writer to scroll the chapter list, check the order,
 * and either keep it or undo the whole import in one click. It sits above the
 * editor rather than in the sidebar so it survives the panel being collapsed.
 *
 * **It says what was decided, not just how much arrived.** "Imported 12
 * chapters" is true of a file whose twelve headings were eleven chapters and a
 * closing "END", and reads as a clean result — which is how somebody's novel
 * gained a chapter, and every chapter after it started printing a number one
 * too high. Three numbers cost a few words and give the writer something they
 * can disagree with: a novel with no front matter showing eight front pages is
 * visible in a way that a single total never was.
 *
 * A part with nothing in it is left out rather than printed as a zero — most
 * imports are chapters and nothing else, and "0 front pages" is noise on the
 * common case.
 */
export function ImportBanner({
  summary,
  leftOut,
  onUndo,
  onKeep,
}: {
  summary: ImportSummary;
  /** What the file held that did not belong to the part being imported into. */
  leftOut?: readonly string[];
  /**
   * Absent on the new-book path, which has no `ImportUndo` to call: undoing a
   * book that has just been created is deleting it, which the shelf already
   * does. An Undo that cannot honour itself is worse than no Undo, so that
   * banner reports and dismisses.
   */
  onUndo?: () => void;
  onKeep: () => void;
}) {
  /* Phrased in `split.ts` beside the counting, so this bar and the
     add-or-replace dialog cannot describe the same file differently. */
  const landed = summaryPhrase(summary);

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b
                 border-accent/40 bg-accent-deep/30 px-4 py-2.5 font-sans text-sm
                 text-fg md:px-6"
    >
      <span className="min-w-0 flex-1">
        Imported <span className="font-semibold">{landed}</span>.{" "}
        {/* **A filter nobody can see is worse than the problem it solves.** A
            section import uses only the part of a file that belongs to it, and
            saying so here is the only place a writer hears about it when the
            part was empty and no question was asked. */}
        {leftOut && leftOut.length > 0 && (
          <>
            Left out, as {leftOut.length === 1 ? "it is" : "they are"} not part
            of this section: <span className="font-semibold">{leftOut.join(", ")}</span>.{" "}
          </>
        )}
        {onUndo
          ? "Check the panel — undo if it isn’t right."
          : "Check the panel — anything in the wrong part can be moved there."}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="rounded-md px-3 py-1.5 font-medium text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={onKeep}
          className="rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-ink
                     outline-none transition-colors hover:bg-accent-strong
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {onUndo ? "Keep" : "Got it"}
        </button>
      </div>
    </div>
  );
}
