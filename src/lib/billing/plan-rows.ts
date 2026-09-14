/**
 * Every line the two plans are compared on, and what each one gives.
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
 * **The order of this array is the order in the table.** The two rows where
 * the plans differ come first in their groups; everything else is the same on
 * both, and a row of identical values is the argument rather than filler.
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

/**
 * The two things a reader is comparing, in the order a book is made in:
 * writing it, then getting it out.
 *
 * The groups exist for the comparison table; the cards carry a short list of
 * their own. A row with no group would silently vanish from the table, so the
 * field is required rather than optional.
 */
export const ROW_GROUPS = ["Writing", "Publishing"] as const;

export type RowGroup = (typeof ROW_GROUPS)[number];

export const ROWS: {
  group: RowGroup;
  label: string;
  values: Record<PlanTier, string>;
}[] = [
  /* **Line one, because it is the first thing Pro buys** — said first rather
     than found. */
  {
    group: "Writing",
    label: "Books",
    values: {
      free: plural(TIER_LIMITS.free.books ?? 0, "book"),
      pro: UNLIMITED,
    },
  },
  /* Qualifies the row above it: one book, but nothing inside it counted. */
  {
    group: "Writing",
    label: "Chapters and words",
    values: everywhere(UNLIMITED),
  },
  {
    group: "Writing",
    label: "Autosave and sync",
    values: everywhere(INCLUDED),
  },
  {
    group: "Writing",
    label: "Voice typing",
    values: everywhere(INCLUDED),
  },
  /* **The second thing Pro buys.** The number comes from `FREE_LIMITS`, which
     is what `useLimitGate` spends, so this cannot promise a count the screen
     then refuses. `pro: null` there means no ceiling, which is the one value
     `badgeTone` paints gold. */
  {
    group: "Publishing",
    label: "Title check",
    values: {
      free: `${FREE_LIMITS.titleCheck.free} a day`,
      pro: UNLIMITED,
    },
  },
  /* **The wedge.** Export is the one thing a writer cannot do without, and
     charging for the door is what this trade's writers check for first. Two
     identical values *is* the argument; the row stays for exactly that
     reason. */
  {
    group: "Publishing",
    label: "Export",
    values: everywhere("Word, EPUB, PDF"),
  },
  {
    group: "Publishing",
    label: "Consistency check",
    values: everywhere(INCLUDED),
  },
];
