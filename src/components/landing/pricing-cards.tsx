"use client";

/**
 * The landing page's four pricing cards, and the cycle toggle over them.
 *
 * **An island, because the page around it is a Server Component.** The section
 * used to be drawn inline and shipped no script: a monthly figure with the
 * yearly one written underneath it, on the reasoning that *choosing* a cycle is
 * a decision for the page that takes the money. That is reversed here — a
 * visitor comparing four plans is comparing eight prices, and reading half of
 * them out of a note under the other half is work the toggle does better.
 *
 * What is *not* reversed is the rule the section was rebuilt around: the claims
 * still come from `ROWS`, so this page and `/upgrade` cannot drift into two
 * lists about one product. Only the chrome differs — a link here, a checkout
 * there.
 */

import { useState } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/upgrade/plan-card";
import { PeriodToggle } from "@/components/upgrade/period-toggle";
import {
  PLAN_BUTTON_PLAIN,
  planButton,
} from "@/components/upgrade/plan-button";
import { ROWS } from "@/lib/billing/plan-rows";
import {
  displayPrice,
  perMonthOf,
  priceOf,
  type PaidTier,
  type Period,
  type PlanTier,
} from "@/lib/billing/plans";
import { TIER_NAMES } from "@/lib/billing/tiers";

/**
 * The three paid cards, in reading order.
 *
 * A near-twin of `PAID_CARDS` in `plans.tsx`, and deliberately not shared with
 * it: the blurbs differ because the audiences do. A signed-out visitor is being
 * told what each plan *is*; somebody on `/upgrade` has already decided to buy
 * and is choosing between them. The rows — every actual claim — come from the
 * one `ROWS` array either way, which is the part that must not drift.
 *
 * **Writer is the featured one**, not Studio: it is where the assistant first
 * appears, which is the decision this page is asking a visitor to make.
 */
const PAID: {
  tier: PaidTier;
  mark: React.ReactNode;
  blurb: string;
  featured?: boolean;
}[] = [
  {
    tier: "draft",
    mark: <StackMark />,
    blurb: "Unlimited books and every export format. No assistant.",
  },
  {
    tier: "writer",
    mark: <PenMark />,
    blurb: "Everything in Draft, and the writing assistant beside the chapter.",
    featured: true,
  },
  {
    tier: "studio",
    mark: <StackMark />,
    blurb: "For a writer who leans on the assistant daily.",
  },
];

/** One column of `ROWS`, shaped for the card. */
function rowsFor(tier: PlanTier) {
  return ROWS.map((row) => ({ label: row.label, value: row.values[tier] }));
}

export function PricingCards() {
  /* **Annual, not monthly.** The toggle's own badge says a year saves 25%, and
     opening on the cycle that badge is about means the first figure a reader
     sees is the one being recommended. Monthly is one press away. */
  const [period, setPeriod] = useState<Period>("annual");

  return (
    <>
      <PeriodToggle period={period} onChange={setPeriod} />

      {/* `xl:grid-cols-4` rather than four across from `sm`: four columns at
          768px is 190px each and every row in them wraps. The 2×2 in between
          falls as (Free, Draft) and (Writer, Studio) — the half without the
          assistant and the half with it — which is the right seam to break on.

          items-start so the featured card grows upward on its own rather than
          stretching its neighbours to match. */}
      <div className="mx-auto mt-10 grid max-w-[96rem] gap-2 text-left sm:grid-cols-2 sm:items-start xl:grid-cols-4">
        <PlanCard
          mark={<PenMark />}
          name={TIER_NAMES.free}
          blurb="Write the whole book and take the file with you. No card, and no clock on it."
          price="$0"
          rows={rowsFor("free")}
          action={
            <Link href="/signup" className={PLAN_BUTTON_PLAIN}>
              Start writing free
            </Link>
          }
        />

        {PAID.map(({ tier, mark, blurb, featured }) => (
          <PlanCard
            key={tier}
            featured={featured}
            badge={featured ? "Most popular" : undefined}
            mark={mark}
            name={TIER_NAMES[tier]}
            blurb={blurb}
            price={displayPrice(perMonthOf(tier, period))}
            note={
              period === "annual"
                ? `${displayPrice(priceOf(tier, "annual"))} billed annually`
                : undefined
            }
            rows={rowsFor(tier)}
            action={
              <Link href="/upgrade" className={planButton(featured)}>
                See the plans
              </Link>
            }
          />
        ))}
      </div>
    </>
  );
}

/* The two card marks, drawn here rather than imported from `plan-card.tsx`,
   which exports them for `/upgrade`. Same alphabet: 20-grid, 1.5 weight. */

function PenMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M13.5 3.5a1.77 1.77 0 0 1 2.5 2.5L7 15l-3.5 1L4.5 12.5Z" />
      <path d="M12 5 15 8" />
    </svg>
  );
}

function StackMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M10 2.5 17.5 6 10 9.5 2.5 6Z" />
      <path d="M2.5 10 10 13.5 17.5 10" />
      <path d="M2.5 14 10 17.5 17.5 14" />
    </svg>
  );
}
