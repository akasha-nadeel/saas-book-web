/**
 * Every line the four plans are compared on, and what each one gives.
 *
 * **Its own module, with no `"use client"` on it, and that is load-bearing.**
 * The pricing cards are drawn on `/upgrade`, which is a client component, and
 * on the landing page, which is a Server Component — and a `"use client"`
 * module's exports become client *references*, so a Server Component importing
 * this array would get `.map` of a reference object and the page would 500.
 * The rule is written down in CLAUDE.md; this is the file it was written for.
 *
 * **Every number is read, never typed.** The counts come from `TIER_LIMITS` and
 * `FREE_LIMITS`, which are the same constants the gates enforce, so the pricing
 * page cannot promise something the app then refuses.
 *
 * **The order of this array is the order on the card**, and there are no
 * headings above it any more. Two headings ("Core workspace", "AI and export")
 * used to file these rows into blocks; with four columns and four crossed rows
 * they were separating a list short enough to read straight through, and the
 * second heading was announcing the boundary that the crosses already draw far
 * more plainly. So: one flat list, and the sequence carries the argument.
 */

import { FREE_LIMITS } from "@/lib/free-limits";
import { plural } from "@/lib/plural";
import { repliesFrom } from "./credits";
import { TIER_LIMITS, TIER_ORDER, type PlanTier } from "./tiers";

/**
 * The one value that means "no". Named, because the mark in front of a row is
 * chosen by comparing against it — a tick beside the words "Not included" is a
 * yes and a no in the same line.
 */
export const NOT_INCLUDED = "Not included";

const UNLIMITED = "Unlimited";
const INCLUDED = "Included";

/** Every tier answers the same, which is what a row of ticks is for. */
function everywhere(value: string): Record<PlanTier, string> {
  return Object.fromEntries(
    TIER_ORDER.map((tier) => [tier, value]),
  ) as Record<PlanTier, string>;
}

/**
 * How a month's credits read in replies.
 *
 * Derived through `repliesFrom` rather than written out, so this card and the
 * chat panel cannot print two different answers to "what does 2,000 buy". The
 * names come from the model vocabulary, not from this file.
 */
function repliesLine(credits: number): string {
  const replies = repliesFrom(credits);
  return `${replies.quick} Quick · ${replies.careful} Careful · ${replies.deep} Deep`;
}

/**
 * A plan's monthly grant, in words a card's prose can carry.
 *
 * **Exported because both pricing screens write this figure into a blurb**, and
 * a blurb is the one place a number drifts with nothing failing to say so — the
 * Studio card claimed "three times the careful replies" against an allowance
 * that was twice, in the retired vocabulary, on a page a buyer reads before
 * paying. Deriving it here is the same argument that made this whole module
 * exist, applied one level up.
 */
export function creditsLine(tier: PlanTier): string {
  const credits = TIER_LIMITS[tier].creditsPerMonth;
  return `${credits.toLocaleString("en-US")} credits a month`;
}

/** Included on the plans with the assistant, crossed on the one without it. */
function withAssistant(value: Record<PlanTier, string> | string) {
  const paid = typeof value === "string" ? everywhere(value) : value;
  return Object.fromEntries(
    TIER_ORDER.map((tier) => [
      tier,
      TIER_LIMITS[tier].chat ? paid[tier] : NOT_INCLUDED,
    ]),
  ) as Record<PlanTier, string>;
}

/**
 * The three things a reader is comparing, in the order they are weighed.
 *
 * **Writing first, the assistant second, publishing last**, which is the order
 * a book is actually made in — and it puts the one section the plans differ on
 * in the middle, where a reader scanning down meets it after the rows that are
 * the same everywhere and before the ones that are again.
 *
 * The groups exist for the comparison table; the cards carry a short list of
 * their own. A row with no group would silently vanish from the table, so the
 * field is required rather than optional.
 */
export const ROW_GROUPS = ["Writing", "The assistant", "Publishing"] as const;

export type RowGroup = (typeof ROW_GROUPS)[number];

