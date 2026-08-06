import { expect, it } from "vitest";
import { relativeTime, timeUntil } from "@/lib/relative-time";

const NOW = Date.UTC(2026, 6, 21, 12, 0, 0);
const ago = (ms: number) => relativeTime(NOW - ms, NOW);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

it("says just now for anything under a minute", () => {
  expect(ago(0)).toBe("just now");
  expect(ago(59 * SECOND)).toBe("just now");
});

it("counts minutes and hours", () => {
  expect(ago(MINUTE)).toBe("1 minute ago");
  expect(ago(11 * MINUTE)).toBe("11 minutes ago");
  expect(ago(HOUR)).toBe("1 hour ago");
  expect(ago(5 * HOUR)).toBe("5 hours ago");
});

it("uses 'yesterday' where the locale prefers it", () => {
  // numeric: "auto" is what turns 1 day into "yesterday" rather than "1 day ago".
  expect(ago(DAY)).toBe("yesterday");
});

it("counts days, weeks, months and years", () => {
  expect(ago(3 * DAY)).toBe("3 days ago");
  expect(ago(21 * DAY)).toBe("3 weeks ago");
  expect(ago(150 * DAY)).toBe("4 months ago");
  expect(ago(800 * DAY)).toBe("2 years ago");
});

it("says 'last week' rather than '1 week ago', as with yesterday", () => {
  // numeric: "auto" special-cases a single unit. Better English, and the same
  // rule that produces "yesterday".
  expect(ago(10 * DAY)).toBe("last week");
  expect(ago(60 * DAY)).toBe("last month");
  expect(ago(400 * DAY)).toBe("last year");
});

it("rounds down rather than up", () => {
  // 90 seconds is "1 minute ago". Rounding would say 2, which is a small lie
  // about something the writer can check against the clock.
  expect(ago(90 * SECOND)).toBe("1 minute ago");
  expect(ago(119 * MINUTE)).toBe("1 hour ago");
});

it("does not fall off the end at unit boundaries", () => {
  expect(ago(59 * MINUTE)).toBe("59 minutes ago");
  expect(ago(23 * HOUR)).toBe("23 hours ago");
});

// ---------------------------------------------------------------------------
// The other direction
// ---------------------------------------------------------------------------

const until = (ms: number) => timeUntil(NOW + ms, NOW);

/*
 * The one not to "fix". `relativeTime` answers "just now" for anything under a
 * minute *elapsed*, and a future stamp has a negative elapsed — so a pending
 * invitation with a fortnight left read "expires just now". That is the kind of
 * wrong that looks like a bug in the invitation rather than in the clock.
 */
it("counts forwards rather than saying just now", () => {
  expect(until(14 * DAY)).not.toBe("just now");
  expect(until(3 * DAY)).toBe("in 3 days");
});

it("says a deadline already past is now, not a countdown backwards", () => {
  expect(until(0)).toBe("now");
  expect(until(-5 * DAY)).toBe("now");
});

it("rounds up, because the conservative answer is the useful one on a deadline", () => {
  // 13 days and 4 hours: flooring says 13, which promises time that is not there.
  expect(until(13 * DAY + 4 * HOUR)).toBe("in 2 weeks");
  expect(until(90 * MINUTE)).toBe("in 2 hours");
});

it("uses the words English has for a single unit", () => {
  expect(until(DAY)).toBe("tomorrow");
  // And note how that interacts with rounding up: 25 hours is *not* tomorrow,
  // because ceiling it lands on two days. Deliberate — the alternative promises
  // a deadline more time than it has.
  expect(until(25 * HOUR)).toBe("in 2 days");
});

it("does not fall off the end at unit boundaries", () => {
  expect(until(59 * MINUTE)).toBe("in 59 minutes");
  expect(until(23 * HOUR)).toBe("in 23 hours");
});
