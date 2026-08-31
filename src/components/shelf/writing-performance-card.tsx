"use client";

import { useMemo } from "react";
import {
  AreaChart,
  BarList,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@/components/ui/tremor";
import {
  byWeekday,
  dailySeries,
  pace,
  runningTotal,
} from "@/lib/activity";
import { bookWordCount, type Book } from "@/lib/library-store";
import { plural } from "@/lib/plural";
import { useActivity } from "@/lib/use-library";

/**
 * Whether the writing is moving.
 *
 * **This card used to be a web-analytics demo** — page views, unique visitors,
 * traffic from google and reddit, every figure typed into the file. None of it
 * was true of anything, and it sat at the top of the first screen a writer
 * sees. It is now the same shape over the day log the app has been keeping all
 * along (`activity.ts`), which is the only honest thing this slot can hold.
 *
 * **Net words, and a day of cutting is a day of writing.** The measure is what
 * the book weighs at the end of the day against the start, so a hard revision
 * reads as work rather than as a failed day. The chart draws it below the line;
 * `tremor.tsx` had to stop clamping its floor to zero before it could.
 *
 * **Facts, never verdicts.** No score, no grade, no "you should write more".
 * The two figures and the two lists are counts, and a bad month is reported in
 * the same voice as a good one.
 *
 * **A shelf with nothing on it still gets the whole card.** It drew a single
 * explanatory paragraph in place of the chart until 2026-08-31, on the reading
 * that thirty zeroes render an empty result as a good one — which is true of
 * thirty zeroes *on their own*. Said out loud they are neither: they are what a
 * writer with no books has written, and the shape of them is where their own
 * figures will appear. So the chart, the two tabs and the two lists are always
 * drawn, and the note above them carries the honesty the blank card used to.
 *
 * The Progress tool says the same things per book with a month grid and a
 * finish date. It is hidden under the launch flag, so today this is the only
 * place a writer sees any of it — and both read `activity.ts`, so the two
 * cannot drift apart when Progress comes back.
 */

const WINDOW_DAYS = 30;

/** Top five, because a sixth row is a list rather than a ranking. */
const TOP_BOOKS = 5;

const format = (n: number) => Intl.NumberFormat("us").format(n);

/**
 * A window's net change, with its sign kept.
 *
 * A month of revision is a real thing to have done and reads as `−1,240`. The
 * minus is U+2212 rather than a hyphen, which is what the rest of the app sets
 * its negative figures with.
 */
function signed(n: number): string {
  if (n < 0) return `−${format(Math.abs(n))}`;
  return format(n);
}

export function WritingPerformanceCard({
  books,
  words,
}: {
  books: Book[];
  /** The shelf's own total, so this card and the tiles above it agree. */
  words: number;
}) {
  const activity = useActivity();

  const month = useMemo(() => pace(activity, WINDOW_DAYS), [activity]);

  /**
   * Whether the day log holds anything at all.
   *
   * Not "did they write this month" — a writer back after a fallow summer has
   * a log worth drawing and a flat month is a true fact about them. This is
   * the narrower question of whether anything has ever been recorded, which is
   * the only case where a chart would be rendering an empty result as a good
   * one.
   */
  const logged = useMemo(
    () => Object.values(activity).some((n) => n !== 0),
    [activity],
  );

  const written = useMemo(
    () =>
      dailySeries(activity, WINDOW_DAYS).map((d) => ({
        date: d.date,
        "Words written": d.words,
      })),
    [activity],
  );

  /**
   * What the manuscript weighed, day by day.
   *
   * `runningTotal` answers with *nothing at all* when no day in the window
   * carries a change — it will not pad a flat run in front of itself, and it
   * is right not to. That used to be handled by the card drawing no chart. The
   * chart is drawn either way now, so the flat run is made here instead, at
   * what the shelf weighs **today**, and the caption below says in words that
   * it is a total held level rather than a month somebody lived.
   */
  const manuscript = useMemo(() => {
    const line = runningTotal(activity, words, WINDOW_DAYS);
    if (line.length > 0) {
      return line.map((d) => ({ date: d.date, Manuscript: d.words }));
    }
    return written.map((d) => ({ date: d.date, Manuscript: words }));
  }, [activity, words, written]);

  const weekdays = useMemo(() => byWeekday(activity, WINDOW_DAYS), [activity]);

  /**
   * Where the words live.
   *
   * Current size per book rather than the window's change, because the day log
   * is kept across the whole shelf and cannot be split by book — see the note
   * on `Activity` in `activity.ts`. So this answers "which manuscript is the
   * big one", which is a different and still useful question.
   */
  const byBook = useMemo(
    () =>
      books
        .map((book) => ({ name: book.title, value: bookWordCount(book) }))
        .filter((b) => b.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_BOOKS),
    [books],
  );

  const tabs = [
    {
      name: "Written",
      note: `last ${WINDOW_DAYS} days`,
      value: signed(month.words),
      data: written,
      category: "Words written",
      /* Always the full window by construction — `dailySeries` fills the days
         off with zero, so there is never anything to explain. */
      caption: null as string | null,
    },
    {
      name: "Manuscript",
      note: "every book",
      value: format(words),
      data: manuscript,
      category: "Manuscript",
      /**
       * Why the line may start partway across.
       *
       * `runningTotal` reconstructs backwards from today's total and stops
       * where the day log stops, rather than padding a flat run in front of
       * itself. Without this line a reader sees a short, nearly level chart
       * and cannot tell whether the book barely moved or the app simply has
       * not been watching long — and those are opposite facts.
       */
      caption: !logged
        ? "The day log has nothing in it yet, so the line is held level at what the shelf weighs today. Nothing before today is known."
        : manuscript.length > 0 && manuscript.length < WINDOW_DAYS
          ? `The day log reaches back ${plural(manuscript.length, "day")}. Anything before that is not known, so the line starts there.`
          : null,
    },
  ];

  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-panel p-4 sm:p-6">
      <h3 className="text-base font-semibold text-fg">Your writing</h3>
      <p className="mt-1 text-sm text-muted">
        Whether the writing is moving. Counted across every book, over the last{" "}
        {WINDOW_DAYS} days.
      </p>

      {!logged && (
        /* **The chart is drawn either way now; this line is what keeps it
            honest.** A month of zeroes on its own would render an empty result
            as a good one, which is the house rule this card was written for.
            Said out loud, the same zeroes are a true picture of a shelf with
            nothing on it yet — and they show a writer where their own figures
            will appear, which an explanatory paragraph in place of the whole
            card never did. */
        <p className="mt-4 rounded-lg border border-line bg-raised/20 p-3 text-sm text-muted">
          Nothing recorded yet, so the last {WINDOW_DAYS} days below read as
          zero. This fills in on its own as you write — a day counts whether the
          book grew or you cut it back.
        </p>
      )}

      <TabGroup defaultIndex={0}>
        <Card className="mt-6 overflow-hidden p-0">
          {/* `flex` with `flex-1` tabs rather than the fixed `pr-12` this
              came with: two tabs at that padding wanted about 316px, and a
              360px phone leaves the card roughly 280. Split evenly they
              cannot overflow at any width. */}
          <TabList className="flex space-x-0 bg-raised/20">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className="min-w-0 flex-1 border-r border-line px-4 py-3 text-left last:border-r-0 sm:px-5 sm:py-4"
              >
                <span className="block truncate text-xs font-medium text-muted">
                  {tab.name}{" "}
                  <span className="hidden sm:inline">· {tab.note}</span>
                </span>
                <span className="mt-1 block truncate text-xl font-bold tracking-tight tabular-nums text-fg sm:text-2xl">
                  {tab.value}
                </span>
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {tabs.map((tab) => (
              <TabPanel key={tab.name} className="p-4 sm:p-6">
                {/* Two instances rather than one, because `showYAxis` and
                    `startEndOnly` are props and not CSS — the small one
                    drops the axis and thins the labels to two. */}
                <AreaChart
                  data={tab.data}
                  index="date"
                  categories={[tab.category]}
                  colors={["cyan"]}
                  valueFormatter={format}
                  showGradient={true}
                  showLegend={false}
                  yAxisWidth={56}
                  className="hidden sm:block sm:h-72 lg:h-96"
                />
                <AreaChart
                  data={tab.data}
                  index="date"
                  categories={[tab.category]}
                  colors={["cyan"]}
                  valueFormatter={format}
                  showGradient={true}
                  showLegend={false}
                  showYAxis={false}
                  startEndOnly={true}
                  className="h-56 sm:hidden"
                />
                {tab.caption && (
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {tab.caption}
                  </p>
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Card>

        {/* Below the tabs rather than inside a panel: neither list changes
            with the tab — one is the shelf as it stands, the other is the
            window — and two identical panels that redraw on a press would
            promise a change that never comes. */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-fg">
                Words by book
              </p>
              <span className="shrink-0 text-xs font-medium text-muted">
                Now
              </span>
            </div>
            {byBook.length > 0 ? (
              <BarList data={byBook} valueFormatter={format} />
            ) : (
              <p className="text-sm text-muted">No words on the shelf yet.</p>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold text-fg">
                Days of the week
              </p>
              <span className="shrink-0 text-xs font-medium text-muted">
                {WINDOW_DAYS} days
              </span>
            </div>
            {/* Which day you actually write on is a thing you cannot see
                from the inside. A weekday that comes out negative is left
                negative — it reads as "that is when I cut". */}
            <BarList data={weekdays} valueFormatter={signed} />
          </Card>
        </div>
      </TabGroup>
    </div>
  );
}
