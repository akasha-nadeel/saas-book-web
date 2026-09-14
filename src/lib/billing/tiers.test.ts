import { expect, it } from "vitest";
import {
  PAID_TIERS,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_ORDER,
  asPaidTier,
  asTier,
  bookLimit,
  tierAtLeast,
} from "@/lib/billing/tiers";

/**
 * **The retired tiers must not narrow.**
 *
 * `draft`, `writer` and `studio` were rewritten to `pro` by the migration that
 * retired them. A translation here would paper over a row the migration missed
 * — and a subscriber silently on the wrong plan is a worse failure than one
 * whose plan reads as `free` until somebody looks at it.
 */
it("refuses the plan names Pro replaced", () => {
  for (const retired of ["draft", "writer", "studio"]) {
    expect(asTier(retired)).toBeNull();
    expect(asPaidTier(retired)).toBeNull();
  }
});

it("narrows only the two tiers", () => {
  for (const tier of TIER_ORDER) expect(asTier(tier)).toBe(tier);

  for (const junk of ["", "Free", "PRO", "premium", null, undefined, 1, {}]) {
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
 * the tree would notice.
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
 * Free is the only tier that counts books, and it holds one. `null` rather than
 * `Infinity` because this value is serialised to the browser and JSON has no
 * infinity. The trigger in `20260914000000_ai_free_pro_plan.sql` holds the
 * same number.
 */
it("counts books on the free plan and nowhere else", () => {
  expect(bookLimit("free")).toBe(1);
  for (const tier of PAID_TIERS) expect(bookLimit(tier)).toBeNull();
});
