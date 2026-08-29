"use client";

/**
 * What this book spells more than one way.
 *
 * The one screen in the app that reads every chapter at once, because the
 * things it looks for are only findable that way: a chapter cannot disagree
 * with itself about a name, it disagrees with chapter four. Everything about
 * the layout follows from that — a finding is one decision the writer has to
 * make, so a finding is one card, with the chapters it touches inside it
 * rather than the other way round.
 *
 * The judgement all lives in `lib/consistency.ts`. This draws it.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { namesOf } from "@/lib/bible";
import { bookTextOf, readable } from "@/lib/book-text";
import {
  consistencyReport,
  withDismissal,
  withoutDismissal,
  type ConsistencyFinding,
  type ConsistencyReport,
  type Variant,
} from "@/lib/consistency";
import { findBook, saveConsistencyRaw } from "@/lib/library-store";
import { plural } from "@/lib/plural";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";
import { useBible, useDismissals, useHydrated, useShelf } from "@/lib/use-library";

type Phase = "idle" | "running" | "done";

export function ConsistencyPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const bible = useBible(bookId);
  const dismissals = useDismissals(bookId);

  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<ConsistencyReport | null>(null);

  // Counted before the press, so the button can say what it is about to read.
  const toRead = useMemo(() => (book ? readable(book).length : 0), [book]);

  const run = () => {
    if (!book) return;
    setPhase("running");
    /*
     * **The pressed state has to paint before the work starts.**
     *
     * Reading every chapter is a few hundred milliseconds on a long book,
     * nearly all of it `JSON.parse` and `toBlocks` rather than the checks. Run
     * straight from the handler it is a few hundred milliseconds in which the
     * button looks broken, which is worse than a slow answer.
     */
    requestAnimationFrame(() => {
      const known = bible.map((entry) => namesOf(entry));
      setReport(consistencyReport(bookTextOf(book), { known }));
      setPhase("done");
    });
  };

  /*
   * Dismissals are applied here rather than passed into the report, so putting
   * one back is instant and does not mean reading the book again.
   */
  const setAside = useMemo(
    () => new Set(dismissals.map((row) => row.key)),
    [dismissals],
  );
  const showing = report?.findings.filter((f) => !setAside.has(f.key)) ?? [];
  const hidden = report?.findings.filter((f) => setAside.has(f.key)) ?? [];

  const dismiss = (key: string) =>
    saveConsistencyRaw(bookId, JSON.stringify(withDismissal(dismissals, key)));
  const restore = (key: string) =>
    saveConsistencyRaw(bookId, JSON.stringify(withoutDismissal(dismissals, key)));

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
          A name that changed spelling in chapter thirty is invisible from
          inside a draft, because nobody reads their own book straight through.
          This reads every chapter at once and says where each spelling is.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {heading}

        {toRead === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-5 text-muted">
            Nothing written yet in the body of this book. There is nothing to
            read across.
          </p>
        ) : (
          <>
            {/* Keyed on there being no report rather than on the phase, so
                "Run it again" does not throw the results away and put the
                opening pitch back on screen for a frame. */}
            {!report && (
              <section className="rounded-xl border border-line bg-panel p-5">
                <p className="max-w-2xl text-base leading-relaxed text-fg/80">
                  Six checks, over{" "}
                  <strong className="font-semibold text-fg">
                    {plural(toRead, "chapter")}
                  </strong>{" "}
                  at once: a name spelled two ways, British and American
                  spellings side by side, a compound that gains and loses its
                  hyphen, straight quotation marks among curly ones, a word
                  typed twice, and a quotation mark left open.
                </p>
                <button
                  type="button"
                  onClick={run}
                  disabled={phase === "running"}
                  className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
                >
                  {phase === "running"
                    ? `Reading ${plural(toRead, "chapter")}…`
                    : "Run the check"}
                </button>
              </section>
            )}

            {report && (
              <>
                <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-panel px-5 py-4">
                  <p className="text-sm text-muted">
                    Read {plural(report.chapters, "chapter")} and{" "}
                    {plural(report.words, "word")}.
                  </p>
                  {report.usedBible && (
                    <p className="text-sm text-muted">
                      Names checked against your story bible.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={run}
                    disabled={phase === "running"}
                    className="ml-auto rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-muted hover:bg-raised hover:text-fg disabled:opacity-60"
                  >
                    {phase === "running" ? "Reading…" : "Run it again"}
                  </button>
                </section>

                {showing.length === 0 ? (
                  <Nothing report={report} />
                ) : (
                  <div className="mt-4 space-y-4">
                    {showing.map((finding) => (
                      <FindingCard
                        key={finding.key}
                        bookId={bookId}
                        finding={finding}
                        onDismiss={dismiss}
                      />
                    ))}
                  </div>
                )}

                {hidden.length > 0 && (
                  <SetAside
                    findings={hidden}
                    onRestore={restore}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* **The standing refusal, said once at the foot.** Every one of these
            is a decision somebody made on purpose at least once, and a screen
            that forgets to say so is a screen that has started grading a
            manuscript. */}
        <div className="mt-10 border-t border-line pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            There is no score here and no count of &ldquo;errors&rdquo;. A
            second character really can have a name one letter from the first,
            English really does write <em>a well-known writer</em> as{" "}
            <em>well known</em>, and a word repeated twice can be the whole
            point of the line. This looks for six specific things across the
            whole book — the one place they are findable, and the one place you
            cannot check by reading your own draft. What it finds is a list of
            places to look, and nothing here changes a word. For repeated words
            inside a single chapter, the prose report is the other half.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The empty answer, which is the one the house rules are strictest about.
 *
 * It has to say what ran. "Nothing found" over a check that never read
 * anything is the same sentence as "nothing found" over a check that read the
 * whole book, and only one of them is true.
 */
function Nothing({ report }: { report: ConsistencyReport }) {
  return (
    <section className="mt-4 rounded-xl border border-line bg-panel p-5">
      <p className="text-base font-semibold text-fg">Nothing came back.</p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Six checks, over {plural(report.chapters, "chapter")} and{" "}
        {plural(report.words, "word")}. That is not praise — these are six
        specific things, and a book can be inconsistent in ways none of them
        looks at.
      </p>
    </section>
  );
}

function FindingCard({
  bookId,
  finding,
  onDismiss,
}: {
  bookId: string;
  finding: ConsistencyFinding;
  onDismiss: (key: string) => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {LABELS[finding.check]}
          </p>
          <h3 className="mt-1 text-lg font-bold break-words text-fg">
            {finding.label}
          </h3>
        </div>
        {/* Not a ✕. A cross reads as delete; this is the writer saying the
            book is right and the check is wrong, and the button should say
            what is being asserted. */}
        <button
          type="button"
          onClick={() => onDismiss(finding.key)}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-raised hover:text-fg"
        >
          Not a mistake
        </button>
      </div>

      {finding.variants.map((variant, at) => (
        <VariantBlock
          key={variant.text}
          bookId={bookId}
          variant={variant}
          rare={at > 0}
        />
      ))}

      {finding.passages && finding.passages.length > 0 && (
        <ul className="mt-3 space-y-2">
          {finding.passages.map((spot, at) => (
            <li
              key={`${spot.chapterId}-${at}`}
              className="rounded-lg border border-line bg-surface p-3"
            >
              <Link
                href={`/book/${bookId}/chapter/${spot.chapterId}`}
                className="text-xs font-semibold text-accent"
              >
                {spot.number === null ? spot.chapterTitle : `Chapter ${spot.number}`}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-fg/80">
                {marked(spot.text, spot.mark)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Disclosure label="Why this is here" closeLabel="Close">
        {finding.note}
      </Disclosure>
    </article>
  );
}

/**
 * One spelling, with every chapter it is in.
 *
 * **The rare form takes the accent and the common one stays grey.** That one
 * choice does most of the explaining on this screen: the eye lands on the two
 * uses in chapter thirty rather than on the forty-one in chapters one to
 * twelve, which is the order the writer wants to read them in.
 */
function VariantBlock({
  bookId,
  variant,
  rare,
}: {
  bookId: string;
  variant: Variant;
  rare: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-sm font-semibold ${
            rare ? "bg-note-bg text-note-fg" : "bg-raised text-fg"
          }`}
        >
          {variant.text}
        </span>
        <span className="text-xs text-muted">
          {plural(variant.count, "time")} in the book
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {variant.where.map((where) => (
          <Link
            key={where.chapterId}
            href={`/book/${bookId}/chapter/${where.chapterId}`}
            /* Capped, because a chapter with no number falls back to its
               own title — and "Chapter 5 – System Override" beside five chips
               reading "ch 4" makes the row jump. The full name is on the
               tooltip either way. */
            className="max-w-[12rem] truncate rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:bg-raised hover:text-fg"
            title={where.chapterTitle}
          >
            {where.number === null ? where.chapterTitle : `ch ${where.number}`}
            <span className="ml-1 text-fg/60">×{where.count}</span>
          </Link>
        ))}
      </div>

      {variant.example && (
        <p className="mt-2 text-sm leading-relaxed text-fg/80">
          {marked(variant.example, variant.text)}
        </p>
      )}
    </div>
  );
}

function SetAside({
  findings,
  onRestore,
}: {
  findings: readonly ConsistencyFinding[];
  onRestore: (key: string) => void;
}) {
  return (
    <details className="group mt-6 rounded-xl border border-line bg-panel p-5">
      <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-fg">
        <span className="group-open:hidden">
          Show the {plural(findings.length, "one")} you set aside
        </span>
        <span className="hidden group-open:inline">Hide these again</span>
      </summary>
      <ul className="mt-3 space-y-2">
        {findings.map((finding) => (
          <li
            key={finding.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
          >
            <span className="text-sm break-words text-fg/80">
              {finding.label}
            </span>
            <button
              type="button"
              onClick={() => onRestore(finding.key)}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-raised hover:text-fg"
            >
              Put back
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

const LABELS: Record<ConsistencyFinding["check"], string> = {
  names: "A name spelled two ways",
  spelling: "British and American",
  hyphens: "Hyphenation",
  quotes: "Quotation marks",
  doubled: "A word typed twice",
  unclosed: "A quotation mark left open",
};

function Disclosure({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-fg">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">{closeLabel}</span>
      </summary>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
        {children}
      </p>
    </details>
  );
}

/**
 * The writer's own prose, with the found words marked.
 *
 * Returns nodes and never markup: the text on this screen is the manuscript,
 * and a highlighter that builds an HTML string is one edit from putting a
 * writer's own angle brackets through `dangerouslySetInnerHTML`. Same rule as
 * `markdown.ts` — the parser returns data.
 */
function marked(text: string, mark: string): React.ReactNode {
  const words = mark.trim().split(/\s+/).filter(Boolean).map(escape);
  if (words.length === 0) return text;

  const pattern =
    words.length === 1 && /^\p{L}/u.test(mark)
      ? `\\b(${words[0]})\\b`
      : `(${words.join("\\s+")})`;

  const parts = text.split(new RegExp(pattern, "gi"));
  return parts.map((part, at) =>
    at % 2 === 1 ? (
      <mark key={at} className="rounded bg-note-bg px-0.5 text-note-fg">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
