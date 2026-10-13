/**
 * Every line the three plans are compared on, and what each one gives.
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
 * **The order of this array is the order in the table.** Books leads; the rest
 * run in the order a book is made in. A row of identical values is the
 * argument rather than filler.
 *
 * **Pro Plus is Pro on every row but the three Amazon ones** (2026-10-12):
 * the Market check's source, the category check and the trends. Those three
 * are written from `amazonDataAllowed`, so moving `AMAZON_DATA_TIER` to Pro
 * moves the words with it. Paperback setup is the one row Free does not have
 * at all; the category check and the trends are the two Pro does not.
 */

import { ALL_CHECKS, FREE_CHECKS } from "@/lib/consistency-ids";
import { FREE_LIMITS, FREE_RECORD_DAYS } from "@/lib/free-limits";
import { plural } from "@/lib/plural";
import {
  FREE_PAPERS,
  FREE_TINTS,
  PRO_PAPERS,
  SHOWN_TINTS,
} from "@/lib/theme-access";
import { TIER_LIMITS, TIER_ORDER, amazonDataAllowed, type PlanTier } from "./tiers";

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

/** Free says one thing, both paid plans another. */
function paid(free: string, value: string): Record<PlanTier, string> {
  return { free, pro: value, plus: value };
}

/**
 * The plans that read Amazon's data say `amazon`; the rest say `otherwise`.
 * Read from the same switch the server gate reads (`AMAZON_DATA_TIER`).
 */
function byAmazon(amazon: string, otherwise: string): Record<PlanTier, string> {
  return Object.fromEntries(
    TIER_ORDER.map((tier) => [tier, amazonDataAllowed(tier) ? amazon : otherwise]),
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
  /* **Line one, and unlimited on every plan since 2026-10-13.** It was the
     first thing Pro bought while Free held three; now the identical values are
     the argument, the way the Export row's are — no plan rations books. Read
     from `TIER_LIMITS`, so a limit brought back would show here at once. */
  {
    group: "Writing",
    label: "Books",
    values: Object.fromEntries(
      TIER_ORDER.map((tier) => {
        const limit = TIER_LIMITS[tier].books;
        return [tier, limit === null ? UNLIMITED : plural(limit, "book")];
      }),
    ) as Record<PlanTier, string>,
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
  /* Occupancy, so "at a time" rather than a total: forgetting one makes room.
     The number is the one `useLimitGate` counts against. */
  {
    group: "Writing",
    label: "Ideas",
    values: paid(`${FREE_LIMITS.ideas.free} at a time`, UNLIMITED),
  },
  /* **Both halves of one answer**, which is why this is a row and not two: the
     paper and the app's colour are the same question asked twice, and the
     picker in the top bar puts them one above the other. The counts come from
     `theme-access.ts`, which is what the swatches lock by, so a colour moving
     between the plans moves this line with it. Free is a real answer here and
     not a dash — it keeps a colour, so that a locked swatch is an offer rather
     than the first time the writer sees the feature. */
  {
    group: "Writing",
    label: "Colour themes",
    values: paid(
      `${plural(FREE_TINTS.length, "colour")}, ${FREE_PAPERS.length} papers`,
      `All ${SHOWN_TINTS.length}, all ${FREE_PAPERS.length + PRO_PAPERS.length} papers`,
    ),
  },
  /* **The second thing Pro buys.** The number comes from `FREE_LIMITS`, which
     is what `useLimitGate` spends, so this cannot promise a count the screen
     then refuses. `pro: null` there means no ceiling, which is the one value
     `badgeTone` paints gold. */
  {
    group: "Publishing",
    label: "Title check",
    values: paid(`${FREE_LIMITS.titleCheck.free} a day`, UNLIMITED),
  },
  /* **Not metered since 2026-10-06; the plans differ by source instead.**
     Apple Books' lists are free to read, so every plan has the Market check
     (the price check, renamed 2026-10-12) as often as it likes. Amazon's own
     top 100 with Kindle Unlimited is paid for per request and checked on the
     server (`require-amazon-data.ts`), so it is Pro Plus. Worded to keep clear
     of the unanchored `/ai/` check in the test — no "available", no "paid". */
  {
    group: "Publishing",
    label: "Market check",
    values: byAmazon("Amazon + Apple", "Apple prices"),
  },
  /* The categories a genre's top 100 also rank in, and the whole-store rank of
     the list's #1 to #100 — read off the same Amazon data. */
  {
    group: "Publishing",
    label: "Category check",
    values: byAmazon("Amazon categories", NOT_INCLUDED),
  },
  /* New releases, movers and most wished for, rating counts and the covers. */
  {
    group: "Publishing",
    label: "Trends & reviews",
    values: byAmazon("Amazon lists", NOT_INCLUDED),
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
  /* Both counts come from `consistency-ids.ts`, which the picker locks by. */
  {
    group: "Publishing",
    label: "Consistency check",
    values: paid(`${FREE_CHECKS.length} checks`, `All ${ALL_CHECKS.length}`),
  },
  /* The free window is `FREE_RECORD_DAYS`; Pro reads what the log keeps,
     which is `KEEP_DAYS` — the test beside this pins the "12 months". */
  {
    group: "Publishing",
    label: "Writing record",
    values: paid(`Last ${FREE_RECORD_DAYS} days`, "Last 12 months"),
  },
  /* **Pro only since 2026-09-16**, the owner's decision — `ProGate` holds the
     screen. The table draws Free's cell as a dash. */
  {
    group: "Publishing",
    label: "Paperback setup",
    values: paid(NOT_INCLUDED, INCLUDED),
  },
];
