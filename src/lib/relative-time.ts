/**
 * "11 minutes ago", "5 months ago" — the shelf's Last opened column.
 *
 * Intl.RelativeTimeFormat does the wording and the pluralisation; the only
 * thing worth writing here is choosing the unit, and the boundaries are where
 * this kind of code usually goes wrong.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Average, deliberately: calendar months are not a fixed length. */
const MONTH = 30.44 * DAY;
const YEAR = 365.25 * DAY;

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTime(then: number, now: number = Date.now()): string {
  const elapsed = now - then;

  // Under a minute reads better as words than as "0 minutes ago".
  if (elapsed < MINUTE) return "just now";

  const [unit, size]: [Intl.RelativeTimeFormatUnit, number] =
    elapsed < HOUR
      ? ["minute", MINUTE]
      : elapsed < DAY
        ? ["hour", HOUR]
        : elapsed < WEEK
          ? ["day", DAY]
          : elapsed < MONTH
            ? ["week", WEEK]
            : elapsed < YEAR
              ? ["month", MONTH]
              : ["year", YEAR];

  // Negative because the value is in the past. Math.round would call 90 seconds
  // "2 minutes ago", which is a small lie about something the writer can check.
  return formatter.format(-Math.floor(elapsed / size), unit);
}

/**
 * "in 13 days", "tomorrow" — the other direction, for a deadline.
 *
 * A separate function rather than a sign check inside `relativeTime`, because that
 * one answers "just now" for anything under a minute *elapsed* — and a negative
 * elapsed is under a minute. So a pending invitation with a fortnight left read
 * "expires just now", which is the kind of wrong that looks like a bug in the
 * thing being described rather than in the clock.
 *
 * Rounds *up*, unlike its sibling: an invitation with 13 days and 4 hours left has
 * "13 days" left by flooring and "14" by rounding, and the useful direction to be
 * wrong in on a deadline is the conservative one. Anything already past says so
 * rather than counting backwards.
 */
export function timeUntil(then: number, now: number = Date.now()): string {
  const remaining = then - now;
  if (remaining <= 0) return "now";
  if (remaining < MINUTE) return "in under a minute";

  const [unit, size]: [Intl.RelativeTimeFormatUnit, number] =
    remaining < HOUR
      ? ["minute", MINUTE]
      : remaining < DAY
        ? ["hour", HOUR]
        : remaining < WEEK
          ? ["day", DAY]
          : remaining < MONTH
            ? ["week", WEEK]
            : remaining < YEAR
              ? ["month", MONTH]
              : ["year", YEAR];

  return formatter.format(Math.ceil(remaining / size), unit);
}
