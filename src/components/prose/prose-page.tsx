"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, getBody, orderedChapters } from "@/lib/library-store";
import { proseReport } from "@/lib/prose";
import { chapterText } from "@/lib/search";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";

/**
 * A report on a chapter's prose, and never an edit of it.
 *
 * The craft complaint in the research is real — *"grammar, punctuation,
 * dialogue tags/action beats"* — and so is the exhaustion beside it: *"every
 * YouTube ad is Grammarly"*, and Word's AI making a hundred and fifty
 * corrections that *"caused the writing to be more bland"*.
 *
 * So this counts and stops. It is `storeReadiness()` aimed at prose: here is
 * what is in the chapter, and the decision is yours. No score, no grade, no
 * suggested rewrite, and no button that changes a word — which is also the only
 * shape this feature can take without contradicting the assistant having no
 * write access.
 *
 * Read straight from storage rather than through a hook: this walks every
 * chapter on demand, the way `search.ts` does, and subscribing to forty bodies
 * to run a report the writer asked for once would cost more than it saves.
 */
export function ProsePage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const [chapterId, setChapterId] = useState<string | null>(null);
  /*
   * **The report is run on a press, and that is why the button exists.**
   * Counting books needs a moment to count at, and this screen had none: it
   * drew the report the instant it mounted. Marking on arrival would have made
   * the limit a limit on *visiting* — walk through six prose screens and the
   * allowance is gone without a report being read — and it would have had to
   * open `LimitDialog` from an effect, which that component's own note forbids
   * for the reason an effect fires again on every remount.
   *
   * So the press is the use. A book already counted is never asked again, so
   * this reads as a one-time button on the six books that matter and never
   * appears at all on Pro.
   */
  const [ran, setRan] = useState(false);
  const gate = useLimitGate({ action: "prose", bookId });

  const chapters = useMemo(
    () => (book ? orderedChapters(book).filter((c) => c.words > 0) : []),
    [book],
  );

  const chosen = chapterId ?? chapters[0]?.id ?? null;

  /**
   * Whether the report may be drawn.
   *
   * Three ways in, and the second is the one that matters: a book **already**
   * among the six draws straight away, so a writer returning to a chapter is
   * never asked to press again for something they have already spent. On Pro
   * there is no limit and so no button at all.
   */
  const counted = (usePrefs().usedOn.prose ?? []).includes(bookId);
  const showing = ran || counted || gate.allowance.limit === null;

  const report = useMemo(() => {
    if (!chosen) return null;
    const chapter = chapters.find((c) => c.id === chosen);
    if (!chapter) return null;
    return proseReport(chapterText(chapter.title, getBody(chosen)));
  }, [chosen, chapters]);

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


  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Prose report">
        What is in the chapter, counted. Nothing here is a fault and nothing
        here changes a word — the decisions are all yours.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {chapters.length === 0 ? (
          <p className="mt-8 text-muted">
            Nothing written yet. There is nothing to count.
          </p>
        ) : (
          <>
            <label className="mt-8 flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">Chapter</span>
              <select
                value={chosen ?? ""}
                onChange={(e) => setChapterId(e.target.value)}
                className="rounded-lg border border-line bg-panel px-3 py-2 text-fg"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.words.toLocaleString()} words
                  </option>
                ))}
              </select>
            </label>

            {!showing && (
              <div className="mt-6">
                <LimitBanner allowance={gate.allowance} className="mb-4" />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!gate.spend()) return;
                      setRan(true);
                    }}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold
                               text-accent-ink"
                  >
                    Run the report
                  </button>
                  <LeftPill allowance={gate.allowance} />
                </div>
              </div>
            )}

            {showing && report && (
              <>
                <section className="mt-6 grid gap-3 sm:grid-cols-4">
                  <Stat value={report.words.toLocaleString()} label="words" />
                  <Stat
                    value={report.sentences.toLocaleString()}
                    label="sentences"
                  />
                  <Stat
                    value={String(report.averageSentence)}
                    label="words a sentence"
                  />
                  <Stat
                    value={String(report.longestSentence)}
                    label="longest sentence"
                  />
                </section>

                {report.findings.length === 0 ? (
                  <p className="mt-8 rounded-xl border border-line bg-panel p-5 text-muted">
                    Nothing to point at in this chapter. That is not praise —
                    there are only five things this looks for.
                  </p>
                ) : (
                  <ul className="mt-8 flex flex-col gap-3">
                    {report.findings.map((finding) => (
                      <li
                        key={finding.id}
                        className="rounded-xl border border-line bg-panel p-5"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-bold text-fg">{finding.label}</p>
                          <p className="max-w-prose text-sm text-muted">
                            {finding.count.toLocaleString()}
                            {finding.per1000 !== undefined &&
                              ` · ${finding.per1000} per 1,000 words`}
                          </p>
                        </div>
                        <p className="max-w-prose mt-2 text-sm leading-relaxed text-muted">
                          {finding.note}
                        </p>
                        {finding.examples.length > 0 && (
                          <p className="mt-2 font-code text-xs text-muted">
                            {finding.examples.join(" · ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            There is no score here, and there will not be one. A number out of a
            hundred for prose is invented to look like an answer. Adverbs are not
            a fault, filter words are not a fault, and a long sentence is a style
            — these are things writers are widely advised about, and the only
            useful service is showing you where yours are.
          </p>
        </div>
      </div>
      {gate.dialogOpen && (
        <LimitDialog action="prose" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xl font-extrabold text-fg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
