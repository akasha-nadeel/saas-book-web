"use client";

/**
 * The consistency check, in the rail's panel.
 *
 * **One engine, two windows** — `lib/consistency.ts` judges for both this and
 * the full screen, `lib/book-text.ts` reads the book for both, and since the
 * card redesign the picker, the finding card and the run bar are literally the
 * same three components. Two copies of any of it would be two answers to one
 * question.
 *
 * What is left in this file is what is genuinely the panel's own: the
 * session cache that survives a chapter navigation, the staleness test that
 * goes with it, the restored scroll position, and the way out to the full
 * screen. **There is no `dense` flag and there must not be one** — the card
 * reads its own width with `@container`, so the panel is narrower rather than
 * different.
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { CheckPicker } from "@/components/consistency/check-picker";
import { checksIn } from "@/lib/consistency-checks";
import { FindingCard } from "@/components/consistency/finding-card";
import { RunBar, ranLine } from "@/components/consistency/run-bar";
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
import { findBook, saveConsistencyRaw, type Book } from "@/lib/library-store";
import { loadTypoWords } from "@/lib/typo-words";
import {
  useBible,
  useDismissals,
  useHydrated,
  useShelf,
} from "@/lib/use-library";

/**
 * The last run per book, kept for the length of the session.
 *
 * **Because opening a chapter throws this component away.** A route change
 * replaces the editor's subtree, and the panel's `useState` goes with it — so a
 * writer who ran the check and then followed one of its own chapter links
 * arrived back at the "Run the check" button, having lost the very list they
 * were working through.
 *
 * Module-level and not stored: a report is *derived*, it is worthless the moment
 * the manuscript moves, and it costs a couple of hundred milliseconds to make
 * again. Keeping it in `localStorage` would buy a stale answer surviving a
 * reload, which is the opposite of what is wanted.
 *
 * **The ticked checks live here too**, for the same reason the report does and
 * for no longer: coming back to a picker that has forgotten what you chose is
 * the same lost work in a smaller size. They are still session-only — see
 * `check-picker.tsx` for why they are never written down.
 */
interface Held {
  report: ConsistencyReport;
  /** What the book looked like when it ran, so staleness can be seen. */
  signature: string;
  scroll: number;
  picked: CheckId[];
  /** Whether the writer left the findings on screen or went back to the picker. */
  showing: boolean;
}

const CACHE = new Map<string, Held>();

/**
 * What the book looked like when the check ran.
 *
 * Chapter ids and their word counts, straight off the shelf — no bodies are
 * read, so this is free. It is not a checksum of the prose and does not need to
 * be: it moves whenever a chapter is written in, added or removed, which is
 * every case where the report has stopped being true.
 */
const signatureOf = (book: Book) =>
  readable(book)
    .map((chapter) => `${chapter.id}:${chapter.words}`)
    .join("|");

export function ConsistencyPanel({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const bible = useBible(bookId);
  const dismissals = useDismissals(bookId);

  const held = CACHE.get(bookId);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ConsistencyReport | null>(
    () => held?.report ?? null,
  );
  const [showing, setShowing] = useState(() => held?.showing ?? false);
  /** Nothing ticked to begin with — see `consistency-page.tsx` for why. */
  const [picked, setPicked] = useState<ReadonlySet<CheckId>>(
    () => new Set(held?.picked ?? []),
  );

  const toRead = useMemo(() => (book ? readable(book).length : 0), [book]);

  /*
   * Whether the book has been written in since this report was made.
   *
   * Said out loud rather than quietly re-run: a report that redoes itself on
   * every navigation would read every chapter each time a writer followed a
   * link, and a report that stays silent about being old is the same mistake as
   * an empty result rendered as a good one.
   */
  const stale =
    report !== null &&
    book !== null &&
    CACHE.get(bookId)?.signature !== signatureOf(book);

  /*
   * **Where the writer had scrolled to, kept with the report.**
   *
   * The findings survive a chapter navigation now, and landing back at the top
   * of them is its own small betrayal: somebody four findings down, clicking
   * the chapters of the fourth, was returned to the first every time. Restored
   * before paint rather than after, or the list is visibly thrown to the top
   * and dragged back.
   */
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const at = CACHE.get(bookId)?.scroll;
    if (listRef.current && at) listRef.current.scrollTop = at;
  }, [bookId]);

  /** Everything the cache holds but the scroll, which has its own writer. */
  const remember = (next: Partial<Held>) => {
    const was = CACHE.get(bookId);
    if (was) CACHE.set(bookId, { ...was, ...next });
  };

  const run = () => {
    if (!book || picked.size === 0) return;
    setRunning(true);
    // Paint the pressed state before the reading starts. A few hundred
    // milliseconds of dead button is worse than the same wait, admitted.
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
      const next = consistencyReport(bookTextOf(book), {
        known,
        only: [...picked],
        ...(words ? { words } : {}),
      });
      // A fresh report is a fresh list, so the old scroll offset means nothing.
      CACHE.set(bookId, {
        report: next,
        signature: signatureOf(book),
        scroll: 0,
        picked: [...picked],
        showing: true,
      });
      setReport(next);
      setShowing(true);
      setRunning(false);
    });
  };

  const clear = () => {
    CACHE.delete(bookId);
    setReport(null);
    setShowing(false);
    setPicked(new Set());
  };

  const setAside = useMemo(
    () => new Set(dismissals.map((row) => row.key)),
    [dismissals],
  );

  /* The quiet ones sink rather than vanish — see `consistency-page.tsx`. */
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

  if (!hydrated || !book) return null;

  if (toRead === 0) {
    return (
      <p className="p-3 text-sm text-muted">
        Nothing written yet in the body of this book.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* `scroll-slim` rather than the browser's default bar: 8px, a floating
          thumb and no arrow buttons. The default is a wide dark gutter here,
          which in a pale panel reads as a black stripe down the edge. */}
      <div
        ref={listRef}
        onScroll={(e) => {
          // Straight onto the cache entry rather than into state: this fires on
          // every frame of a scroll, and re-rendering the whole list for a
          // number nothing draws would be a waste of a frame.
          const at = CACHE.get(bookId);
          if (at) at.scroll = e.currentTarget.scrollTop;
        }}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3"
      >
        {!showing || !report ? (
          <>
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
              onBack={
                report
                  ? () => {
                      setShowing(true);
                      remember({ showing: true });
                    }
                  : undefined
              }
            />
          </>
        ) : (
          <>
            <RunBar
              report={report}
              running={running}
              stale={stale}
              warning={
                picked.has("typos") && !report.ran.includes("typos")
                  ? "The word list could not be loaded, so the near-miss check did not run."
                  : undefined
              }
              onBack={() => {
                setShowing(false);
                remember({ showing: false });
              }}
              onClear={clear}
              onAgain={run}
            />

            {ordered.length === 0 ? (
              /* Never a tick, never "clean" — and never the literal six, which
                 is a sentence about a run that may not have happened. */
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {report.ran.length === 0
                  ? "No check was picked, so nothing was looked for. This is not a result about the book."
                  : `Nothing came back. That is ${ranLine(report)} finding nothing, not a verdict on the book.`}
              </p>
            ) : (
              <>
                <p className="mt-4 mb-2 px-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {live === ordered.length
                    ? `Findings · ${ordered.length}`
                    : `Findings · ${live} of ${ordered.length}`}
                </p>
                <ul className="flex flex-col gap-2.5">
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
        )}
      </div>

      <div className="border-t border-line px-3 py-2">
        <Link
          href={`/book/${bookId}/consistency`}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Open the full check →
        </Link>
      </div>
    </div>
  );
}
