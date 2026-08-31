/**
 * How much was written, and when.
 *
 * The pain underneath this is the biggest one in the research and the least
 * tractable: *"12 years to finish my novel"*, *"14 years"*, *"6 years for my
 * first book"*. No tool fixes that. What a tool can honestly do is stop the
 * question "am I actually getting anywhere?" being unanswerable, because a
 * writer with seventeen minutes a day genuinely cannot tell from the inside.
 *
 * **Facts, never verdicts.** "You wrote on 12 of the last 30 days" is a fact.
 * "You should write more" is a stick, and the people selling sticks are pain
 * point #17 in the same research. Nothing here congratulates or scolds; the
 * streak is reported because writers ask for it, and a broken one is stated
 * without comment.
 *
 * **Net words, not words typed.** Revising a chapter down by 800 words is work,
 * and a counter that only ever goes up would call it a wasted day. The honest
 * measure is what the book weighs at the end of the day against the start, and
 * a negative day is a day of writing like any other.
 */

/** A day, as `YYYY-MM-DD` in the writer's own timezone. */
export function dayKey(at: number | Date = Date.now()): string {
  const date = at instanceof Date ? at : new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Net words per day, keyed by `dayKey`. */
export type Activity = Record<string, number>;

export function parseActivity(raw: string | null): Activity {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const out: Activity = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    // A key that is not a date and a value that is not a number are both
    // things older versions or a corrupted write could leave here.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = Math.round(value);
  }
  return out;
}

/** Add today's change to the log. Negative days count — see the note above. */
export function record(
  activity: Activity,
  delta: number,
  at: number = Date.now(),
): Activity {
  if (delta === 0) return activity;
  const key = dayKey(at);
  return { ...activity, [key]: (activity[key] ?? 0) + delta };
}

/**
 * Only what is worth keeping.
 *
 * A year is enough to answer every question this feature asks, and it keeps the
 * whole log at a few kilobytes — which matters, because this app already lives
 * close to the origin's storage ceiling.
 */
export function trim(activity: Activity, days = 365, now = Date.now()): Activity {
  const cutoff = now - days * 86_400_000;
  const out: Activity = {};
  for (const [key, value] of Object.entries(activity)) {
    if (new Date(`${key}T12:00:00`).getTime() >= cutoff) out[key] = value;
  }
  return out;
}

/** The last `days` days, oldest first, with zeroes for the days off. */
export function recentDays(
  activity: Activity,
  days = 30,
  now: number = Date.now(),
): { day: string; words: number }[] {
  const out: { day: string; words: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(now - i * 86_400_000);
    out.push({ day, words: activity[day] ?? 0 });
  }
  return out;
}

/**
 * Which ink step a day earns on the month grid — 0 for a day with nothing.
 *
 * **Four steps, and the lightest is deliberately reachable by one word.** The
 * question the grid answers is "did I turn up", and a day of forty words that
 * rendered as blank would answer it wrongly. Magnitude is the *second* thing it
 * says, which is why the top step is the busiest day rather than a fixed count:
 * a writer of three hundred words a day and one of three thousand should both
 * see a month with shape in it.
 *
 * A day of cutting is not a level. It is real work — the whole page says so —
 * but it cannot sit on a scale that runs light-to-dark for *more*, so the grid
 * marks it separately and the legend names it.
 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(words: number, busiest: number): HeatLevel {
  if (words <= 0 || busiest <= 0) return 0;
  const share = words / busiest;
  if (share > 0.75) return 4;
  if (share > 0.5) return 3;
  if (share > 0.25) return 2;
  return 1;
}

/**
 * How many blank cells go before the first day, so the columns are weekdays.
 *
 * A month grid whose columns are not weekdays is a grid of thirty squares in
 * rows of seven, which tells a reader nothing they could not get from a list.
 * Lined up, the column *is* the weekday — and "I never write on Wednesdays" is
 * the pattern this whole screen exists to make visible.
 *
 * Monday-first, matching the ISO week. `getDay()` counts from Sunday, hence the
 * shift rather than a lookup.
 */
export function leadingBlanks(firstDay: string): number {
  const at = new Date(`${firstDay}T12:00:00`);
  return (at.getDay() + 6) % 7;
}

/**
 * Consecutive days ending today, or ending yesterday.
 *
 * Yesterday counts, and that is a deliberate kindness rather than an
 * off-by-one: a writer who has not sat down *yet today* has not broken
 * anything, and a counter that resets at midnight would tell them they had.
 * Only a day with words in it counts — a day of pure deletion is work, but a
 * streak is about turning up.
 */
export function streak(activity: Activity, now: number = Date.now()): number {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);

  let start: number;
  if ((activity[today] ?? 0) > 0) start = 0;
  else if ((activity[yesterday] ?? 0) > 0) start = 1;
  else return 0;

  let count = 0;
  for (let i = start; i < 400; i++) {
    if ((activity[dayKey(now - i * 86_400_000)] ?? 0) > 0) count++;
    else break;
  }
  return count;
}

export interface Pace {
  /** Days in the window that had any writing on them. */
  daysWritten: number;
  windowDays: number;
  /** Net words across the window. */
  words: number;
  /** Across every day in the window, including the days off. */
  perDay: number;
  /** Only across the days actually written on. */
  perWritingDay: number;
}

