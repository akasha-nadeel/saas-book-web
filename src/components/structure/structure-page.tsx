"use client";

import Link from "next/link";
import {
  GENRE_NOTES,
  placeBeats,
  whereYouAre,
  type BeatPlacement,
} from "@/lib/beats";
import { suggestTarget } from "@/lib/book-kinds";
import { bookWordCount, findBook, setTargetWords } from "@/lib/library-store";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Where you are in the shape, and what usually happens there.
 *
 * For the writer at 30,000 words of an 80,000-word book who has run out of
 * road — the most-repeated craft complaint in the research, and always at the
 * same place. They do not need a theory of narrative. They need somebody to
 * say: you are at the middle, and the middle is where the thing that makes
 * going back impossible usually happens.
 *
 * **It refuses to work without a target**, and offers to set one rather than
 * guessing. Every position here is a share of a finished length; inventing that
 * length from the genre would put a number on screen the writer never agreed
 * to, and then measure them against it.
 *
 * **The page says twice that this is a convention rather than a rule**, at the
 * top and at the foot, because a structure tool is one bad sentence away from
 * being the writing course this product exists in opposition to.
 */
export function StructurePage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

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

  const words = bookWordCount(book);
  const placements = placeBeats(words, book.targetWords);
  const line = whereYouAre(placements, words);
  const note = book.genre ? GENRE_NOTES[book.genre] : undefined;
  const suggested = suggestTarget(book.kind ?? "novel", book.genre ?? "Other");

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Structure">
        The shape most novels share, in plain words, with your word count on it.
        A convention, not a rule — good novels break every line below.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {!placements ? (
          <section className="mt-8 rounded-xl border border-line bg-panel p-5">
            <p className="font-bold text-fg">This book has no target length</p>
            <p className="mt-2 text-muted">
              Every position here is a share of a finished book, so there is
              nothing to take a share of yet. We will not guess one from your
              genre — that would put a number on screen you never agreed to and
              then measure you against it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTargetWords(book.id, suggested)}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
              >
                Use {suggested.toLocaleString()} words
              </button>
              <Link
                href={`/book/${bookId}/comps`}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-fg"
              >
                Get one from real books
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">
              {suggested.toLocaleString()} is the figure everybody repeats for
              this genre. The comps page works one out from books that exist.
            </p>
          </section>
        ) : (
          <>
            <Arc placements={placements} words={words} line={line} />

            {note && (
              <section className="mt-6 rounded-xl border border-line bg-panel px-5 py-4">
                <p className="text-sm font-bold text-fg">
                  What differs in {book.genre?.toLowerCase()}
                </p>
                <p className="max-w-prose mt-1.5 text-sm text-muted">{note}</p>
              </section>
            )}

            <ol className="mt-8">
              {placements.map((beat, i) => (
                <Step
                  key={beat.id}
                  beat={beat}
                  last={i === placements.length - 1}
                />
              ))}
            </ol>
          </>
        )}

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs text-muted">
            These names are ours and deliberately plain. The famous beat sheets
            are somebody&rsquo;s copyrighted framework, and their vocabulary is a
            barrier of its own — you should not have to read a book about
            structure before you can use a page about structure. Nothing here is a
            rule, and no part of your book is wrong for being somewhere else.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The whole book as one bar, with the writer's place marked on it.
 *
 * **This is the thing the screen was missing.** Eleven stacked cards are a
 * list, and a list cannot show a *shape*: the beats are proportional shares of
 * one book, some three per cent of it and some fifteen, and reading that off
 * eleven identically sized boxes means holding numbers in your head. Worse, at
 * roughly a hundred pixels each the last beat sat twelve hundred pixels below
 * the first, so the one question a structure screen exists to answer — what
 * does the shape of my book look like, and where am I on it — could never be
 * seen at once.
 *
 * So the arc is drawn to scale and fits on one line. It is the same move a
 * video timeline or a deployment pipeline makes, and for the same reason: when
 * position along a whole is the subject, position along a whole has to be
 * visible.
 *
 * **Three states, three treatments**, because "done", "here" and "ahead" are
 * the only distinctions that matter and colour alone would carry none of them
 * to somebody who cannot separate the hues: written is filled, the current
 * beat is the accent and taller than its neighbours, and what is ahead is the
 * raised ground with a hairline between.
 */
function Arc({
  placements,
  words,
  line,
}: {
  placements: BeatPlacement[];
  words: number;
  line: string | null;
}) {
  const total = placements[placements.length - 1].toWords;
  // Clamped, because a writer past their target is at the end of the arc
  // rather than off the side of it.
  const at = Math.max(0, Math.min(1, total > 0 ? words / total : 0));

  return (
    <section className="mt-8">
      <div className="flex overflow-hidden rounded-lg" aria-hidden="true">
        {placements.map((beat) => (
          <span
            key={beat.id}
            // The catalogue of one book: each segment as wide as its share.
            style={{ width: `${((beat.toWords - beat.fromWords) / total) * 100}%` }}
            title={`${beat.title} · ${beat.fromWords.toLocaleString()}–${beat.toWords.toLocaleString()} words`}
            className={`h-8 border-r border-surface last:border-r-0 ${
              beat.current
                ? "bg-accent"
                : beat.passed
                  ? "bg-fg/25"
                  : "bg-raised"
            }`}
          />
        ))}
      </div>

      {/* The marker rides under the bar rather than over it: on top it covers
          the very segment it is pointing at, which on a three-per-cent beat is
          most of it. */}
      <div className="relative h-3">
        <span
          aria-hidden="true"
          style={{ left: `${at * 100}%` }}
          className="absolute top-0 -ml-px h-3 w-0.5 -translate-x-0 bg-fg"
        />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-fg">{line}</p>
        <p className="shrink-0 text-xs text-muted tabular-nums">
          {total.toLocaleString()} words
        </p>
      </div>
    </section>
  );
}

/**
 * One beat on the rail.
 *
 * A spine with a node per beat, rather than eleven separate cards. The cards
 * were the right idea for a set of unrelated things and the wrong one here:
 * these are ordered, and a reader given eleven boxes has to infer the order
 * from their arrangement, where a line through them states it. It also buys
 * back most of the height — the same eleven beats now read in about half the
 * scroll, because the case for a border, a background and twenty pixels of
 * padding on each was never strong.
 *
 * The node carries the state a second time, in shape rather than colour: a
 * tick for written, a filled ring for here, a hollow one for ahead.
 */
function Step({ beat, last }: { beat: BeatPlacement; last: boolean }) {
  return (
    <li className="relative grid grid-cols-[1.75rem_1fr] gap-x-4">
      {/* The spine, behind the node and stopping at the last one. */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-line"
        />
      )}

      <span
        aria-hidden="true"
        className={`relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[13px]
                    font-bold ${
                      beat.current
                        ? "bg-accent text-accent-ink"
                        : beat.passed
                          ? "bg-ok-bg text-ok-fg"
                          : "border border-line bg-surface text-muted"
                    }`}
      >
        {beat.passed ? "✓" : ""}
      </span>

      <div className={`pb-7 ${beat.passed ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-bold text-fg">
            {beat.title}
            {beat.current && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-[11px] font-bold text-accent-ink uppercase">
                you are here
              </span>
            )}
          </p>
          <p className="shrink-0 text-xs text-muted tabular-nums">
            {beat.fromWords.toLocaleString()}–{beat.toWords.toLocaleString()}
          </p>
        </div>
        <p className="max-w-prose mt-1.5 text-sm leading-relaxed text-muted">
          {beat.what.replace(/\*\*/g, "")}
        </p>
      </div>
    </li>
  );
}
