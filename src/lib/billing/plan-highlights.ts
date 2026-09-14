/**
 * What each card says a plan is for, and the handful of things it leads with.
 *
 * **The card is a pitch and the table is the contract**, and this module exists
 * to keep that distinction honest. A card carrying every comparison row is a
 * table with rounded corners, so the card gets the handful that decide the
 * purchase and `ROWS` carries every claim in full underneath. Nothing here may
 * say something the table then contradicts.
 *
 * **Every figure is read out of `TIER_LIMITS` or `FREE_LIMITS`, never typed.**
 * These lines are prose, which is exactly the place a number goes stale
 * without anything failing.
 *
 * No `"use client"`, for the same reason `plan-rows.ts` has none: the landing
 * page is a Server Component and a client module's exports reach it as
 * references rather than as data.
 */

import { FREE_LIMITS } from "@/lib/free-limits";
import { nounFor } from "@/lib/plural";
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
 * list below it.
 *
 * Free's line names the doubt rather than talking it away: somebody on this
 * page has not decided whether the tool is any good, and saying so is what
 * makes the other card read as honest.
 */
export const BEST_FOR: Record<PlanTier, string> = {
  free: "Best for finding out if this is your tool.",
  pro: "Best for a writer with more than one book.",
};

/**
 * **The line both cards end on, and it is a promise the code keeps.**
 *
 * There is no model call anywhere in the app since 2026-09-14. Voice typing is
 * the browser's own speech feature, and `/privacy` says where its audio goes,
 * so the line is about what OpenChapter does rather than about the browser.
 */
export const NO_AI: Highlight = {
  lead: "No AI",
  text: "— every word is yours",
};

/**
 * The lines on the Free card.
 *
 * **The exports line is the wedge and it is not hedged.** Every competitor
 * charges for formatting, so "every export format" on the free card is the
 * argument this page is making — and it is true of the code, which is the only
 * reason it may be said. See `launch.ts` for why that is not a limit waiting to
 * be introduced later.
 */
const FREE_HIGHLIGHTS: Highlight[] = [
  {
    lead: String(TIER_LIMITS.free.books ?? 0),
    text: `${nounFor(TIER_LIMITS.free.books ?? 0, "book")}, free for good`,
  },
  { lead: "Unlimited", text: "chapters and words" },
  { text: "Every export format — Word, EPUB, PDF" },
  {
    lead: String(FREE_LIMITS.titleCheck.free),
    text: `${nounFor(FREE_LIMITS.titleCheck.free ?? 0, "title check")} a day`,
  },
  NO_AI,
];

/**
 * The paid card.
 *
 * **"Everything in Free" is doing the comparison work**, which is what lets the
 * list stay short: the two things Pro adds are said first, and the rest is
 * inherited rather than repeated.
 */
const PAID_HIGHLIGHTS: Record<PaidTier, Highlight[]> = {
  pro: [
    { lead: "Unlimited", text: "books" },
    { lead: "Unlimited", text: "title checks" },
    { text: `Everything in ${TIER_NAMES.free}` },
    NO_AI,
  ],
};

/** What this plan's card leads with. */
export function highlightsFor(tier: PlanTier): Highlight[] {
  return tier === "free" ? FREE_HIGHLIGHTS : PAID_HIGHLIGHTS[tier];
}
