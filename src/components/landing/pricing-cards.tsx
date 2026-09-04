"use client";

/**
 * The landing page's four pricing cards, the cycle toggle over them, and the
 * comparison underneath.
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
 *
 * **The card marks are imported now rather than redrawn.** This file kept its
 * own `PenMark` and `StackMark` because `plan-card.tsx` only exported two and
 * this needed the pair on different cards. It exports four as of 2026-09-04 —
 * page, pencil, nib, shelf, the ladder the plans climb — so the second copy was
 * two drawings of one alphabet waiting to drift apart at the stroke weight.
 */

import { useState } from "react";
import Link from "next/link";
import {
  KeyIcon,
  NibIcon,
  PenIcon,
  PlanCard,
  ShelfIcon,
  StackIcon,
} from "@/components/upgrade/plan-card";
import { PlanTable } from "@/components/upgrade/plan-table";
import { PeriodToggle } from "@/components/upgrade/period-toggle";
import {
  PLAN_BUTTON_PLAIN,
  planButton,
} from "@/components/upgrade/plan-button";
import {
  BEST_FOR,
  PASS_BEST_FOR,
  PASS_HIGHLIGHTS,
  highlightsFor,
  replyCountsFor,
} from "@/lib/billing/plan-highlights";
import { STARTER_PASS, passReplyCounts } from "@/lib/billing/starter-pass";
import {
  displayPrice,
  perMonthOf,
  priceOf,
  type PaidTier,
  type Period,
} from "@/lib/billing/plans";
import { TIER_NAMES } from "@/lib/billing/tiers";

/**
 * The three paid cards, in reading order.
 *
 * **The near-twin of `PAID_CARDS` in `plans.tsx`, and it is now near enough to
 * be worth saying why the two still exist.** They used to differ in their
 * blurbs, on the argument that a signed-out visitor is being told what a plan
 * *is* while somebody on `/upgrade` is choosing between them. Those words came
 * out of both arrays on 2026-09-04 — the positioning line is `BEST_FOR` and the
 * contents are `highlightsFor`, in one place for both pages — so what is left
 * here is the mark, the featured flag, and a button that links instead of
 * charging. Any *claim* that differed between the two would now be a bug.
 *
 * **Writer is the featured one**, and the reason changed under it the same day:
 * it used to be "where the assistant first appears", which stopped being true
 * when every paid plan got credits. It stays featured as the middle anchor —
 * see the fuller note over `PAID_CARDS` in `plans.tsx`.
 */
const PAID: {
  tier: PaidTier;
  mark: React.ReactNode;
  featured?: boolean;
}[] = [
  { tier: "draft", mark: <PenIcon /> },
  { tier: "writer", mark: <NibIcon />, featured: true },
  { tier: "studio", mark: <ShelfIcon /> },
];

export function PricingCards() {
  /* **Annual, not monthly.** The toggle's own badge says a year saves 25%, and
     opening on the cycle that badge is about means the first figure a reader
     sees is the one being recommended. Monthly is one press away. */
  const [period, setPeriod] = useState<Period>("annual");

  return (
    <>
      <PeriodToggle period={period} onChange={setPeriod} />

      {/* `items-stretch` and `mt-auto` on each action are together what put the
          five buttons on one line under lists of different lengths.

          `xl:grid-cols-5` rather than five across from `sm`: five columns at
          768px is 150px each and every figure in them wraps. */}
      <div className="mx-auto mt-10 grid max-w-[96rem] gap-3.5 sm:grid-cols-2 sm:items-stretch xl:grid-cols-5">
        <PlanCard
          mark={<StackIcon />}
          name={TIER_NAMES.free}
          bestFor={BEST_FOR.free}
          price="$0"
          note="No card needed"
          highlights={highlightsFor("free")}
          action={
            <Link href="/signup" className={PLAN_BUTTON_PLAIN}>
              Start writing free
            </Link>
          }
        />

        {/* Second, between Free and the plans, because that is what it is for:
            the step a reader takes when Free has shown them the tool and a
            subscription is still a bigger decision than they are ready for.
            Filed at the end of the row it would read as the cheapest plan,
            which is the one thing it is not. */}
        <PlanCard
          tone="pass"
          badge="New writers only"
          mark={<KeyIcon />}
          name="Starter Pass"
          bestFor={PASS_BEST_FOR}
          price={displayPrice(STARTER_PASS.price)}
          note="Charged once, never renews"
          highlights={PASS_HIGHLIGHTS}
          replies={passReplyCounts()}
          action={
            <Link href="/upgrade" className={PLAN_BUTTON_PLAIN}>
              Get the Starter Pass
            </Link>
          }
        />

        {PAID.map(({ tier, mark, featured }) => (
          <PlanCard
            key={tier}
            tone={featured ? "featured" : "plain"}
            badge={featured ? "Most chosen" : undefined}
            mark={mark}
            name={TIER_NAMES[tier]}
            bestFor={BEST_FOR[tier]}
            price={displayPrice(perMonthOf(tier, period))}
            note={
              period === "annual"
                ? `${displayPrice(priceOf(tier, "annual"))} billed annually`
                : "Billed monthly"
            }
            highlights={highlightsFor(tier)}
            replies={replyCountsFor(tier)}
            action={
              <Link href="/upgrade" className={planButton(featured)}>
                Choose {TIER_NAMES[tier]}
              </Link>
            }
          />
        ))}
      </div>

      {/* The contract under the pitch, and the same component `/upgrade`
          draws — so a visitor who reads it here and again after signing in is
          reading one table rather than two lists that agree today. */}
      <div className="mx-auto max-w-[96rem]">
        <PlanTable spotlight="writer" />
      </div>
    </>
  );
}
