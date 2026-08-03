import { describe, expect, it } from "vitest";
import type { Subscription } from "./subscription";
import {
  asSubscriptionStatus,
  isPro,
  paymentStatusFromCode,
} from "./subscription";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    status: "active",
    period: "monthly",
    currentPeriodEnd: new Date("2026-08-15T12:00:00.000Z"),
    payhereSubscriptionId: "PH-1",
    cancelledAt: null,
    ...overrides,
  };
}

describe("paymentStatusFromCode", () => {
  it("reads PayHere's codes", () => {
    expect(paymentStatusFromCode(2)).toBe("paid");
    expect(paymentStatusFromCode(0)).toBe("pending");
    expect(paymentStatusFromCode(-1)).toBe("cancelled");
    expect(paymentStatusFromCode(-2)).toBe("failed");
    expect(paymentStatusFromCode(-3)).toBe("chargedback");
  });

  // A code we have never seen must not read as success. It is the only wrong
  // answer here that gives something away.
  it("does not guess at an unknown one", () => {
    expect(paymentStatusFromCode(7)).toBe("unknown");
    expect(paymentStatusFromCode(Number.NaN)).toBe("unknown");
  });
});

describe("isPro", () => {
  it("is false with no subscription at all", () => {
    expect(isPro(null, NOW)).toBe(false);
  });

  it("is true inside the paid period", () => {
    expect(isPro(sub(), NOW)).toBe(true);
  });

  // Written before the first notification arrives, or never completed. Nothing
  // has been paid for, so nothing has been bought.
  it("is false when no period has been recorded", () => {
    expect(isPro(sub({ currentPeriodEnd: null }), NOW)).toBe(false);
  });

  describe("bought outright", () => {
    const owned = (overrides: Partial<Subscription> = {}) =>
      sub({
        period: "lifetime",
        // What `periodEnd()` writes for a purchase that has no end, and what
        // the webhook therefore stores.
        currentPeriodEnd: null,
        // PayHere issues none for a one-off charge.
        payhereSubscriptionId: null,
        ...overrides,
      });

    /*
     * The one that would have refused every writer who paid $199.
     *
     * A lifetime row legitimately has no `currentPeriodEnd`, and the guard for
     * subscriptions reads a missing date as "the first payment has not landed
     * yet". The period has to be checked before that guard, not after.
     */
    it("is true with no end date, because there is no end", () => {
      expect(isPro(owned(), NOW)).toBe(true);
    });

    it("is still true years later", () => {
      expect(isPro(owned(), new Date("2099-01-01T00:00:00.000Z"))).toBe(true);
    });

    it("ignores a stale end date rather than expiring on it", () => {
      const stale = new Date("2020-01-01T00:00:00.000Z");
      expect(isPro(owned({ currentPeriodEnd: stale }), NOW)).toBe(true);
    });

    // The only thing that ends one. The webhook writes this on a chargeback —
    // money taken back, so access goes with it.
    it("ends when the money is taken back", () => {
      expect(isPro(owned({ status: "cancelled" }), NOW)).toBe(false);
    });
  });

  describe("the grace window", () => {
    const ended = new Date("2026-07-29T12:00:00.000Z");

    // A renewal charge and its notification do not land on the stroke of the
    // hour, and a card needing one retry is normal. Three days.
    it("keeps an active plan alive a day past its end", () => {
      expect(isPro(sub({ currentPeriodEnd: ended }), NOW)).toBe(true);
    });

    it("keeps a past_due plan alive while PayHere retries", () => {
      expect(isPro(sub({ status: "past_due", currentPeriodEnd: ended }), NOW)).toBe(
        true,
      );
    });

    it("ends an active plan four days past its end", () => {
      expect(
        isPro(sub({ currentPeriodEnd: new Date("2026-07-26T11:00:00.000Z") }), NOW),
      ).toBe(false);
    });
  });

  describe("once cancelled", () => {
    // The writer asked for it to stop. They keep what they paid for and not an
    // hour more — a grace period here would be charging nobody for access.
    it("runs to the end of the period already paid for", () => {
      expect(
        isPro(
          sub({
            status: "cancelled",
            cancelledAt: NOW,
            currentPeriodEnd: new Date("2026-08-15T12:00:00.000Z"),
          }),
          NOW,
        ),
      ).toBe(true);
    });

    it("gets no grace past it", () => {
      expect(
        isPro(
          sub({
            status: "cancelled",
            cancelledAt: NOW,
            currentPeriodEnd: new Date("2026-07-29T12:00:00.000Z"),
          }),
          NOW,
        ),
      ).toBe(false);
    });
  });
});

describe("asSubscriptionStatus", () => {
  it("passes the three it knows", () => {
    expect(asSubscriptionStatus("active")).toBe("active");
    expect(asSubscriptionStatus("past_due")).toBe("past_due");
    expect(asSubscriptionStatus("cancelled")).toBe("cancelled");
  });

  it("refuses anything else", () => {
    expect(asSubscriptionStatus("canceled")).toBeNull();
    expect(asSubscriptionStatus(null)).toBeNull();
    expect(asSubscriptionStatus("")).toBeNull();
  });
});
