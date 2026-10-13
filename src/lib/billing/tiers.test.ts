import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import {
  PAID_TIERS,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_ORDER,
  AMAZON_DATA_TIER,
  amazonDataAllowed,
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

it("narrows only the three tiers", () => {
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
 * Free is the only tier that counts books, and it holds three. `null` rather
 * than `Infinity` because this value is serialised to the browser and JSON has
 * no infinity. The trigger in `20260915000000_free_three_books.sql` holds the
 * same number.
 */
it("counts books on no plan, Free included", () => {
  for (const tier of TIER_ORDER) expect(bookLimit(tier)).toBeNull();
});

/**
 * **Amazon's data is Pro Plus, and Pro is the step below it.**
 *
 * Every request for it is paid for, so it is the one paid thing Pro does not
 * get (2026-10-12). Moving `AMAZON_DATA_TIER` to `"pro"` is how Pro gets it
 * later; this test is the one to change with it.
 */
it("gives Amazon's data to Pro Plus and nobody below it", () => {
  expect(AMAZON_DATA_TIER).toBe("plus");
  expect(amazonDataAllowed("plus")).toBe(true);
  expect(amazonDataAllowed("pro")).toBe(false);
  expect(amazonDataAllowed("free")).toBe(false);
  expect(TIER_ORDER.indexOf("plus")).toBeGreaterThan(TIER_ORDER.indexOf("pro"));
});

/**
 * **Every plan that can be bought, the database can store.**
 *
 * `subscriptions.plan` and `payment_orders.plan` are CHECK constraints, and a
 * plan the TypeScript sells but the SQL refuses fails at the webhook, for
 * money already taken. This reads the newest migration that states each CHECK
 * and holds it to `PAID_TIERS`. It cannot know what the live database is
 * running — the migration still has to be applied before the code ships.
 */
it("lets the database store every plan that can be bought", () => {
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const constraint of ["subscriptions_plan_check", "payment_orders_plan_check"]) {
    const latest = files
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .filter((sql) => sql.includes(`add constraint ${constraint}`))
      .at(-1);
    const list = latest
      ?.split(`add constraint ${constraint}`)[1]
      .match(/check \(plan in \(([^)]*)\)\)/)?.[1];
    const allowed = (list ?? "").split(",").map((v) => v.trim().replace(/'/g, ""));
    expect(allowed.sort()).toEqual([...PAID_TIERS].sort());
  }
});
