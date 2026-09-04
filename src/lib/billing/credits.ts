/**
 * What a reply costs, what each plan is given, and how to say either in replies
 * rather than in credits.
 *
 * **One module for the whole credit economy**, and pure, so the pricing cards,
 * the chat panel, `/billing` and the route that spends them all read the same
 * numbers. It replaces the two meters — `quickPerDay` and `carefulPerMonth` —
 * that `tiers.ts` used to carry, and the two windows they ran on.
 *
 * **Why one balance instead of two counters.** The old shape let a writer run
 * out of careful replies on the 3rd with twenty-five quick ones a day going
 * unused, and there was no way to buy more. It also could not grow: a third
 * model would have meant a third counter on a third window, and three windows
 * is three things for a writer to keep in their head about a product whose
 * whole job is to be quiet.
 *
 * **Postgres holds the real limits.** `claim_credits` decides in SQL, because a
 * number a browser can edit is not a limit. `TIER_CREDITS` below is the
 * browser's copy, and the two are two statements of one rule that must move
 * together — the same floor-of-two `TIER_LIMITS` and the book trigger already
 * live by. SQL cannot import TypeScript; that is the whole of why this is
 * written twice.
 */

import type { ChatModel } from "@/lib/chat-model";
import { CHAT_MODELS } from "@/lib/chat-model";
import { TIER_LIMITS, type PlanTier } from "./tiers";

/**
 * What one reply costs, by model.
 *
 * **The ratio is the published token prices against a measured request shape,
 * not a marketing ladder.** A reply carries the chapter (cached across the
 * turns of a conversation), the exchange so far, and at most 2,000 tokens out —
 * `/api/chat` caps all three, which is what makes a flat per-reply price safe
 * rather than a bet. Against that shape Quick lands near $0.006, Careful near
 * $0.019 and Deep near $0.055, which is 1 : 3 : 10.
 *
 * A credit is budgeted at **$0.0008** of model time — a little above Quick's
 * true cost, so a long chapter or a cache miss comes out of the margin rather
 * than out of the arithmetic.
 */
export const CREDIT_COST: Record<ChatModel, number> = {
  quick: 10,
  careful: 30,
  deep: 100,
};

/**
 * How many credits this plan is granted a month.
 *
 * **Read out of `TIER_LIMITS` rather than restated here**, because that table
 * is where what-a-plan-gives lives and a second copy in this file would be a
 * third statement of one number — the SQL already has to be the second.
 *
 * Free is zero rather than absent: the ledger's `purchased` bucket means a free
 * account can still *hold* credits, and the assistant opens on a balance rather
 * than on a tier. What Free has no claim to is a monthly grant.
 *
 * **Nothing sells credits yet**, so that bucket is zero for everybody today.
 * The column, the spend order and the refund split are built for it because
 * retrofitting a purchased balance into a ledger that only ever counted a grant
 * is the change that goes wrong — not because a pack is on sale. Anything that
 * *names* one to a writer is a claim the code cannot back until there is a
 * price, a checkout and a webhook that credits the row.
 */
export function monthlyCredits(tier: PlanTier): number {
  return TIER_LIMITS[tier].creditsPerMonth;
}

/** What one reply on this model costs. */
export function creditCost(model: ChatModel): number {
  return CREDIT_COST[model];
}

/** Whether a balance covers one reply on this model. */
export function canAfford(balance: number, model: ChatModel): boolean {
  return balance >= CREDIT_COST[model];
}

/**
 * How many replies a balance buys, per model.
 *
 * **The figure every screen actually wants.** A credit is an accounting unit
 * and nobody thinks in them; "200 Quick or 66 Careful or 20 Deep" is the same
 * fact in the unit a writer works in. Derived once here so the pricing card,
 * the panel and `/billing` cannot print three different answers — which is
 * exactly how the design sheet came to name two models in a card that promised
 * three.
 *
 * Floored, because two-thirds of a reply is not a reply.
 */
export function repliesFrom(credits: number): Record<ChatModel, number> {
  return {
    quick: Math.floor(credits / CREDIT_COST.quick),
    careful: Math.floor(credits / CREDIT_COST.careful),
    deep: Math.floor(credits / CREDIT_COST.deep),
  };
}

/**
 * The dearest model this balance can still pay for, or null for none.
 *
 * **What the panel offers after a refusal.** It used to name *the other one* —
 * a sentence with no meaning once there are three, and one that could offer a
 * model costing more than the one just refused. Asking the balance instead
 * answers correctly for any number of models.
 */
export function bestAffordable(balance: number): ChatModel | null {
  for (let i = CHAT_MODELS.length - 1; i >= 0; i -= 1) {
    const model = CHAT_MODELS[i];
    if (canAfford(balance, model)) return model;
  }
  return null;
}
