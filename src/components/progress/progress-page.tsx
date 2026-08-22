"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  finishesOn,
  heatLevel,
  leadingBlanks,
  pace,
  recentDays,
  streak,
  type Activity,
  type HeatLevel,
} from "@/lib/activity";
import { bookWordCount, findBook } from "@/lib/library-store";
import { plural } from "@/lib/plural";
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
 *
 * ---
 *
 * **The month is a calendar, and it was a bar chart.** Thirty columns with a
 * 3px floor under the empty ones, scaled against the busiest day: a writer with
 * one day's work saw twenty-nine grey stubs and a single tall bar, which reads
 * as a chart that failed to load rather than as a month with one day in it. It
 * carried no dates, no weekdays and no axis, so the one bar could not be placed
 * in time at all; and it was `aria-hidden`, so the whole month was simply
 * absent to a screen reader.
 *
 * A calendar grid is the right form for the question, and it is the form every
 * reader already knows from somewhere. Sparse data reads *correctly* in it — an
 * empty square is honestly empty rather than a bar that failed — the column is
 * the weekday, so "never on Wednesdays" becomes visible, and every cell is
 * reachable by keyboard with the same detail the pointer gets.
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

  const words = bookWordCount(book);
  const finish = finishesOn(words, book.targetWords, stats.month.perDay);

  return (
    <div className="h-[var(--oc-layout-height)] overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Progress">
        Whether the writing is moving. Counted across every book, because the
        question is about you rather than about one manuscript.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {/* ---- The three figures ---------------------------------------
            A stat tile is the right form for a single current value, and the
            middle one was a *ratio* — "1/30" set as though it were a quantity.
            A share against a limit is a meter: the number is the part, the
            track is the whole, and the shape of it is readable before the
            digits are. */}
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat
            value={stats.streak === 0 ? "—" : String(stats.streak)}
            label={
              stats.streak === 0
                ? "no run going just now"
                : stats.streak === 1
                  ? "day in a row"
                  : "days in a row"
            }
          />
          <Stat
            value={String(stats.month.daysWritten)}
            label={`of the last ${stats.month.windowDays} days`}
            meter={stats.month.daysWritten / stats.month.windowDays}
          />
          <Stat
            value={stats.month.perWritingDay.toLocaleString()}
            label="words on a day you write"
          />
        </section>

        <Month days={stats.days} netWords={stats.month.words} />

        {/* ---- This book ---------------------------------------------- */}
        <section className="mt-6 rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-bold text-fg">{book.title}</h2>
          <p className="mt-1.5 text-fg">
            {plural(words, "word")}
            {book.targetWords
              ? ` of ${book.targetWords.toLocaleString()}`
              : ", with no target set"}
          </p>

          {book.targetWords ? (
            <Meter
              share={words / book.targetWords}
              className="mt-3 max-w-md"
              label={`${words.toLocaleString()} of ${book.targetWords.toLocaleString()} words`}
            />
          ) : null}

          {finish ? (
            <p className="mt-3 max-w-prose text-muted">
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
            <p className="mt-3 max-w-prose text-muted">
              No finish date to give you — either there is no target, or the
              last month does not make an honest guess possible. Both are
              ordinary.
            </p>
          )}
        </section>

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            A day of cutting counts as a day of writing here, because it is one.
            Nothing on this page is a target you have missed, and there is no
            streak to protect — writers finish books in five years and in
            twelve, and the ones who finish are not the ones with the tidiest
            chart.
          </p>
        </div>
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

/** Monday-first, matching `leadingBlanks`. */
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The four ink steps, as opacities of the app's own accent.
 *
 * **One hue, light to dark, and it inverts with the theme for free.** `accent`
 * is near-black indigo by day and white at night, so these read pale-to-deep on
 * white and dim-to-bright on black — which is the same direction in each case,
 * *more ink means more words*, and the app's own elevation logic besides.
 *
 * The steps are 40/60/80/100 rather than an even quarter split because the
 * lightest one has to clear the panel it sits on: at 20% it measured 1.46:1
 * against the surface, under the 2:1 floor for the light end of an ordinal
 * ramp, and a "you wrote that day" that cannot be seen is a lie of omission.
 * Checked with the palette validator in both themes rather than by eye.
 */
const STEPS: Record<HeatLevel, string> = {
  0: "bg-raised",
  1: "bg-accent/40",
  2: "bg-accent/60",
  3: "bg-accent/80",
  4: "bg-accent",
};

interface Day {
  day: string;
  words: number;
}

/**
 * The month as a calendar rather than as thirty bars.
 *
 * The hover layer is a **detail line under the grid** rather than a floating
 * tooltip, and that is a decision rather than a shortcut: the cells are small
 * and thirty of them sit in a block, so a panel that follows the pointer covers
 * the neighbours a reader is comparing against. A fixed line reads at one
 * place, never occludes the data, and — the part that matters — is the same
 * thing keyboard focus shows, which a positioned tooltip usually is not.
 */
function Month({ days, netWords }: { days: Day[]; netWords: number }) {
  const [hovered, setHovered] = useState<Day | null>(null);
  const busiest = days.reduce((max, d) => Math.max(max, d.words), 0);
  const blanks = days.length > 0 ? leadingBlanks(days[0].day) : 0;
  const written = days.filter((d) => d.words !== 0);

  return (
    <section className="mt-6 rounded-xl border border-line bg-panel p-5">
      <h2 className="text-sm font-bold text-fg">The last thirty days</h2>

      {/* **Sized in cells, not in the column it sits in.** Left to fill the
          card the seven columns came out at sixty pixels a side — a wall of
          grey squares where a month should be a small dense thing taken in at
          once. A calendar cell is about the size of a date.

          Which leaves the rest of the card, so the read-out and the list sit
          beside the grid rather than under it: a 256px block alone on a 7xl
          page is the same empty-half-header the tool decks were fixed for. */}
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="w-[16rem] max-w-full shrink-0">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((initial, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="pb-1 text-center text-[0.6875rem] leading-none text-muted"
              >
                {initial}
              </span>
            ))}

            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}

            {days.map((day) => (
              <Cell
                key={day.day}
                day={day}
                busiest={busiest}
                onShow={setHovered}
                onHide={() => setHovered(null)}
              />
            ))}
          </div>

          {/* The scale, named. Four squares with no words beside them ask a
            reader to guess what darker means. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.6875rem] text-muted">
            <span className="flex items-center gap-1">
              Less
              {([1, 2, 3, 4] as HeatLevel[]).map((level) => (
                <span
                  key={level}
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-[3px] ${STEPS[level]}`}
                />
              ))}
              More
            </span>
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[3px] bg-muted/40"
              />
              a day of cutting
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* **The read-out, which is never empty.** A detail line that appears
          only on hover makes the grid look inert until it is touched, and
          leaves nothing at all for a reader who never hovers. At rest it
          carries the month's own figure — the sentence that used to sit here
          on its own. */}
          <p
            className="min-h-[1.5rem] max-w-prose text-sm text-fg"
            aria-live="polite"
          >
            {hovered ? (
              <>
                <span className="font-semibold">{longDay(hovered.day)}</span>
                <span className="text-muted"> · {said(hovered.words)}</span>
              </>
            ) : (
              <span className="text-muted">
                {netWords >= 0
                  ? `${plural(netWords, "word")} net across the month.`
                  : `${plural(Math.abs(netWords), "word")} shorter than a month ago — which is what revising looks like.`}
              </span>
            )}
          </p>

          {/* **The table is the twin, not a fallback.** The grid encodes with
          colour alone, which is exactly the case that needs a text equivalent;
          folded away because it is the second way to read the same thing, not
          a second thing. Only days with something on them: thirty rows of
          "nothing" is not a table, it is padding. */}
          {written.length > 0 && (
            <details className="group mt-4">
              <summary className="w-fit cursor-pointer list-none text-xs font-semibold text-muted hover:text-fg">
                <span className="group-open:hidden">Show these as a list</span>
                <span className="hidden group-open:inline">Hide the list</span>
              </summary>
              <table className="mt-3 w-full max-w-md text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="py-1.5 font-medium">
                      Day
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Net words
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {written.map((day) => (
                    <tr key={day.day} className="border-b border-line/60">
                      <td className="py-1.5 text-fg">{longDay(day.day)}</td>
                      <td className="py-1.5 text-right text-fg tabular-nums">
                        {day.words > 0 ? "+" : "−"}
                        {Math.abs(day.words).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * One day.
 *
 * A `<div>` with a `tabIndex`, rather than a button: it does nothing when
 * pressed, and a control that announces itself as pressable and then does
 * nothing is the dead UI the house rules forbid. It is focusable because the
 * detail it holds has to be reachable without a pointer, and it carries its own
 * `aria-label` so a screen reader gets the day and the count in one go rather
 * than having to infer them from a colour.
 */
function Cell({
  day,
  busiest,
  onShow,
  onHide,
}: {
  day: Day;
  busiest: number;
  onShow: (day: Day) => void;
  onHide: () => void;
}) {
  const cut = day.words < 0;
  const level = heatLevel(day.words, busiest);

  return (
    <span
      tabIndex={0}
      role="img"
      aria-label={`${longDay(day.day)}: ${said(day.words)}`}
      onMouseEnter={() => onShow(day)}
      onMouseLeave={onHide}
      onFocus={() => onShow(day)}
      onBlur={onHide}
      className={`aspect-square rounded-[3px] outline-none ring-offset-2 ring-offset-panel
                  transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-fg
                  ${cut ? "bg-muted/40" : STEPS[level]}`}
    />
  );
}

/** "Tue 12 August" — enough to place a cell without the year nobody needs. */
function longDay(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/** What a day's figure says, in the page's own voice. */
function said(words: number): string {
  if (words === 0) return "nothing written";
  if (words > 0) return plural(words, "word");
  return `${plural(Math.abs(words), "word")} cut`;
}

/**
 * A share of something, drawn.
 *
 * The unfilled track is a lighter step of the same ramp rather than a grey, so
 * the whole bar reads as one measure with a part filled in — the same reason
 * the month's empty days are a step of the ramp rather than a different idea.
 */
function Meter({
  share,
  label,
  className = "",
}: {
  share: number;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div
      role="img"
      aria-label={label}
      className={`h-1.5 overflow-hidden rounded-full bg-accent/15 ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * One figure.
 *
 * Proportional digits, not `tabular-nums`: equal-width figures make a large
 * standalone number look loose, and nothing here sits in a column that has to
 * line up.
 */
function Stat({
  value,
  label,
  meter,
}: {
  value: string;
  label: string;
  meter?: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      {meter !== undefined && (
        <Meter share={meter} label={`${value} ${label}`} className="mt-3" />
      )}
    </div>
  );
}
