/**
 * What each card says a plan is for, and everything it gives.
 *
 * **Each card lists every row of the comparison table its plan includes, in the
 * table's order** (2026-09-14). The cards used to carry a handful and leave the
 * rest to the table, and the owner wanted a reader to see the whole plan without
 * scrolling down to it. The table stays underneath, where the same lines sit
 * side by side. Each line names the `ROWS` label it stands for, and a test holds
 * the two sets equal, so a row added to the table cannot be missing from a card.
 * A row the plan does not include (paperback setup on Free, since 2026-09-16)
 * is left off that card: the card is a list of features, and a line saying "not
 * included" there would read as one. Nothing here may say something the table
 * then contradicts.
 *
 * **Every figure is read out of `TIER_LIMITS` or `FREE_LIMITS`, never typed.**
 * These lines are prose, which is exactly the place a number goes stale
 * without anything failing.
 *
 * No `"use client"`, for the same reason `plan-rows.ts` has none: the landing
 * page is a Server Component and a client module's exports reach it as
 * references rather than as data.
 */

import { ALL_CHECKS, FREE_CHECKS } from "@/lib/consistency-ids";
import { FREE_LIMITS, FREE_RECORD_DAYS } from "@/lib/free-limits";
import { nounFor } from "@/lib/plural";
import { TIER_LIMITS, type PaidTier, type PlanTier } from "./tiers";

/**
 * One line of a card's list.
 *
 * `lead` is set in the card's own ink at a size up — the figure a reader is
 * actually comparing — and `text` is the rest of the sentence. Splitting them
 * here rather than marking up a string keeps this module free of JSX, which is
 * what lets a Server Component import it.
 *
 * `row` is the `ROWS` label this line stands for. `NO_AI` has none, because the
 * table has no row for it.
 */
export interface Highlight {
  lead?: string;
  text: string;
  row?: string;
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

/*
 * The lines both plans say the same, in `ROWS` order. Stated once so the two
 * cards cannot word one row two ways.
 */
const CHAPTERS: Highlight = {
  row: "Chapters and words",
  lead: "Unlimited",
  text: "chapters and words",
};
const SYNC: Highlight = { row: "Autosave and sync", text: "Autosave and sync" };
const VOICE: Highlight = { row: "Voice typing", text: "Voice typing" };
/*
 * **The exports line is the wedge and it is not hedged.** Every competitor
 * charges for formatting, so the full format list on the free card is the
 * argument this page is making — and it is true of the code, which is the only
 * reason it may be said. See `launch.ts` for why that is not a limit waiting to
 * be introduced later.
 */
const EXPORT: Highlight = { row: "Export", text: "Export — Word, EPUB, PDF" };
/* Pro only since 2026-09-16, so only the paid card carries it. */
const PAPERBACK: Highlight = { row: "Paperback setup", text: "Paperback setup" };

/** The lines on the Free card. */
const FREE_HIGHLIGHTS: Highlight[] = [
  {
    row: "Books",
    lead: String(TIER_LIMITS.free.books ?? 0),
    text: nounFor(TIER_LIMITS.free.books ?? 0, "book"),
  },
  CHAPTERS,
  SYNC,
  VOICE,
  {
    row: "Ideas",
    lead: String(FREE_LIMITS.ideas.free),
    text: `parked ${nounFor(FREE_LIMITS.ideas.free, "idea")} at a time`,
  },
  {
    row: "Title check",
    lead: String(FREE_LIMITS.titleCheck.free),
    text: `${nounFor(FREE_LIMITS.titleCheck.free, "title check")} a day`,
  },
  EXPORT,
  {
    row: "Consistency check",
    lead: String(FREE_CHECKS.length),
    text: "consistency checks",
  },
  {
    row: "Writing record",
    lead: `${FREE_RECORD_DAYS} days`,
    text: "of writing record",
  },
  NO_AI,
];

/**
 * The paid card.
 *
 * Every line is spelled out rather than "Everything in Free", so the two cards
 * can be read across line for line: the lines that differ sit where the table
 * puts them.
 */
const PAID_HIGHLIGHTS: Record<PaidTier, Highlight[]> = {
  pro: [
    { row: "Books", lead: "Unlimited", text: "books" },
    CHAPTERS,
    SYNC,
    VOICE,
    { row: "Ideas", lead: "Unlimited", text: "parked ideas" },
    { row: "Title check", lead: "Unlimited", text: "title checks" },
    EXPORT,
    {
      row: "Consistency check",
      lead: `All ${ALL_CHECKS.length}`,
      text: "consistency checks",
    },
    { row: "Writing record", lead: "12 months", text: "of writing record" },
    PAPERBACK,
    NO_AI,
  ],
};

/** What this plan's card leads with. */
export function highlightsFor(tier: PlanTier): Highlight[] {
  return tier === "free" ? FREE_HIGHLIGHTS : PAID_HIGHLIGHTS[tier];
}
