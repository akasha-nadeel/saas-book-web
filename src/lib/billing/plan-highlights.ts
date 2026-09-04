/**
 * What each card says a plan is for, and the five things it leads with.
 *
 * **The card is a pitch and the table is the contract**, and this module exists
 * to keep that distinction honest. A card carrying all ten comparison rows is a
 * table with rounded corners — four of them side by side is forty lines nobody
 * reads — so the card gets the handful that decide the purchase and `ROWS`
 * carries every claim in full underneath. Nothing here may say something the
 * table then contradicts.
 *
 * **Every figure is read out of `TIER_LIMITS`, never typed.** These lines are
 * prose, which is exactly the place a number goes stale without anything
 * failing: a card promising 2,000 against a grant of 5,000 looks right on every
 * screen. `plan-highlights.test.ts` walks the tiers against the table.
 *
 * No `"use client"`, for the same reason `plan-rows.ts` has none: the landing
 * page is a Server Component and a client module's exports reach it as
 * references rather than as data.
 */

import { CHAT_MODELS, MODEL_NAMES } from "@/lib/chat-model";
import { repliesFrom } from "./credits";
import { STARTER_PASS } from "./starter-pass";
import { TIER_LIMITS, TIER_NAMES, type PaidTier, type PlanTier } from "./tiers";

/**
 * One line of a card's list.
 *
 * `lead` is set in the card's own ink at a size up — the figure a reader is
 * actually comparing — and `text` is the rest of the sentence. Splitting them
 * here rather than marking up a string keeps this module free of JSX, which is
 * what lets a Server Component import it.
 */
export interface Highlight {
  lead?: string;
  text: string;
}

/**
 * Who the plan is for, in one sentence.
 *
 * **It answers "is this me?", which is the question a pricing card is actually
 * asked** — and it is deliberately about the writer rather than the feature
 * list below it. A card whose first line is "unlimited books" makes a reader do
 * the work of deciding whether that describes them.
 *
 * Free's line names the doubt rather than talking it away: somebody on this
 * page has not decided whether the tool is any good, and saying so is what
 * makes the other three read as honest.
 */
export const BEST_FOR: Record<PlanTier, string> = {
  free: "Best for finding out if this is your tool.",
  draft: "Best for finishing the book you are on.",
  writer: "Best for a novelist with a schedule.",
  studio: "Best for a series, and heavy AI use.",
};

/**
 * The pass's line, which is a different kind of sentence from the four above.
 *
 * Those say who a plan is *for*; this says what the pass is *instead of* — a
 * month of Draft, at an eighth of the price and with no subscription. The
 * comparison is the whole product, so the line makes it rather than describing
 * a reader.
 */
export const PASS_BEST_FOR = `Try ${TIER_NAMES.draft} and the assistant for ${STARTER_PASS.days} days.`;

/**
 * What the pass card leads with.
 *
 * **"Everything in Free" is doing real work here**, because the pass is not a
 * plan and a reader's first worry is what it takes away. It takes nothing away:
 * it is a free account with credits in it for a month.
 *
 * The last line is the expiry, stated on the card rather than in small print
 * under the button. A pass that quietly stops working is the thing that makes
 * somebody distrust the next offer.
 */
export const PASS_HIGHLIGHTS: Highlight[] = [
  { lead: STARTER_PASS.credits.toLocaleString("en-US"), text: "credits to spend" },
  { text: "The assistant can write into the chapter" },
  { text: "All three models" },
  { text: `Everything in ${TIER_NAMES.free}` },
  { lead: String(STARTER_PASS.days), text: "days, then the credits lapse" },
];

const credits = (tier: PlanTier) =>
  TIER_LIMITS[tier].creditsPerMonth.toLocaleString("en-US");

/**
 * The five lines on the Free card.
 *
 * **The exports line is the wedge and it is not hedged.** Every competitor
 * charges for formatting, so "every export format" on the free card is the
 * argument this page is making — and it is true of the code, which is the only
 * reason it may be said. See `launch.ts` for why that is not a limit waiting to
 * be introduced later.
 */
const FREE_HIGHLIGHTS: Highlight[] = [
  { lead: String(TIER_LIMITS.free.books ?? 0), text: "books, free for good" },
  { lead: "Unlimited", text: "chapters and words" },
  { text: "Every export format — Word, EPUB, PDF" },
  { text: "Sync across devices" },
  { text: "Title and consistency checks" },
];

/**
 * The paid cards, each opening on its grant.
 *
 * **"Everything in <the plan below>" is doing the comparison work**, which is
 * what lets these lists stay at four lines. Spelling out the inherited rows on
 * every card would make the three paid columns near-identical walls of text,
 * and the difference a buyer is choosing between — the number on line one —
 * would be the thing hardest to find.
 *
 * The name of the plan below comes from `TIER_NAMES`, so a renamed plan cannot
 * leave a card pointing at one that no longer exists.
 */
const PAID_HIGHLIGHTS: Record<PaidTier, Highlight[]> = {
  draft: [
    { lead: credits("draft"), text: "credits a month" },
    { lead: "Unlimited", text: "books" },
    { text: "The assistant can write into the chapter" },
    { text: `Everything in ${TIER_NAMES.free}` },
    { text: "All three models" },
  ],
  writer: [
    { lead: credits("writer"), text: "credits a month" },
    { text: `Everything in ${TIER_NAMES.draft}` },
    { text: "All three models" },
    { text: "Every export format" },
  ],
  studio: [
    { lead: credits("studio"), text: "credits a month" },
    { text: `Everything in ${TIER_NAMES.writer}` },
    { text: "All three models" },
    { text: "Every export format" },
  ],
};

/** What this plan's card leads with. */
export function highlightsFor(tier: PlanTier): Highlight[] {
  return tier === "free" ? FREE_HIGHLIGHTS : PAID_HIGHLIGHTS[tier];
}

/**
 * What a month of credits comes to, in replies, for the box on the card.
 *
 * **The one figure a reader wants and the one a credit balance never gives.** A
 * credit is an accounting unit and nobody thinks in them; "200 Quick or 66
 * Careful or 20 Deep" is the same fact in the unit a writer works in.
 *
 * `undefined` on a plan with no grant, where the box would be three zeroes
 * under three headings — a control-shaped answer to a question that plan is not
 * being asked.
 */
export function replyCountsFor(
  tier: PlanTier,
): { label: string; count: string }[] | undefined {
  const grant = TIER_LIMITS[tier].creditsPerMonth;
  if (grant <= 0) return undefined;

  const replies = repliesFrom(grant);
  return CHAT_MODELS.map((model) => ({
    label: MODEL_NAMES[model],
    count: replies[model].toLocaleString("en-US"),
  }));
}
