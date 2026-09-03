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
 * **The assistant is the line the product is drawn on, and Draft is below it.**
 *
 * Draft is the tier this codebase has never had — paid, but with no AI — and it
 * is the one that regresses silently. Anything deriving "may use the assistant"
 * from "is on a paid plan" unlocks it for Draft, which is a paid feature whose
 * gate is visibly decorative.
 */
it("keeps the assistant on the top two tiers only", () => {
  expect(chatAllowed("free")).toBe(false);
  expect(chatAllowed("draft")).toBe(false);
  expect(chatAllowed("writer")).toBe(true);
  expect(chatAllowed("studio")).toBe(true);

  expect(assistantWriteAllowed("draft")).toBe(false);
  expect(assistantWriteAllowed("writer")).toBe(true);
});

/** Writing into the chapter is never offered where the chat itself is shut. */
it("never allows writing where the assistant is closed", () => {
  for (const tier of TIER_ORDER) {
    if (!chatAllowed(tier)) expect(assistantWriteAllowed(tier)).toBe(false);
  }
});

/**
 * **A hand-edited four-column table gets transposed**, and the numbers look
 * plausible either way round. These are the two orderings that would be wrong
 * in a way no screen would show.
 */
it("gives the dearer plan the larger allowance", () => {
  expect(TIER_LIMITS.studio.quickPerDay).toBeGreaterThan(
    TIER_LIMITS.writer.quickPerDay,
  );
  expect(TIER_LIMITS.studio.carefulPerMonth).toBeGreaterThan(
    TIER_LIMITS.writer.carefulPerMonth,
  );
});

/** A tier with no chat has no allowance to spend, on either meter. */
it("gives no replies to a tier without the assistant", () => {
  for (const tier of TIER_ORDER) {
    if (chatAllowed(tier)) continue;
    expect(TIER_LIMITS[tier].quickPerDay).toBe(0);
    expect(TIER_LIMITS[tier].carefulPerMonth).toBe(0);
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
