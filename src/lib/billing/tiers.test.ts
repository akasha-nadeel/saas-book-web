import { expect, it } from "vitest";
import {
  PAID_TIERS,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_ORDER,
  asPaidTier,
  asTier,
  assistantWriteAllowed,
  bookLimit,
  chatAllowed,
  tierAtLeast,
} from "@/lib/billing/tiers";

/**
 * **`"pro"` must not narrow to a tier.**
 *
 * Every subscription row written before the tiers existed carries `plan: 'pro'`,
 * and the migration rewrites those to `writer` under a new CHECK constraint. A
 * translation here would paper over a row the migration missed — and a
 * subscriber silently on the wrong plan is a worse failure than one whose plan
 * reads as `free` until somebody looks at it.
 */
it("refuses the plan name the tiers replaced", () => {
  expect(asTier("pro")).toBeNull();
  expect(asPaidTier("pro")).toBeNull();
});

it("narrows only the four tiers", () => {
  for (const tier of TIER_ORDER) expect(asTier(tier)).toBe(tier);

  for (const junk of ["", "Free", "WRITER", "premium", null, undefined, 1, {}]) {
    expect(asTier(junk)).toBeNull();
  }
});

it("keeps free out of the tiers that can be bought", () => {
  expect(asPaidTier("free")).toBeNull();
  for (const tier of PAID_TIERS) expect(asPaidTier(tier)).toBe(tier);
  expect([...PAID_TIERS]).toEqual(TIER_ORDER.filter((t) => t !== "free"));
});

/**
 * **The ladder, every pair of it.**
 *
 * `tierAtLeast` compares positions in `TIER_ORDER`, so a tier inserted in the
 * wrong place opens or shuts every gate above it at once and nothing else in
 * the tree would notice. Sixteen assertions is cheap for that.
 */
it("orders the tiers cheapest first", () => {
  for (const [i, tier] of TIER_ORDER.entries()) {
    for (const [j, minimum] of TIER_ORDER.entries()) {
      expect(tierAtLeast(tier, minimum)).toBe(i >= j);
    }
  }
});

/**
 * **A tier with no entry is a tier every gate answers `undefined` for.**
 *
 * The same shape as the test that walks every field `storeReadiness()` can emit
 * against `DESTINATIONS`: the map and the list are two halves of one statement,
 * and only a walk catches them disagreeing.
 */
it("gives every tier a limit set and a name", () => {
  for (const tier of TIER_ORDER) {
    expect(TIER_LIMITS[tier]).toBeDefined();
    expect(TIER_NAMES[tier]).toBeTruthy();
  }
  expect(Object.keys(TIER_LIMITS).sort()).toEqual([...TIER_ORDER].sort());
});

/**
 * **Paying is the line, and the difference above it is amount rather than
 * kind.**
 *
 * This read "the assistant is on the top two tiers only" until 2026-09-04, when
 * the two reply meters became one credit balance and Draft gained a grant. What
 * the test is protecting did not change: `chatAllowed` is the *pricing*
 * question — does this plan come with credits — and Free is the one tier it
 * must answer no for. A plan quietly granted credits it was never sold is the
 * failure nothing on a screen would show.
 *
 * Note this is no longer the gate on the panel. `aiChatClosed()` in `launch.ts`
 * reads the balance, because a Free account may hold bought credits and a
 * Writer may have spent the month — neither of which is a fact about the tier.
 */
it("grants credits on every paid tier and none on free", () => {
  expect(chatAllowed("free")).toBe(false);
  expect(chatAllowed("draft")).toBe(true);
  expect(chatAllowed("writer")).toBe(true);
  expect(chatAllowed("studio")).toBe(true);

  expect(assistantWriteAllowed("free")).toBe(false);
  expect(assistantWriteAllowed("draft")).toBe(true);
});

/** Writing into the chapter is never offered where the chat itself is shut. */
it("never allows writing where the assistant is closed", () => {
  for (const tier of TIER_ORDER) {
    if (!chatAllowed(tier)) expect(assistantWriteAllowed(tier)).toBe(false);
  }
});

/**
 * **A hand-edited four-column table gets transposed**, and the numbers look
 * plausible either way round. The grant is now the *only* thing separating the
 * three paid plans, so an ordering that slipped would make the dearest plan the
 * meanest one with nothing else on the card to contradict it.
 *
 * Walked across `TIER_ORDER` rather than written as a pair, so a fifth tier
 * inserted anywhere is covered the day it arrives.
 */
it("gives the dearer plan the larger allowance", () => {
  for (let i = 1; i < TIER_ORDER.length; i += 1) {
    expect(TIER_LIMITS[TIER_ORDER[i]].creditsPerMonth).toBeGreaterThan(
      TIER_LIMITS[TIER_ORDER[i - 1]].creditsPerMonth,
    );
  }
});

/**
 * A tier granted no credits has no grant to spend.
 *
 * **`chat` and `creditsPerMonth` are two statements of one fact** — a plan is
 * either sold assistant credits or it is not — and the pair drifting apart is
 * how a card comes to promise an allowance the claim then refuses.
 */
it("gives no monthly credits to a tier without the assistant", () => {
  for (const tier of TIER_ORDER) {
    if (chatAllowed(tier)) {
      expect(TIER_LIMITS[tier].creditsPerMonth).toBeGreaterThan(0);
      continue;
    }
    expect(TIER_LIMITS[tier].creditsPerMonth).toBe(0);
  }
});

/**
 * Free is the only tier that counts books. `null` rather than `Infinity`
 * because this value is serialised to the browser and JSON has no infinity.
 */
it("counts books on the free plan and nowhere else", () => {
  expect(bookLimit("free")).toBe(5);
  for (const tier of PAID_TIERS) expect(bookLimit(tier)).toBeNull();
});
