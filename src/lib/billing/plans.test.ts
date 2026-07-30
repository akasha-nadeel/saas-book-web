import { describe, expect, it } from "vitest";
import {
  asPeriod,
  displayPrice,
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
    // Cents shown even when they are zero: "$5" beside "$0" on the other card
    // is two different shapes of number for one comparison.
    expect(displayPrice(5, "USD")).toBe("$5.00");
    expect(displayPrice(48, "USD")).toBe("$48.00");
  });

  it("writes rupees whole, with a separator", () => {
    expect(displayPrice(1990, "LKR")).toBe("Rs 1,990");
    expect(displayPrice(19080, "LKR")).toBe("Rs 19,080");
  });
});

describe("payhereAmount", () => {
  // This exact string goes into the hash. A separator or a third decimal here
  // is a checkout PayHere refuses, with an error that names neither.
  it("is always two decimals and never separated", () => {
    expect(payhereAmount(5)).toBe("5.00");
    expect(payhereAmount(48)).toBe("48.00");
    expect(payhereAmount(19080)).toBe("19080.00");
  });
});

describe("recurrenceOf", () => {
  it("uses PayHere's number-and-unit form", () => {
    expect(recurrenceOf("monthly")).toBe("1 Month");
    expect(recurrenceOf("annual")).toBe("1 Year");
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
    expect(asPeriod(null)).toBeNull();
    expect(asPeriod(undefined)).toBeNull();
    expect(asPeriod(1)).toBeNull();
  });
});
