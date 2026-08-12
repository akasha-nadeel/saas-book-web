import { describe, expect, it } from "vitest";
import {
  dayKey,
  finishesOn,
  heatLevel,
  leadingBlanks,
  pace,
  parseActivity,
  recentDays,
  record,
  streak,
  trim,
  type Activity,
} from "./activity";

describe("heatLevel", () => {
  it("gives a day with nothing on it no level at all", () => {
    expect(heatLevel(0, 1000)).toBe(0);
  });

  it("gives one word a visible step", () => {
    // The grid's first question is "did I turn up". A day of forty words drawn
    // as blank answers it wrongly.
    expect(heatLevel(1, 10_000)).toBe(1);
    expect(heatLevel(40, 10_000)).toBe(1);
  });

  it("puts the busiest day at the top step", () => {
    expect(heatLevel(1000, 1000)).toBe(4);
  });

  it("climbs with the share of the busiest day", () => {
    expect(heatLevel(200, 1000)).toBe(1);
    expect(heatLevel(400, 1000)).toBe(2);
    expect(heatLevel(600, 1000)).toBe(3);
    expect(heatLevel(800, 1000)).toBe(4);
  });

  it("is no level for a day of cutting, which the grid marks separately", () => {
    // A cut cannot sit on a scale running light-to-dark for *more*, and it is
    // still work — so it is marked rather than ranked. See the note in place.
    expect(heatLevel(-900, 1000)).toBe(0);
  });

  it("does not divide by a month with nothing in it", () => {
    expect(heatLevel(0, 0)).toBe(0);
    expect(heatLevel(50, 0)).toBe(0);
  });
});

describe("leadingBlanks", () => {
  it("puts Monday at the start of the row", () => {
    // 2026-08-10 is a Monday.
    expect(leadingBlanks("2026-08-10")).toBe(0);
  });

  it("counts the days before it for every other weekday", () => {
    expect(leadingBlanks("2026-08-11")).toBe(1); // Tuesday
    expect(leadingBlanks("2026-08-15")).toBe(5); // Saturday
    expect(leadingBlanks("2026-08-16")).toBe(6); // Sunday
  });

  it("reads the day at midday, so a clock change cannot shift the column", () => {
    // The same trick `trim` and `daysBetween` use: a bare date parsed at
    // midnight can land on the wrong side of a daylight-saving boundary.
    expect(leadingBlanks("2026-03-29")).toBe(6); // Sunday
  });
});

const DAY = 86_400_000;
/** A fixed midday, so nothing here can trip over a timezone at a boundary. */
const NOW = new Date("2026-08-01T12:00:00").getTime();
const ago = (days: number) => dayKey(NOW - days * DAY);

describe("dayKey", () => {
  it("uses the writer's own day, not UTC", () => {
    // Late evening local time is still today, whatever UTC thinks.
    const evening = new Date("2026-08-01T23:30:00").getTime();
    expect(dayKey(evening)).toBe("2026-08-01");
  });
});

describe("parseActivity", () => {
  it("reads a stored log", () => {
    expect(parseActivity('{"2026-08-01":1200}')).toEqual({ "2026-08-01": 1200 });
  });

  it("drops keys that are not dates and values that are not numbers", () => {
    const stored = '{"2026-08-01":10,"nonsense":5,"2026-08-02":"lots"}';
    expect(parseActivity(stored)).toEqual({ "2026-08-01": 10 });
  });

  it("survives storage that is not JSON, or is a list", () => {
    expect(parseActivity("not json")).toEqual({});
    expect(parseActivity("[1,2]")).toEqual({});
    expect(parseActivity(null)).toEqual({});
  });
});

describe("record", () => {
  it("adds to today's total", () => {
    const first = record({}, 500, NOW);
    expect(record(first, 300, NOW)[dayKey(NOW)]).toBe(800);
  });

  /**
   * Revising a chapter down by 800 words is work. A counter that only went up
   * would call that a wasted day.
   */
  it("counts a day of cutting", () => {
    expect(record({}, -800, NOW)[dayKey(NOW)]).toBe(-800);
  });

  it("ignores a save that changed nothing", () => {
    expect(record({}, 0, NOW)).toEqual({});
  });

  it("leaves the original alone", () => {
    const before: Activity = {};
    record(before, 100, NOW);
    expect(before).toEqual({});
  });
});

describe("trim", () => {
  it("keeps a year and drops what is older", () => {
    const activity = { [ago(10)]: 100, [ago(400)]: 100 };
    const kept = trim(activity, 365, NOW);
    expect(kept[ago(10)]).toBe(100);
    expect(kept[ago(400)]).toBeUndefined();
  });
});

describe("recentDays", () => {
  it("fills the days off with zero, oldest first", () => {
    const days = recentDays({ [ago(1)]: 400 }, 3, NOW);
    expect(days).toHaveLength(3);
    expect(days[days.length - 1].day).toBe(dayKey(NOW));
    expect(days.map((d) => d.words)).toEqual([0, 400, 0]);
  });
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    const activity = { [ago(0)]: 1, [ago(1)]: 1, [ago(2)]: 1 };
    expect(streak(activity, NOW)).toBe(3);
  });

  /**
   * A deliberate kindness rather than an off-by-one. A writer who has not sat
   * down *yet today* has not broken anything, and a counter that reset at
   * midnight would tell them they had.
   */
  it("does not break a streak just because today is young", () => {
    expect(streak({ [ago(1)]: 1, [ago(2)]: 1 }, NOW)).toBe(2);
  });

  it("is broken by a whole day missed", () => {
    expect(streak({ [ago(2)]: 1, [ago(3)]: 1 }, NOW)).toBe(0);
  });

  // Cutting is work, but a streak is about turning up with words.
  it("does not count a day that only lost words", () => {
    expect(streak({ [ago(0)]: -500 }, NOW)).toBe(0);
  });

  it("is zero for a writer who has never written", () => {
    expect(streak({}, NOW)).toBe(0);
  });
});

describe("pace", () => {
  it("separates words a day from words a writing day", () => {
    const activity = { [ago(0)]: 1000, [ago(1)]: 1000 };
    const p = pace(activity, 10, NOW);
    expect(p.daysWritten).toBe(2);
    expect(p.words).toBe(2000);
    expect(p.perDay).toBe(200);
    expect(p.perWritingDay).toBe(1000);
  });

  it("has no per-writing-day figure for somebody who has not written", () => {
    expect(pace({}, 30, NOW).perWritingDay).toBe(0);
  });
});

describe("finishesOn", () => {
  it("projects a finish date from the pace", () => {
    const date = finishesOn(50_000, 90_000, 1000, NOW)!;
    expect(date.getTime()).toBe(NOW + 40 * DAY);
  });

  it("says nothing without a target", () => {
    expect(finishesOn(50_000, undefined, 1000, NOW)).toBeNull();
  });

  it("says nothing to somebody who is already there", () => {
    expect(finishesOn(95_000, 90_000, 1000, NOW)).toBeNull();
  });

  /**
   * True arithmetic, and a cruel thing to print at somebody in the middle of a
   * hard revision.
   */
  it("refuses to answer off a shrinking manuscript", () => {
    expect(finishesOn(50_000, 90_000, -200, NOW)).toBeNull();
    expect(finishesOn(50_000, 90_000, 0, NOW)).toBeNull();
  });

  it("refuses a date so far off it is a joke at the writer's expense", () => {
    expect(finishesOn(0, 90_000, 1, NOW)).toBeNull();
  });
});
