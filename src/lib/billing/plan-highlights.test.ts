import { expect, it } from "vitest";
import { highlightsFor, NO_AI } from "./plan-highlights";
import { NOT_INCLUDED, ROWS } from "./plan-rows";
import { TIER_ORDER } from "./tiers";

/**
 * **Each card lists every row of the comparison table** (2026-09-14), and these
 * are what keep it listing them. Like `plan-rows.test.ts`, they assert what the
 * cards *say*; a failure means a card has lost a line, not that the test is out
 * of date.
 */

/*
 * A row added to the table has to reach every card whose plan includes it, in
 * the table's order, or a reader of the card is told less than a reader of the
 * table. A row the plan does not include stays off that card — the card is a
 * list of what you get (paperback setup on Free, since 2026-09-16).
 */
it("gives every card one line per table row its plan includes, in table order", () => {
  for (const tier of TIER_ORDER) {
    const labels = ROWS.filter((row) => row.values[tier] !== NOT_INCLUDED).map(
      (row) => row.label,
    );
    const rows = highlightsFor(tier)
      .map((line) => line.row)
      .filter((row): row is string => row !== undefined);
    expect(rows).toEqual(labels);
  }
});

it("ends every card on the No AI line", () => {
  for (const tier of TIER_ORDER) {
    expect(highlightsFor(tier).at(-1)).toBe(NO_AI);
  }
});

/*
 * The same rule as the table's: no line may sell an assistant, credits or a
 * model. The "No AI" line is the one allowed to say the word, because it says
 * the opposite.
 */
it("sells nothing the app no longer has", () => {
  const forbidden = /\bai\b|assistant|credit|model|haiku|sonnet|gemini|claude|gpt|opus/i;

  for (const tier of TIER_ORDER) {
    for (const line of highlightsFor(tier)) {
      if (line === NO_AI) continue;
      expect(`${line.lead ?? ""} ${line.text}`).not.toMatch(forbidden);
    }
  }
});
