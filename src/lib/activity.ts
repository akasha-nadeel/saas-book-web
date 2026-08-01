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
