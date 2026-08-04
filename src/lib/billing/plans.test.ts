import { describe, expect, it } from "vitest";
import {
  asPeriod,
  cycleLabel,
  displayPrice,
  durationOf,
  itemNameOf,
  payhereAmount,
  perMonthOf,
  periodEnd,
  priceOf,
  recurrenceOf,
} from "./plans";

describe("prices", () => {
  it("charges a year up front at twelve times the annual monthly rate", () => {
    // The card shows a per-month figure on both cycles; the annual one is only
    // honest if the total is exactly twelve of them.
    expect(priceOf("annual", "USD")).toBeCloseTo(perMonthOf("annual", "USD") * 12, 2);
    expect(priceOf("annual", "LKR")).toBeCloseTo(perMonthOf("annual", "LKR") * 12, 2);
  });

  it("charges the monthly cycle its own rate", () => {
    expect(priceOf("monthly", "USD")).toBe(perMonthOf("monthly", "USD"));
  });

  it("makes the annual cycle the cheaper of the two by the month", () => {
    expect(perMonthOf("annual", "USD")).toBeLessThan(perMonthOf("monthly", "USD"));
    expect(perMonthOf("annual", "LKR")).toBeLessThan(perMonthOf("monthly", "LKR"));
  });
});

describe("displayPrice", () => {
  it("writes dollars with cents", () => {
    // Cents shown even when they are zero: "$9" beside "$0" on the other card
    // is two different shapes of number for one comparison.
    expect(displayPrice(9, "USD")).toBe("$9.00");
    expect(displayPrice(72, "USD")).toBe("$72.00");
  });

  it("writes rupees whole, with a separator", () => {
    expect(displayPrice(2900, "LKR")).toBe("Rs 2,900");
    expect(displayPrice(23400, "LKR")).toBe("Rs 23,400");
  });
});

describe("payhereAmount", () => {
  // This exact string goes into the hash. A separator or a third decimal here
  // is a checkout PayHere refuses, with an error that names neither.
  it("is always two decimals and never separated", () => {
    expect(payhereAmount(9)).toBe("9.00");
    expect(payhereAmount(72)).toBe("72.00");
    expect(payhereAmount(23400)).toBe("23400.00");
  });
});

describe("what PayHere is told", () => {
  // These two fields are the whole of what makes a charge repeat: leave either
  // out and PayHere takes the money once and never renews.
  it("sends a recurrence and a duration on every plan", () => {
    expect(recurrenceOf("monthly")).toBe("1 Month");
    expect(recurrenceOf("annual")).toBe("1 Year");
    expect(durationOf()).toBe("Forever");
  });

  it("names what is being bought, on PayHere's own page", () => {
    expect(itemNameOf("annual")).toBe("OpenChapter Pro (annual)");
    expect(itemNameOf("monthly")).toBe("OpenChapter Pro (monthly)");
  });

  it("reads the cycle as a phrase for the checkout summary", () => {
    expect(cycleLabel("annual")).toBe("a year");
    expect(cycleLabel("monthly")).toBe("a month");
  });
});

describe("periodEnd", () => {
  const at = (iso: string) => new Date(iso);
  it("adds a month", () => {
    expect(periodEnd(at("2026-01-15T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2026-02-15T10:00:00.000Z",
    );
  });

  it("adds a year", () => {
    expect(periodEnd(at("2026-01-15T10:00:00.000Z"), "annual").toISOString()).toBe(
      "2027-01-15T10:00:00.000Z",
    );
  });

  // The one that bites: setUTCMonth on the 31st of January lands in March,
  // which would quietly hand the writer an extra month every January.
  it("clamps a month that has no such day", () => {
    expect(periodEnd(at("2026-01-31T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
  });

  it("clamps into a leap February", () => {
    expect(periodEnd(at("2028-01-31T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2028-02-29T10:00:00.000Z",
    );
  });

  it("handles a leap day a year on", () => {
    expect(periodEnd(at("2028-02-29T10:00:00.000Z"), "annual").toISOString()).toBe(
      "2029-02-28T10:00:00.000Z",
    );
  });

  it("does not modify the date it was given", () => {
    const from = at("2026-01-15T10:00:00.000Z");
    periodEnd(from, "annual");
    expect(from.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });
});

describe("asPeriod", () => {
  it("passes the two it knows", () => {
    expect(asPeriod("monthly")).toBe("monthly");
    expect(asPeriod("annual")).toBe("annual");
  });

  it("refuses anything else", () => {
    // These arrive off a URL and out of a database column, neither of which a
    // compiler has ever checked.
    expect(asPeriod("weekly")).toBeNull();
    // A lifetime tier was built and removed. Nothing can have written that
    // value — the CHECK constraint allowing it was never applied — but this is
    // the guard that would catch one if it had.
    expect(asPeriod("lifetime")).toBeNull();
    expect(asPeriod(null)).toBeNull();
    expect(asPeriod(undefined)).toBeNull();
    expect(asPeriod(1)).toBeNull();
  });
});
