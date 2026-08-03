import { describe, expect, it } from "vitest";
import {
  asPeriod,
  cycleLabel,
  displayPrice,
  durationOf,
  isOneOff,
  itemNameOf,
  payhereAmount,
  perMonthOf,
  periodEnd,
  priceOf,
  recurrenceOf,
} from "./plans";

/** The subscription cycles carry a per-month rate; lifetime deliberately does not. */
const monthly = (period: "monthly" | "annual", currency: "USD" | "LKR") => {
  const rate = perMonthOf(period, currency);
  if (rate === null) throw new Error("a cycle must have a monthly rate");
  return rate;
};

describe("prices", () => {
  it("charges a year up front at twelve times the annual monthly rate", () => {
    // The card shows a per-month figure on both cycles; the annual one is only
    // honest if the total is exactly twelve of them.
    expect(priceOf("annual", "USD")).toBeCloseTo(monthly("annual", "USD") * 12, 2);
    expect(priceOf("annual", "LKR")).toBeCloseTo(monthly("annual", "LKR") * 12, 2);
  });

  it("charges the monthly cycle its own rate", () => {
    expect(priceOf("monthly", "USD")).toBe(monthly("monthly", "USD"));
  });

  it("makes the annual cycle the cheaper of the two by the month", () => {
    expect(monthly("annual", "USD")).toBeLessThan(monthly("monthly", "USD"));
    expect(monthly("annual", "LKR")).toBeLessThan(monthly("monthly", "LKR"));
  });

  // A position rather than a behaviour. Dividing a one-off purchase by an
  // assumed number of months would invent a rate out of a guess about how long
  // somebody keeps writing — the exact kind of figure this product refuses
  // everywhere else. The card prints the whole price and the word "once".
  it("gives lifetime no per-month rate at all", () => {
    expect(perMonthOf("lifetime", "USD")).toBeNull();
    expect(perMonthOf("lifetime", "LKR")).toBeNull();
  });

  it("prices lifetime above a year, or nobody would ever subscribe", () => {
    expect(priceOf("lifetime", "USD")).toBeGreaterThan(priceOf("annual", "USD"));
    expect(priceOf("lifetime", "LKR")).toBeGreaterThan(priceOf("annual", "LKR"));
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

describe("the one-off", () => {
  it("knows which one does not come round again", () => {
    expect(isOneOff("lifetime")).toBe(true);
    expect(isOneOff("monthly")).toBe(false);
    expect(isOneOff("annual")).toBe(false);
  });

  /*
   * The most expensive mistake available in this file.
   *
   * PayHere decides whether a payment repeats from the presence of
   * `recurrence` and `duration` on the checkout. Shipping them against a
   * lifetime order would set up a $199 charge every month. Null is what makes
   * the checkout leave the fields out entirely.
   */
  it("sends PayHere no recurrence and no duration for a lifetime purchase", () => {
    expect(recurrenceOf("lifetime")).toBeNull();
    expect(durationOf("lifetime")).toBeNull();
  });

  it("still sends both for the cycles that do repeat", () => {
    expect(recurrenceOf("monthly")).toBe("1 Month");
    expect(recurrenceOf("annual")).toBe("1 Year");
    expect(durationOf("monthly")).toBe("Forever");
    expect(durationOf("annual")).toBe("Forever");
  });

  it("names what is being bought, on PayHere's own page", () => {
    expect(itemNameOf("lifetime")).toBe("OpenChapter Pro (lifetime)");
    expect(itemNameOf("annual")).toBe("OpenChapter Pro (annual)");
    expect(itemNameOf("monthly")).toBe("OpenChapter Pro (monthly)");
  });

  it("says 'once' rather than naming a cycle it does not have", () => {
    expect(cycleLabel("lifetime")).toBe("once");
    expect(cycleLabel("annual")).toBe("a year");
    expect(cycleLabel("monthly")).toBe("a month");
  });
});

describe("periodEnd", () => {
  const at = (iso: string) => new Date(iso);
  /** Every cycle here has an end; the test that has none is separate, below. */
  const ends = (from: Date, period: "monthly" | "annual") => {
    const end = periodEnd(from, period);
    if (!end) throw new Error("a cycle must end somewhere");
    return end;
  };

  it("adds a month", () => {
    expect(ends(at("2026-01-15T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2026-02-15T10:00:00.000Z",
    );
  });

  it("adds a year", () => {
    expect(ends(at("2026-01-15T10:00:00.000Z"), "annual").toISOString()).toBe(
      "2027-01-15T10:00:00.000Z",
    );
  });

  // The one that bites: setUTCMonth on the 31st of January lands in March,
  // which would quietly hand the writer an extra month every January.
  it("clamps a month that has no such day", () => {
    expect(ends(at("2026-01-31T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
  });

  it("clamps into a leap February", () => {
    expect(ends(at("2028-01-31T10:00:00.000Z"), "monthly").toISOString()).toBe(
      "2028-02-29T10:00:00.000Z",
    );
  });

  it("handles a leap day a year on", () => {
    expect(ends(at("2028-02-29T10:00:00.000Z"), "annual").toISOString()).toBe(
      "2029-02-28T10:00:00.000Z",
    );
  });

  it("does not modify the date it was given", () => {
    const from = at("2026-01-15T10:00:00.000Z");
    periodEnd(from, "annual");
    expect(from.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });

  // Another position. A far-future sentinel was the easy wrong answer: every
  // screen rendering currentPeriodEnd would then tell a writer their outright
  // purchase renews in the year 2999.
  it("refuses to invent an end date for a lifetime purchase", () => {
    expect(periodEnd(at("2026-01-15T10:00:00.000Z"), "lifetime")).toBeNull();
  });
});

describe("asPeriod", () => {
  it("passes the three it knows", () => {
    expect(asPeriod("monthly")).toBe("monthly");
    expect(asPeriod("annual")).toBe("annual");
    expect(asPeriod("lifetime")).toBe("lifetime");
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
