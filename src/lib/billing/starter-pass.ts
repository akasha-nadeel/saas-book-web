/**
 * The Starter Pass: 400 credits, once, for ninety-nine cents.
 *
 * **Not a plan and not a subscription**, and the card has to say so under the
 * button or it is the thing writers have been trained to fear on a pricing
 * page. A single charge that never renews.
 *
 * **What it is for.** The assistant is the one part of OpenChapter a writer
 * cannot judge from the outside, and the cheapest way to find out currently
 * costs $7.98 and starts a subscription. The pass is the free trial in
 * everything but name, except that it pays for itself: it clears about twelve
 * cents after Paddle's fixed fee and the credits, so a thousand of them cost
 * nothing to give away and the conversion is the whole return rather than a
 * loss being recovered.
 *
 * **It opens the assistant on a free account**, which needs no special case
 * anywhere: the assistant opens for anyone holding credits — the plan decides
 * the monthly grant, the balance decides access. `aiChatClosed()` in
 * `launch.ts` has read the balance since credits arrived, for exactly this.
 *
 * **Write mode and the exports are in it because neither costs anything to
 * give.** Write mode is a different system prompt; an export is the writer's
 * own machine doing the work, but for the PDF. The only thing here with a
 * marginal cost is the credits, and they are capped at four hundred.
 *
 * **One per customer, ever**, and that is not a detail. At 0.25¢ a credit this
 * is the cheapest rate on the page — cheaper than Studio — so a pass that could
 * be bought monthly would be a plan nobody would ever upgrade out of. Making it
 * one-time is what removes that, and the limit has to be enforced server-side
 * before this goes on sale.
 *
 * **Thirty days, because days cost nothing.** Four hundred credits is thirty-two
 * cents whether they are spent in three days or ninety, so the window is about
 * urgency rather than money — and a novelist who buys on Tuesday may not sit
 * down until Saturday. Three days would test whether they are fast, not whether
 * they like the tool.
 */

import { repliesFrom } from "./credits";
import { MODEL_NAMES, CHAT_MODELS } from "@/lib/chat-model";

export const STARTER_PASS = {
  /** Charged once. Confirm Paddle will sell below a dollar before shipping. */
  price: 0.99,
  credits: 400,
  /** How long the credits last before they lapse. */
  days: 30,
} as const;

/**
 * Whether the pass can actually be bought on this deployment.
 *
 * **False until there is a price id, a checkout and a webhook that credits the
 * ledger** — and the card reads this rather than assuming, because a
 * "Get the Starter Pass" button that opens nothing is the dead UI the house
 * rules forbid. While this is false the card still draws, and its button says
 * plainly that the pass is not on sale yet.
 *
 * The env var is deliberately its own rather than folded into
 * `isPaddleConfigured()`: the six subscription prices and this one-time price
 * are bought separately, and a deployment selling plans but not the pass is a
 * perfectly ordinary state rather than a misconfiguration.
 */
export function passOnSale(): boolean {
  return Boolean(process.env.PADDLE_PRICE_STARTER_PASS);
}

/**
 * What the pass buys, in replies.
 *
 * The same shape the plan cards use, from the same `repliesFrom`, so the pass
 * and a month of Draft are read in one unit down the row: 40 Quick against 200.
 */
export function passReplyCounts(): { label: string; count: string }[] {
  const replies = repliesFrom(STARTER_PASS.credits);
  return CHAT_MODELS.map((model) => ({
    label: MODEL_NAMES[model],
    count: replies[model].toLocaleString("en-US"),
  }));
}
