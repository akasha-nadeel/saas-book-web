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
  upgradeTo,
} from "./plans";
import { PAID_TIERS, TIER_NAMES, asPaidTier } from "./tiers";
import { safeNext } from "../auth-redirect";

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
   * **The floor the price was set against.** At least $5.00 kept on a monthly
   * sale after Paddle's 5% + 50¢; see the note on `PRICES`. A price moved
   * below it is a plan that costs more to sell than it returns.
   */
  it("keeps at least five dollars of a monthly sale after the gateway's fee", () => {
    for (const tier of PAID_TIERS) {
      expect(priceOf(tier, "monthly") * 0.95 - 0.5).toBeGreaterThanOrEqual(5);
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

  it("uses the prices the cards print", () => {
    expect(priceOf("pro", "monthly")).toBe(5.99);
    expect(priceOf("pro", "annual")).toBe(59.88);
  });

  it("divides the annual total rather than printing a typed figure", () => {
    expect(displayPrice(perMonthOf("pro", "annual"))).toBe("$4.99");
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
    expect(itemNameOf("pro", "annual")).toBe("OpenChapter Pro (annual)");
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
    for (const tier of PAID_TIERS) expect(annualSavingPercent(tier)).toBe(17);
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
 * One "Save 17%" chip sits above the paid columns. With one paid plan that is
 * Pro's own saving; the toggle still asks before printing, so a second plan
 * whose saving differs makes the badge disappear rather than lie, and this
 * test says so out loud.
 */
/**
 * **The whole "press Upgrade, sign in, land in the checkout" flow rests on this
 * string surviving a round trip**, and every hop is somewhere it could be lost:
 * `encodeURIComponent` into `?next=`, `safeNext`'s open-redirect allowlist, and
 * two narrowing functions on the far side. A parameter renamed at one end fails
 * silently — the writer lands on the plain pricing page having lost what they
 * pressed — so the agreement is pinned here rather than left to two call sites
 * spelling it the same way by luck.
 */
describe("upgradeTo", () => {
  it("survives the trip through ?next= and back", () => {
    for (const tier of PAID_TIERS) {
      for (const period of ["monthly", "annual"] as const) {
        const target = upgradeTo(tier, period);

        // The door: the landing page and the pricing card both encode it.
        const next = encodeURIComponent(target);
        // …and `safeNext` is what decides whether it is allowed back out.
        expect(safeNext(decodeURIComponent(next))).toBe(target);

        // The far side reads it with the same two narrowing functions the page
        // uses, not by splitting the string by hand.
        const params = new URL(target, "https://openchapterapp.com").searchParams;
        expect(asPaidTier(params.get("buy"))).toBe(tier);
        expect(asPeriod(params.get("period"))).toBe(period);
      }
    }
  });

  it("is refused by the narrowing when somebody types their own", () => {
    // A query string is whatever somebody put there. Both halves have to be
    // recognised or the page shows its ordinary self and starts nothing.
    const params = new URL(
      "/upgrade?buy=wizard&period=fortnightly",
      "https://openchapterapp.com",
    ).searchParams;
    expect(asPaidTier(params.get("buy"))).toBeNull();
    expect(asPeriod(params.get("period"))).toBeNull();
  });

  it("cannot be turned into an off-site redirect", () => {
    // `upgradeTo` is rooted and same-site by construction; this is the guard
    // that keeps it that way if anyone ever templates a host into it.
    for (const tier of PAID_TIERS) {
      expect(upgradeTo(tier, "annual").startsWith("/upgrade?")).toBe(true);
      expect(safeNext(upgradeTo(tier, "annual"))).not.toBe("/");
    }
  });
});

describe("uniformAnnualSaving", () => {
  it("is the one figure the period toggle may print", () => {
    expect(uniformAnnualSaving()).toBe(17);
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
