"use client";

/**
 * What was read, and the four ways out of a result.
 *
 * A status line about the run rather than a finding — one sentence and the
 * controls that act on it. Shared, so the panel and the full screen cannot
 * disagree about what a run consisted of.
 *
 * **Back keeps the results and Clear throws them away**, which is the whole
 * reason there are two. One control doing both means a writer who wanted to add
 * a check to the set loses the list they were working through, and finds that
 * out afterwards.
 */

import { ALL_CHECKS, type ConsistencyReport } from "@/lib/consistency";
import { plural } from "@/lib/plural";

/**
 * How many checks ran, said in the way that is true.
 *
 * Never the literal six. Three screens typed that number before a writer could
 * choose, and all three became wrong the moment one could.
 */
export function ranLine(report: ConsistencyReport): string {
  const ran = report.ran.length;
  return ran === ALL_CHECKS.length
    ? plural(ran, "check")
    : `${ran} of ${ALL_CHECKS.length} checks`;
}

export function RunBar({
  report,
  running,
  stale,
  warning,
  onBack,
  onClear,
  onAgain,
}: {
  report: ConsistencyReport;
  running: boolean;
  /** The book has been written in since this ran. */
  stale?: boolean;
  /**
   * Something a writer asked for that did not happen.
   *
   * Separate from `stale` because it is about the *run* rather than about the
   * book: the near-miss check needs a word list fetched, and a check that could
   * not run has to say so rather than be counted as one that found nothing.
   */
  warning?: string;
  onBack: () => void;
  onClear: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] font-semibold text-accent hover:underline"
      >
        ← Checks
      </button>

      <p className="min-w-0 text-xs text-muted">
        {ranLine(report)} · {plural(report.chapters, "chapter")} ·{" "}
        {plural(report.words, "word")}
        {report.usedBible && <> · names checked against your story bible</>}
        {stale && (
          /* Never quietly. A report that has stopped being true about the book
             says so, and the way to make a true one is the button beside it. */
          <span className="block text-note-fg">
            The book has changed since this ran.
          </span>
        )}
        {warning && <span className="block text-note-fg">{warning}</span>}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onAgain}
          disabled={running}
          className="rounded-[7px] bg-raised px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-fg disabled:opacity-60"
        >
          {running ? "Reading…" : "Again"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-[7px] px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-fg"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
