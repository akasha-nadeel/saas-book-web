"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import {
  finishesOn,
  pace,
  recentDays,
  streak,
  type Activity,
} from "@/lib/activity";
import { bookWordCount, findBook } from "@/lib/library-store";
import { useActivity, useHydrated, useShelf } from "@/lib/use-library";

/**
 * Whether the book is moving, and how fast.
 *
 * Behind this is the largest and least tractable pain in the research —
 * *"12 years to finish my novel"*, *"14 years"*, *"6 years for my first book"*.
 * Nothing here fixes that, and nothing here pretends to. What it does is make
 * the question answerable: a writer with seventeen minutes a day cannot tell
 * from the inside whether they are getting anywhere, and being unable to tell
 * is its own discouragement.
 *
 * **Facts, never verdicts.** "You wrote on 12 of the last 30 days" is a fact.
 * "You should write more" is a stick, and the people selling sticks are pain
 * point #17 in the same research. Nothing on this page congratulates or scolds,
 * a broken streak is stated without comment, and the projection refuses to
 * appear rather than say something cruel.
 */
export function ProgressPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const activity = useActivity();
  const book = findBook(shelf, bookId);

  const stats = useMemo(() => summarise(activity), [activity]);

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
  const finish = finishesOn(words, book.targetWords, stats.month.perDay);
  const busiest = stats.days.reduce((max, d) => Math.max(max, d.words), 0);

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg">Progress</h1>
        <p className="mt-3 text-muted">
          Whether the writing is moving. Counted across every book, because the
          question is about you rather than about one manuscript.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            value={stats.streak === 0 ? "—" : String(stats.streak)}
            label={
              stats.streak === 1 ? "day in a row" : "days in a row"
            }
          />
          <Stat
            value={`${stats.month.daysWritten}/${stats.month.windowDays}`}
            label="days written in the last month"
          />
          <Stat
            value={stats.month.perWritingDay.toLocaleString()}
            label="words on a day you write"
          />
        </section>

        {/* ---- The month ---------------------------------------------- */}
        <section className="mt-6 rounded-xl border border-line bg-panel p-5">
          <p className="text-sm font-bold text-fg">The last thirty days</p>
          <div className="mt-4 flex items-end gap-[3px]" aria-hidden="true">
            {stats.days.map((day) => (
              <span
                key={day.day}
                title={`${day.day}: ${day.words.toLocaleString()} words`}
                className={`flex-1 rounded-sm ${
                  day.words > 0
                    ? "bg-accent"
                    : day.words < 0
                      ? "bg-muted/40"
                      : "bg-raised"
                }`}
                style={{
                  // A floor of 3px so a day off is a visible gap rather than
                  // nothing — the shape of the month is the information.
                  height:
                    busiest > 0 && day.words > 0
                      ? `${Math.max(3, (day.words / busiest) * 64)}px`
                      : "3px",
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            {stats.month.words >= 0
              ? `${stats.month.words.toLocaleString()} words net across the month.`
              : `${Math.abs(stats.month.words).toLocaleString()} words shorter than a month ago — which is what revising looks like.`}
          </p>
        </section>

        {/* ---- This book ---------------------------------------------- */}
        <section className="mt-6 rounded-xl border border-line bg-panel p-5">
          <p className="text-sm font-bold text-fg">{book.title}</p>
          <p className="mt-1.5 text-fg">
            {words.toLocaleString()} words
            {book.targetWords
              ? ` of ${book.targetWords.toLocaleString()}`
              : ", with no target set"}
          </p>

          {finish ? (
            <p className="mt-3 text-muted">
              At your last thirty days&rsquo; pace, that is{" "}
              <strong className="text-fg">
                {finish.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              . Which assumes the next months look like the last one, and months
              rarely do.
            </p>
          ) : (
            /* Deliberately says nothing rather than something cruel. A
               projection off a shrinking manuscript reads as "never", which is
               true arithmetic and a terrible thing to print at somebody in the
               middle of a hard revision. */
            <p className="mt-3 text-muted">
              No finish date to give you — either there is no target, or the
              last month does not make an honest guess possible. Both are
              ordinary.
            </p>
          )}
        </section>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          A day of cutting counts as a day of writing here, because it is one.
          Nothing on this page is a target you have missed, and there is no
          streak to protect — writers finish books in five years and in twelve,
          and the ones who finish are not the ones with the tidiest chart.
        </p>
      </div>
    </div>
  );
}

function summarise(activity: Activity) {
  return {
    streak: streak(activity),
    month: pace(activity, 30),
    days: recentDays(activity, 30),
  };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
