"use client";

/**
 * What this book spells more than one way.
 *
 * The one screen in the app that reads every chapter at once, because the
 * things it looks for are only findable that way: a chapter cannot disagree
 * with itself about a name, it disagrees with chapter four. Everything about
 * the layout follows from that — a finding is one decision the writer has to
 * make, so a finding is one card, with the chapters it touches inside it rather
 * than the other way round.
 *
 * The judgement all lives in `lib/consistency.ts`. The card, the picker and the
 * run bar are shared with the editor's panel, which is the same screen at a
 * quarter of the width; this file is the frame around them.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import { CheckPicker } from "@/components/consistency/check-picker";
import { checksIn } from "@/lib/consistency-checks";
import { FindingCard } from "@/components/consistency/finding-card";
import { RunBar, ranLine } from "@/components/consistency/run-bar";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { namesOf } from "@/lib/bible";
import { bookTextOf, readable } from "@/lib/book-text";
import {
  ALL_CHECKS,
  consistencyReport,
  withDismissal,
  withoutDismissal,
  type CheckId,
  type ConsistencyReport,
} from "@/lib/consistency";
import { findBook, saveConsistencyRaw } from "@/lib/library-store";
import { loadTypoWords } from "@/lib/typo-words";
import { plural } from "@/lib/plural";
import { toolShell, type ToolPageProps, toolMeasure } from "@/lib/tool-page";
import { useBible, useDismissals, useHydrated, useShelf } from "@/lib/use-library";

export function ConsistencyPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const bible = useBible(bookId);
  const dismissals = useDismissals(bookId);

  /**
    * **Nothing is ticked to begin with.**
    *
    * This started as all of them, on the argument that the first press should
    * do what the screen did before it had a picker. That is the wrong default
    * once there are ten: a writer who wants the names gets nine other cards
    * they did not ask for, and the way to a short answer is nine presses. An
    * empty picker asks the question the screen is for — what do you want
    * looked at — and the Run button says `Pick a check` until it has one.
    */
   const [picked, setPicked] = useState<ReadonlySet<CheckId>>(() => new Set());
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  /** Whether the findings are on screen, or the picker is. */
  const [showing, setShowing] = useState(false);

  // Counted before the press, so the button can say what it is about to read.
  const toRead = useMemo(() => (book ? readable(book).length : 0), [book]);

  const run = () => {
    if (!book || picked.size === 0) return;
    setRunning(true);
    /*
     * **The pressed state has to paint before the work starts.**
     *
     * Reading every chapter is a few hundred milliseconds on a long book,
     * nearly all of it `JSON.parse` and `toBlocks` rather than the checks. Run
     * straight from the handler it is a few hundred milliseconds in which the
     * button looks broken, which is worse than a slow answer.
     */
    /*
     * **The word list is fetched here, and only when it is wanted.**
     *
     * It is a megabyte, and every other check needs nothing. Awaiting inside
     * the frame keeps the pressed state painted first — the button already
     * reads "Reading N chapters…" while this happens. A failure comes back as
     * null and the run goes ahead without it; `consistencyReport` then leaves
     * that check out of `ran` rather than reporting it as having found nothing.
     */
    requestAnimationFrame(async () => {
      const words = picked.has("typos") ? await loadTypoWords() : null;
      const known = bible.map((entry) => namesOf(entry));
      setReport(
        consistencyReport(bookTextOf(book), {
          known,
          only: [...picked],
          ...(words ? { words } : {}),
        }),
      );
      setShowing(true);
      setRunning(false);
    });
  };

  const clear = () => {
    setReport(null);
    setShowing(false);
    setPicked(new Set());
  };

  /*
   * Dismissals are applied here rather than passed into the report, so putting
   * one back is instant and does not mean reading the book again.
   */
  const setAside = useMemo(
    () => new Set(dismissals.map((row) => row.key)),
    [dismissals],
  );

  /*
   * **The quiet ones sink; they do not vanish.** A finding the writer has
   * answered stays where they can see they answered it, and the switch that
   * put it there is the switch that takes it back. This replaced a `<details>`
   * at the foot of the screen holding a second list with a second control.
   */
  const ordered = useMemo(() => {
    const findings = report?.findings ?? [];
    return [
      ...findings.filter((f) => !setAside.has(f.key)),
      ...findings.filter((f) => setAside.has(f.key)),
    ];
  }, [report, setAside]);

  const live = ordered.filter((f) => !setAside.has(f.key)).length;

  const setQuiet = (key: string, next: boolean) =>
    saveConsistencyRaw(
      bookId,
      JSON.stringify(
        next ? withDismissal(dismissals, key) : withoutDismissal(dismissals, key),
      ),
    );

  // The app's splash is for the app; in a panel it would cover half the window.
  if (!hydrated)
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-[var(--oc-layout-height)] place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Consistency check"
          title="What this book spells two ways"
          width="7xl"
        >
          A name that changed spelling in chapter thirty is invisible from inside
          a draft, because nobody reads their own book straight through. This
          reads every chapter at once and says where each spelling is.
        </ToolHeader>
      )}

      <div
        className={`@container ${toolMeasure(embedded)} pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6`}
      >
        {heading}

        {toRead === 0 ? (
          <p className="max-w-2xl text-muted">
            Nothing written yet in the body of this book. There is nothing to
            read across.
          </p>
        ) : !showing ? (
          <section>
            {/* Unboxed: this is the screen's own opening sentence and the
                choice that follows it, not a card among cards. */}
            <p className="mb-4 max-w-2xl text-base leading-relaxed text-fg/80">
              Every chapter at once, over{" "}
              <strong className="font-semibold text-fg">
                {plural(toRead, "chapter")}
              </strong>
              . Pick what to look for. There are {ALL_CHECKS.length}, and
              running one on its own is how you work through a book.
            </p>
            <CheckPicker
              picked={picked}
              onToggle={(id) =>
                setPicked((was) => {
                  const next = new Set(was);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onAll={() => setPicked(new Set(ALL_CHECKS))}
              onNone={() => setPicked(new Set())}
              onGroup={(group, on) =>
                setPicked((was) => {
                  const next = new Set(was);
                  for (const check of checksIn(group)) {
                    if (on) next.add(check.id);
                    else next.delete(check.id);
                  }
                  return next;
                })
              }
              onRun={run}
              running={running}
              toRead={toRead}
              onBack={report ? () => setShowing(true) : undefined}
            />
          </section>
        ) : (
          report && (
            <>
              <RunBar
                report={report}
                running={running}
                warning={
                  picked.has("typos") && !report.ran.includes("typos")
                    ? "The word list could not be loaded, so the near-miss check did not run."
                    : undefined
                }
                onBack={() => setShowing(false)}
                onClear={clear}
                onAgain={run}
              />

              {ordered.length === 0 ? (
                <Nothing report={report} />
              ) : (
                <>
                  <p className="mt-5 mb-2 px-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {live === ordered.length
                      ? `Findings · ${ordered.length}`
                      : `Findings · ${live} of ${ordered.length}`}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {ordered.map((finding) => (
                      <FindingCard
                        key={finding.key}
                        bookId={bookId}
                        finding={finding}
                        quiet={setAside.has(finding.key)}
                        onQuiet={setQuiet}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )
        )}

        {/* **The standing refusal, said once at the foot.** Every one of these
            is a decision somebody made on purpose at least once, and a screen
            that forgets to say so is a screen that has started grading a
            manuscript. */}
        <div className="mt-10 border-t border-line pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            There is no score here and no count of &ldquo;errors&rdquo;. A second
            character really can have a name one letter from the first, English
            really does write <em>a well-known writer</em> as <em>well known</em>,
            and a word repeated twice can be the whole point of the line. This
            looks for {ALL_CHECKS.length} specific things across the whole book
            — the one place they are findable, and the one place you cannot check
            by reading your own draft. What it finds is a list of places to look, and nothing here
            changes a word. For repeated words inside a single chapter, the prose
            report is the other half.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The empty answer, which is the one the house rules are strictest about.
 *
 * It has to say what ran. "Nothing found" over a check that never read anything
 * is the same sentence as "nothing found" over a check that read the whole
 * book, and only one of them is true — and now that a writer can choose, "six
 * checks found nothing" over two checks is a third way to say it wrongly.
 */
function Nothing({ report }: { report: ConsistencyReport }) {
  if (report.ran.length === 0) {
    return (
      <section className="mt-5">
        <p className="text-base font-semibold text-fg">Nothing was checked.</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          No check was picked, so nothing was looked for. This is not a result
          about the book.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <p className="text-base font-semibold text-fg">Nothing came back.</p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {ranLine(report)}, over {plural(report.chapters, "chapter")} and{" "}
        {plural(report.words, "word")}. That is not praise — these are specific
        things, and a book can be inconsistent in ways none of them looks at.
      </p>
    </section>
  );
}