export function pace(
  activity: Activity,
  days = 30,
  now: number = Date.now(),
): Pace {
  const recent = recentDays(activity, days, now);
  const words = recent.reduce((sum, d) => sum + d.words, 0);
  const daysWritten = recent.filter((d) => d.words > 0).length;
  return {
    daysWritten,
    windowDays: days,
    words,
    perDay: Math.round(words / days),
    perWritingDay: daysWritten > 0 ? Math.round(words / daysWritten) : 0,
  };
}

/**
 * When the book finishes at this rate.
 *
 * Returns null rather than a date whenever the answer would be a fiction: no
 * target, already there, or a pace of zero or less. **A projection off a
 * shrinking manuscript would read as "never", which is true arithmetic and a
 * cruel thing to print** at somebody in the middle of a hard revision.
 */
export function finishesOn(
  words: number,
  target: number | undefined,
  perDay: number,
  now: number = Date.now(),
): Date | null {
  if (!target || target <= 0) return null;
  if (words >= target) return null;
  if (perDay <= 0) return null;
  const days = Math.ceil((target - words) / perDay);
  // Past a couple of years the number stops meaning anything, and a date in
  // 2043 is a joke at the writer's expense rather than information.
  if (days > 730) return null;
  return new Date(now + days * 86_400_000);
}

/**
 * A day's short label, for a chart's x axis.
 *
 * Built from the `YYYY-MM-DD` key rather than from a `Date` the caller holds,
 * so the label and the bucket cannot disagree about which day this is. Noon
 * again, for the same reason every other reader here uses noon: a midnight
 * timestamp lands on the previous day in any timezone behind UTC.
 */
function shortLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}

export interface Series {
  /** The short label, e.g. "Aug 04". */
  date: string;
  words: number;
}

/**
 * Net words per day, shaped for a chart.
 *
 * A thin change of shape over `recentDays` rather than a second walk of the
 * log — two functions counting the same days two ways is how a chart and the
 * figure above it end up disagreeing by one.
 *
 * **A day of cutting stays negative.** The chart is expected to draw it below
 * the line; flattening it to zero here would make a month of revision look
 * exactly like a month of nothing, which is the one thing this whole feature
 * exists not to do.
 */
export function dailySeries(
  activity: Activity,
  days = 30,
  now: number = Date.now(),
): Series[] {
  return recentDays(activity, days, now).map((d) => ({
    date: shortLabel(d.day),
    words: d.words,
  }));
}

/**
 * What the manuscript weighed on each of the last `days` days.
 *
 * **Reconstructed backwards from a total we know**, subtracting each day's net
 * change as it walks back. Today's figure is the real one the shelf reports,
 * and every earlier day is that figure minus what has happened since — exact
 * arithmetic over two measured quantities, not a projection, and nothing
 * between two days is claimed to have been measured.
 *
 * Two things it is honest about rather than papering over:
 *
 * - **The log is trimmed at a year** (`trim`), so a writer whose log is shorter
 *   than the window gets a series that *starts where the log starts*. Padding
 *   the front with a flat run would draw a fortnight of "no change" that
 *   nobody lived.
 * - **A deleted book takes its words out of the total without leaving a delta**
 *   behind it. So this is the manuscript as the day log saw it, which is the
 *   only version of the past that can be reconstructed at all. Over the window
 *   this feature uses it is right or it is quiet; it is never invented.
 */
export function runningTotal(
  activity: Activity,
  totalWords: number,
  days = 30,
  now: number = Date.now(),
): Series[] {
  const recent = recentDays(activity, days, now);

  // Where the log actually begins, so a short log is not padded with a flat
  // run in front of it. `-1` — no day in the window carries anything — leaves
  // the series empty, and the card's empty state is what handles that.
  const first = recent.findIndex((d) => d.words !== 0);
  if (first === -1) return [];

  const window = recent.slice(first);

  // Walk back from today's known total, so the last point is the real figure
  // and every earlier one is derived from it.
  const totals: number[] = new Array(window.length);
  let running = totalWords;
  for (let i = window.length - 1; i >= 0; i--) {
    totals[i] = running;
    running -= window[i].words;
  }

  return window.map((d, i) => ({
    date: shortLabel(d.day),
    // A reconstruction can only go as far back as the log, and a book deleted
    // inside the window can walk it under zero. A manuscript has never had a
    // negative number of words in it, so the floor is the honest edge.
    words: Math.max(0, totals[i]),
  }));
}

/** One weekday's share of the window. */
export interface WeekdayTotal {
  name: string;
  value: number;
}

/**
 * Net words by day of the week, **Monday first**.
 *
 * Monday-first to match `leadingBlanks` and the month grid it lines up, so the
 * two screens cannot put Sunday in different places. This is the pattern the
 * whole idea of tracking is for — *"I never write on Wednesdays"* is a fact a
 * writer cannot see from the inside, and it is the one this list makes plain.
 *
 * A weekday that comes out negative is left negative. It reads as "Tuesdays are
 * when I cut", which is a true and useful thing to know about a revision.
 */
export function byWeekday(
  activity: Activity,
  days = 30,
  now: number = Date.now(),
): WeekdayTotal[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = [0, 0, 0, 0, 0, 0, 0];

  for (const day of recentDays(activity, days, now)) {
    // `getDay()` counts from Sunday; the shift puts Monday at 0, the same
    // arithmetic `leadingBlanks` uses.
    const at = new Date(`${day.day}T12:00:00`);
    totals[(at.getDay() + 6) % 7] += day.words;
  }

  return names.map((name, i) => ({ name, value: totals[i] }));
}
