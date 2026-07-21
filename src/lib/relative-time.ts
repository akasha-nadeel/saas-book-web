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
