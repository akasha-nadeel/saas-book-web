import { expect, it } from "vitest";
import { NOT_INCLUDED, ROWS } from "./plan-rows";
import { TIER_ORDER } from "./tiers";

/**
 * **These assert what the pricing cards *say*, not how they are built.**
 *
 * They belong with the tests `docs/testing.md` lists as the ones not to "fix"
 * when they go red: each one is a claim the product has already decided, and a
 * failure means the card has lost the thing it was written to carry rather than
 * that the test is out of date.
 */

/**
 * **Export is free on every plan, and this is the row that says so.**
 *
 * The mirror of the assertion in `launch.test.ts` — that one guards the gate,
 * this one guards the promise. A reader comparing four columns should be able
 * to see that the finished file is not what they are paying for, and the only
 * way to see it is identical values in a row.
 */
it("offers every export format on every plan", () => {
  const row = ROWS.find((r) => r.label === "Export");
  expect(row).toBeDefined();

  const values = TIER_ORDER.map((tier) => row!.values[tier]);
  expect(new Set(values).size).toBe(1);
  expect(values[0]).not.toBe(NOT_INCLUDED);
});

/**
 * **No row may mention AI.** The app has none since 2026-09-14 and the pricing
 * page says so; a row selling an assistant, credits or a model would be a claim
 * the code cannot back.
 */
it("sells nothing the app no longer has", () => {
  const forbidden = /ai|assistant|credit|model|haiku|sonnet|gemini|claude|gpt|opus/i;

  for (const row of ROWS) {
    expect(row.label).not.toMatch(forbidden);
    for (const tier of TIER_ORDER) {
      expect(row.values[tier]).not.toMatch(forbidden);
    }
  }
});

/**
 * **Every row answers for every plan.**
 *
 * A card walks `TIER_ORDER` and reads `row.values[tier]`; a missing key renders
 * as an empty badge beside a green tick, which reads as "included" for a plan
 * that may not include it at all. Nothing else would notice.
 */
it("gives every row an answer for every plan", () => {
  for (const row of ROWS) {
    for (const tier of TIER_ORDER) {
      expect(typeof row.values[tier]).toBe("string");
      expect(row.values[tier].length).toBeGreaterThan(0);
    }
  }
});

/**
 * The first row is the first thing Pro buys, so it is said first rather than
 * found.
 */
it("opens on the row that separates Free from Pro", () => {
  expect(ROWS[0].label).toBe("Books");
  expect(ROWS[0].values.free).not.toBe(ROWS[0].values.pro);
});

/**
 * **Pro is the whole of what is sold, and these are the two rows that say
 * what it buys.** Everything else must read the same on both plans.
 */
it("differs between the plans on books and title checks only", () => {
  const differing = ROWS.filter((row) => row.values.free !== row.values.pro).map(
    (row) => row.label,
  );
  expect(differing.sort()).toEqual(["Books", "Title check"]);
  for (const row of ROWS) {
    for (const tier of TIER_ORDER) expect(row.values[tier]).not.toBe(NOT_INCLUDED);
  }
});

/**
 * **Every row is one line on the card, and a label is the only thing that can
 * break that.**
 *
 * The rows carried an explanation inline in brackets until the cards went to
 * four columns (there are two now), where every one of them wrapped — and a wrapped label took the
 * tick off its own line and pushed the badge over the card's edge. The
 * explanations are gone and the labels are short, and this is what keeps them
 * short: there is no width to test against here, so the proxy is the character
 * count that fitted when it was measured in the browser at four columns.
 */
it("keeps every label short enough for one line", () => {
  for (const row of ROWS) {
    expect(row.label.length).toBeLessThanOrEqual(24);
  }
});