export const ROWS: {
  group: RowGroup;
  label: string;
  values: Record<PlanTier, string>;
}[] = [
  /* **Line one, because it is the only row where Free differs from Draft** —
     the whole of what the cheapest paid plan buys, said first. */
  {
    group: "Writing",
    label: "Books",
    values: {
      free: plural(TIER_LIMITS.free.books ?? 0, "book"),
      draft: UNLIMITED,
      writer: UNLIMITED,
      studio: UNLIMITED,
    },
  },
  /* Qualifies the row above it: five books, but nothing inside them counted. */
  {
    group: "Writing",
    label: "Chapters and words",
    values: everywhere(UNLIMITED),
  },
  {
    group: "Writing",
    label: "Autosave and sync",
    /* Matched by string in `STARTER_HIGHLIGHT` — renaming silently drops it. */
    values: everywhere(INCLUDED),
  },
  /* **The wedge, and it is read before the AI boundary rather than after it.**
     Export was the one thing the paid plan used to buy that a writer cannot do
     without, and charging for the door is what this trade's writers check for
     first. Four identical values *is* the argument; the row stays for exactly
     that reason. Matched by string in `STARTER_HIGHLIGHT`. */
  {
    group: "Publishing",
    label: "Export",
    values: everywhere("Word, EPUB, PDF"),
  },
  /* The second thing Draft buys, and worth its place for that alone. Both
     numbers come from `FREE_LIMITS`, which is what `useLimitGate` spends, so
     this cannot promise a count the screen then refuses. `pro: null` there means
     no ceiling, which is the one value `badgeTone` paints gold. */
  {
    group: "Publishing",
    label: "Title check",
    values: {
      free: `${FREE_LIMITS.titleCheck.free} a day`,
      draft: UNLIMITED,
      writer: UNLIMITED,
      studio: UNLIMITED,
    },
  },
  {
    group: "Publishing",
    label: "Consistency check",
    values: everywhere(INCLUDED),
  },
  /* ── The boundary. Everything below is crossed on Free alone now: Draft
        gained the assistant when the plans went to credits, so the cheapest
        paid plan is the first one that can use it. ─────────────────────── */
  {
    group: "The assistant",
    label: "Writing assistant",
    values: withAssistant(INCLUDED),
  },
  /* **One count now, and the wording is deliberately about the allowance
     rather than the model.**

     A card may not imply one model is cleverer than another: on an Anthropic
     deployment Quick is Haiku, Careful is Sonnet and Deep is Opus, but on a
     Google one all three are the same model, and "thinks harder" would be a
     claim the code cannot back on half the installations. What is true
     everywhere is how many credits you get and what a reply costs — which is
     also the actual difference a buyer is choosing between. The behavioural
     description lives in the panel's own tooltip, where the deployment knows
     its provider.

     This was two rows, "Quick replies a day" and "Careful replies a month",
     against the two meters that no longer exist. One balance is also a shorter
     thing to read across four columns. */
  {
    group: "The assistant",
    label: "Credits a month",
    values: withAssistant({
      free: "",
      draft: TIER_LIMITS.draft.creditsPerMonth.toLocaleString("en-US"),
      writer: TIER_LIMITS.writer.creditsPerMonth.toLocaleString("en-US"),
      studio: TIER_LIMITS.studio.creditsPerMonth.toLocaleString("en-US"),
    }),
  },
  {
    /* Derived rather than typed, so the card and the panel cannot disagree
       about what a month buys — the same reason `repliesFrom` exists at all. */
    group: "The assistant",
    label: "Replies a month",
    values: withAssistant({
      free: "",
      draft: repliesLine(TIER_LIMITS.draft.creditsPerMonth),
      writer: repliesLine(TIER_LIMITS.writer.creditsPerMonth),
      studio: repliesLine(TIER_LIMITS.studio.creditsPerMonth),
    }),
  },
  {
    /* **A capability row among the counts, and the wording is the whole of it.**
       What the paid plans buy is the assistant *offering* a passage for the
       page; the change is still the writer's press, and the row has to read
       that way or it is selling something the app does not do.

       "can write in" is the permission it actually is — "the assistant writes
       into your chapter" read as a description of something happening on its
       own. */
    group: "The assistant",
    label: "Writes into your chapter",
    values: withAssistant(INCLUDED),
  },
];
