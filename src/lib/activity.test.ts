import { describe, expect, it } from "vitest";
import {
  byWeekday,
  dailySeries,
  dayKey,
  finishesOn,
  heatLevel,
  leadingBlanks,
  pace,
  parseActivity,
  recentDays,
  record,
  runningTotal,
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

describe("dailySeries", () => {
  it("keeps every day in the window, including the days off", () => {
    const days = dailySeries({ [ago(1)]: 400 }, 3, NOW);
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.words)).toEqual([0, 400, 0]);
  });

  /**
   * The rule the whole feature turns on. A chart that flattened a cutting day
   * to zero would draw a month of revision exactly like a month of nothing.
   */
  it("leaves a day of cutting negative", () => {
    const days = dailySeries({ [ago(0)]: -800 }, 2, NOW);
    expect(days[days.length - 1].words).toBe(-800);
  });

  it("labels each day for an axis", () => {
    const days = dailySeries({ [ago(0)]: 10 }, 1, NOW);
    expect(days[0].date).toMatch(/\w+\s*0?1/);
  });
});

describe("runningTotal", () => {
  it("ends on the total it was given", () => {
    // Today's figure is the real one the shelf reports; everything before it
    // is that figure minus what has happened since.
    const series = runningTotal({ [ago(1)]: 500, [ago(0)]: 300 }, 10_000, 5, NOW);
    expect(series[series.length - 1].words).toBe(10_000);
  });

  it("walks back through each day's change", () => {
    const activity = { [ago(2)]: 1000, [ago(1)]: 500, [ago(0)]: 300 };
    const series = runningTotal(activity, 10_000, 5, NOW);
    // 10,000 today; 9,700 before today's 300; 9,200 before yesterday's 500.
    expect(series.map((d) => d.words)).toEqual([9200, 9700, 10_000]);
  });

  /**
   * The log is trimmed at a year, so a writer whose log is shorter than the
   * window would otherwise get a flat run in front of it that nobody lived.
   */
  it("starts where the log starts rather than padding the front", () => {
    const series = runningTotal({ [ago(1)]: 500 }, 10_000, 30, NOW);
    expect(series).toHaveLength(2);
  });

  it("gives nothing at all for a log with no days in the window", () => {
    expect(runningTotal({}, 10_000, 30, NOW)).toEqual([]);
  });

  // A manuscript has never had a negative number of words in it.
  it("does not walk under zero when the log outruns the total", () => {
    const series = runningTotal({ [ago(1)]: 9000 }, 1000, 5, NOW);
    expect(series.every((d) => d.words >= 0)).toBe(true);
  });
});

describe("byWeekday", () => {
  it("puts Monday first, matching the month grid", () => {
    expect(byWeekday({}, 7, NOW).map((d) => d.name)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("sums a weekday across the window", () => {
    // NOW is a Saturday; a week back is the Saturday before it.
    const activity = { [ago(0)]: 300, [ago(7)]: 200 };
    const saturday = byWeekday(activity, 14, NOW).find((d) => d.name === "Sat");
    expect(saturday?.value).toBe(500);
  });

  /**
   * Must not become `Math.abs`. "Tuesdays are when I cut" is a true and useful
   * thing to know about a revision, and the sign is the whole of it.
   */
  it("leaves a weekday of cutting negative", () => {
    const day = new Date(`${ago(0)}T12:00:00`).getDay();
    const name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(day + 6) % 7];
    const totals = byWeekday({ [ago(0)]: -400 }, 7, NOW);
    expect(totals.find((d) => d.name === name)?.value).toBe(-400);
  });

  it("has every weekday even for a log with nothing in it", () => {
    expect(byWeekday({}, 30, NOW)).toHaveLength(7);
  });
});
