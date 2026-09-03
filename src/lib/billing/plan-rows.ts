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

/** Included on the plans with the assistant, crossed on the two without it. */
function withAssistant(value: Record<PlanTier, string> | string) {
  const paid = typeof value === "string" ? everywhere(value) : value;
  return Object.fromEntries(
    TIER_ORDER.map((tier) => [
      tier,
      TIER_LIMITS[tier].chat ? paid[tier] : NOT_INCLUDED,
    ]),
  ) as Record<PlanTier, string>;
}

export const ROWS: {
  label: string;
  values: Record<PlanTier, string>;
}[] = [
  /* **Line one, because it is the only row where Free differs from Draft** —
     the whole of what the cheapest paid plan buys, said first. */
  {
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
    label: "Chapters and words",
    values: everywhere(UNLIMITED),
  },
  {
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
    label: "Export",
    values: everywhere("Word, EPUB, PDF"),
  },
  /* The second thing Draft buys, and worth its place for that alone. Both
     numbers come from `FREE_LIMITS`, which is what `useLimitGate` spends, so
     this cannot promise a count the screen then refuses. `pro: null` there means
     no ceiling, which is the one value `badgeTone` paints gold. */
  {
    label: "Title check",
    values: {
      free: `${FREE_LIMITS.titleCheck.free} a day`,
      draft: UNLIMITED,
      writer: UNLIMITED,
      studio: UNLIMITED,
    },
  },
  {
    label: "Consistency check",
    values: everywhere(INCLUDED),
  },
  /* ── The boundary. Everything below is crossed on Free and Draft. ────── */
  {
    label: "Writing assistant",
    values: withAssistant(INCLUDED),
  },
  /* **The two counts, and the wording is deliberately about the allowance
     rather than the model.**

     A card may not imply one model is cleverer than another: on an Anthropic
     deployment Quick is Haiku and Careful is Sonnet, but on a Google one they
     are the same model, and "thinks harder" would be a claim the code cannot
     back on half the installations. What is true everywhere is how many you
     get and how often they come back — which is also the actual difference a
     buyer is choosing between. The behavioural description lives in the
     panel's own tooltip, where the deployment knows its provider. */
  {
    label: "Quick replies",
    values: withAssistant({
      free: "",
      draft: "",
      writer: `${TIER_LIMITS.writer.quickPerDay} a day`,
      studio: `${TIER_LIMITS.studio.quickPerDay} a day`,
    }),
  },
  {
    label: "Careful replies",
    values: withAssistant({
      free: "",
      draft: "",
      writer: `${TIER_LIMITS.writer.carefulPerMonth} a month`,
      studio: `${TIER_LIMITS.studio.carefulPerMonth} a month`,
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
    label: "Writes into your chapter",
    values: withAssistant(INCLUDED),
  },
];
