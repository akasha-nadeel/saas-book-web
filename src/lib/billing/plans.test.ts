import { describe, expect, it } from "vitest";
import {
  annualSavingPercent,
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
  uniformAnnualSaving,
} from "./plans";
import { PAID_TIERS, TIER_NAMES } from "./tiers";

describe("prices", () => {
  it("charges a year up front at twelve times the annual monthly rate", () => {
    // The card shows a per-month figure on both cycles; the annual one is only
    // honest if the total is exactly twelve of them.
    for (const tier of PAID_TIERS) {
      expect(priceOf(tier, "annual")).toBeCloseTo(
        perMonthOf(tier, "annual") * 12,
        2,
      );
    }
  });

  it("charges the monthly cycle its own rate", () => {
    for (const tier of PAID_TIERS) {
      expect(priceOf(tier, "monthly")).toBe(perMonthOf(tier, "monthly"));
    }
  });

  it("makes the annual cycle the cheaper of the two by the month", () => {
    for (const tier of PAID_TIERS) {
      expect(perMonthOf(tier, "annual")).toBeLessThan(
        perMonthOf(tier, "monthly"),
      );
    }
  });

  /**
   * **A hand-edited three-tier table gets transposed, and both orders look
   * plausible.** Nothing else in the tree would notice Studio priced below
   * Writer — the cards would render it, the checkout would charge it, and the
   * only symptom is revenue.
   */
  it("makes each plan dearer than the one below it", () => {
    for (const period of ["monthly", "annual"] as const) {
      expect(priceOf("draft", period)).toBeLessThan(priceOf("writer", period));
      expect(priceOf("writer", period)).toBeLessThan(priceOf("studio", period));
    }
  });
});

describe("displayPrice", () => {
  it("writes dollars with cents", () => {
    // Cents shown even when they are zero: "$9" beside "$0" on the other card
    // is two different shapes of number for one comparison.
    expect(displayPrice(5.98)).toBe("$5.98");
    expect(displayPrice(53.99)).toBe("$53.99");
  });

  it("uses the three ladders the cards print", () => {
    expect(priceOf("draft", "monthly")).toBe(7.98);
    expect(priceOf("writer", "monthly")).toBe(14.98);
    expect(priceOf("studio", "monthly")).toBe(29.98);

    expect(priceOf("draft", "annual")).toBe(71.82);
    expect(priceOf("writer", "annual")).toBe(134.99);
    expect(priceOf("studio", "annual")).toBe(269.82);
  });

  it("divides the annual total rather than printing a typed figure", () => {
    expect(displayPrice(perMonthOf("draft", "annual"))).toBe("$5.98");
    expect(displayPrice(perMonthOf("writer", "annual"))).toBe("$11.25");
    expect(displayPrice(perMonthOf("studio", "annual"))).toBe("$22.49");
  });
});

describe("payhereAmount", () => {
  // This exact string goes into the hash. A separator or a third decimal here
  // is a checkout PayHere refuses, with an error that names neither.
  it("is always two decimals and never separated", () => {
    expect(payhereAmount(9)).toBe("9.00");
    expect(payhereAmount(72)).toBe("72.00");
    expect(payhereAmount(224.99)).toBe("224.99");
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

  /**
   * The plan's name on the receipt comes from the same table the cards read,
   * so a rename cannot leave a writer paying for "OpenChapter Pro" on a page
   * that offers no such thing.
   */
  it("names what is being bought, on PayHere's own page", () => {
    for (const tier of PAID_TIERS) {
      for (const period of ["monthly", "annual"] as const) {
        expect(itemNameOf(tier, period)).toBe(
          `OpenChapter ${TIER_NAMES[tier]} (${period})`,
        );
      }
    }
    expect(itemNameOf("writer", "annual")).toBe("OpenChapter Writer (annual)");
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

describe("annualSavingPercent", () => {
  it("is the saving the pricing page prints, on every plan", () => {
    // The badge on the cycle toggle says this number. It is derived rather
    // than typed precisely so that moving a price moves the badge — the
    // previous hand-written figure survived a price change and became a false
    // claim on the one page a customer reads before paying.
    for (const tier of PAID_TIERS) expect(annualSavingPercent(tier)).toBe(25);
  });

  it("agrees with the two prices it describes", () => {
    for (const tier of PAID_TIERS) {
      const monthly = perMonthOf(tier, "monthly");
      const annual = perMonthOf(tier, "annual");
      expect(annualSavingPercent(tier)).toBe(
        Math.round(((monthly - annual) / monthly) * 100),
      );
    }
  });

  it("stays inside what this trade actually does", () => {
    // Not a style rule: the convention is "two months free" (about 17%), the
    // usual band is 15-20%, and past 30% the annual plan is quietly cheaper
    // than the business intends rather than deliberately generous. The USD
    // annual sat at 34% for a week on exactly that mistake.
    for (const tier of PAID_TIERS) {
      expect(annualSavingPercent(tier)).toBeGreaterThanOrEqual(10);
      expect(annualSavingPercent(tier)).toBeLessThanOrEqual(30);
    }
  });
});

/**
 * **The badge's precondition, and the reason it is a function rather than an
 * assumption.**
 *
 * One "Save 25%" chip now sits above three columns. That it is true of all
 * three today is arithmetic that happens to work out, not a rule anybody
 * enforces — so the toggle asks before printing, and this asserts the answer it
 * currently gets. If a price moves and the three stop agreeing, the badge
 * disappears rather than lying, and this test says so out loud.
 */
describe("uniformAnnualSaving", () => {
  it("is the one figure the period toggle may print", () => {
    expect(uniformAnnualSaving()).toBe(25);
    for (const tier of PAID_TIERS) {
      expect(annualSavingPercent(tier)).toBe(uniformAnnualSaving());
    }
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
