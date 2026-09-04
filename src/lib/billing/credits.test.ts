import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CHAT_MODELS, type ChatModel } from "@/lib/chat-model";
import {
  CREDIT_COST,
  bestAffordable,
  canAfford,
  creditCost,
  monthlyCredits,
  repliesFrom,
} from "./credits";
import { PAID_TIERS, TIER_LIMITS, TIER_ORDER } from "./tiers";

/**
 * **A price per model, and one for every model there is.**
 *
 * `CREDIT_COST` is a `Record<ChatModel, number>` so a fourth model is a type
 * error rather than an `undefined` cost — but `undefined` is also what a
 * hand-edited object gets when a key is misspelled and the type is widened to
 * quiet it. The walk is what notices that.
 */
it("prices every model the assistant offers", () => {
  for (const model of CHAT_MODELS) {
    expect(creditCost(model)).toBeGreaterThan(0);
    expect(Number.isInteger(creditCost(model))).toBe(true);
  }
  expect(Object.keys(CREDIT_COST).sort()).toEqual([...CHAT_MODELS].sort());
});

/**
 * **The ladder runs the same way the picker does.**
 *
 * `CHAT_MODELS` is documented as cheapest first and `bestAffordable` walks it
 * backwards on exactly that promise — so a transposed pair would make it return
 * the *dearest* model a balance cannot afford. Nothing else would catch it: the
 * types are identical either way round.
 */
it("orders the models cheapest first", () => {
  for (let i = 1; i < CHAT_MODELS.length; i += 1) {
    expect(creditCost(CHAT_MODELS[i])).toBeGreaterThan(
      creditCost(CHAT_MODELS[i - 1]),
    );
  }
});

/** The grant comes out of `TIER_LIMITS`, never restated in `credits.ts`. */
it("reads a plan's grant out of the tier table", () => {
  for (const tier of TIER_ORDER) {
    expect(monthlyCredits(tier)).toBe(TIER_LIMITS[tier].creditsPerMonth);
  }
  expect(monthlyCredits("free")).toBe(0);
});

/**
 * **The card promises three models; the cheapest plan has to afford all three.**
 *
 * This is the failure the design sheet actually made — a plan whose month buys
 * a model it can never once ask. A grant below 100 would put Deep on the card
 * and out of reach in the same column, and the picker would draw it disabled on
 * the first day of the month.
 */
it("gives every paid plan enough for at least one of each model", () => {
  for (const tier of PAID_TIERS) {
    const replies = repliesFrom(monthlyCredits(tier));
    for (const model of CHAT_MODELS) {
      expect(replies[model]).toBeGreaterThanOrEqual(1);
    }
  }
});

/**
 * **Floored, because two-thirds of a reply is not a reply.**
 *
 * The count is what the pricing card and the panel both print. Rounding up
 * would have a card promise a reply the claim then refuses, which is the exact
 * shape of the thing the house rule about invented numbers is written against.
 */
it("counts only replies a balance can actually pay for", () => {
  expect(repliesFrom(0)).toEqual({ quick: 0, careful: 0, deep: 0 });
  expect(repliesFrom(99).deep).toBe(0);
  expect(repliesFrom(100).deep).toBe(1);
  expect(repliesFrom(199).deep).toBe(1);

  // 2,000 is Draft's month: 200 Quick, 66 Careful, 20 Deep.
  expect(repliesFrom(2_000)).toEqual({ quick: 200, careful: 66, deep: 20 });
});

/** Exactly the cost is affordable; a credit short is not. */
it("affords a reply it has the exact price of", () => {
  for (const model of CHAT_MODELS) {
    const cost = creditCost(model);
    expect(canAfford(cost, model)).toBe(true);
    expect(canAfford(cost - 1, model)).toBe(false);
  }
});

/**
 * **What the panel offers after a refusal**, and the reason it asks the balance
 * rather than naming "the other model".
 *
 * The old wording named *the other one*, which with three models can offer one
 * dearer than the one just refused — a second refusal, from a sentence that had
 * just promised otherwise.
 */
it("offers the dearest model the balance still covers", () => {
  expect(bestAffordable(0)).toBeNull();
  expect(bestAffordable(9)).toBeNull();
  expect(bestAffordable(10)).toBe("quick");
  expect(bestAffordable(29)).toBe("quick");
  expect(bestAffordable(30)).toBe("careful");
  expect(bestAffordable(99)).toBe("careful");
  expect(bestAffordable(100)).toBe("deep");
  expect(bestAffordable(10_000)).toBe("deep");
});

/** Whatever it answers, the balance covers it. */
it("never offers a model the balance cannot pay for", () => {
  for (let balance = 0; balance <= 150; balance += 1) {
    const model = bestAffordable(balance);
    if (model) expect(canAfford(balance, model)).toBe(true);
  }
});

/**
 * **The grants are stated twice and this is what holds the pair together.**
 *
 * `TIER_LIMITS` is what the cards print and the browser gates on;
 * `claim_credits` is what actually refuses. SQL cannot import TypeScript, so
 * two copies is the floor — but two copies with nothing between them is a
 * drift waiting to happen, and the drift is invisible: a card promising 5,000
 * against a function granting 2,000 looks right on every screen until a writer
 * runs out three fifths of the way through their month.
 *
 * The parse is deliberately strict. A migration that renames the function or
 * rewrites the `case` fails here rather than passing on a regex that found
 * nothing — an empty match is the one result that must not read as agreement.
 */
it("grants the same credits in SQL as in the tier table", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260904000000_ai_credits.sql"),
    "utf8",
  );

  const block = sql.match(/v_limit\s*:=\s*case\s+v_tier([\s\S]*?)end;/);
  expect(block, "the grant `case` in claim_credits").not.toBeNull();

  const granted = new Map<string, number>();
  for (const [, tier, amount] of block![1].matchAll(
    /when\s+'(\w+)'\s+then\s+(\d+)/g,
  )) {
    granted.set(tier, Number(amount));
  }
  const fallback = block![1].match(/else\s+(\d+)/);
  expect(fallback, "the `else` arm, which is what Free lands on").not.toBeNull();

  for (const tier of TIER_ORDER) {
    const inSql = granted.get(tier) ?? Number(fallback![1]);
    expect(inSql, `${tier} in claim_credits`).toBe(
      TIER_LIMITS[tier].creditsPerMonth,
    );
  }
});

/**
 * The cost is decided by the browser and spent by Postgres, which takes it as
 * an argument — so a model priced at zero or below would be a free reply, and
 * a negative one would hand out credits. The function raises on both; this is
 * the half that keeps the table from ever asking it to.
 */
it("never prices a reply at nothing", () => {
  const costs: number[] = CHAT_MODELS.map((model: ChatModel) =>
    creditCost(model),
  );
  for (const cost of costs) expect(cost).toBeGreaterThan(0);
});
