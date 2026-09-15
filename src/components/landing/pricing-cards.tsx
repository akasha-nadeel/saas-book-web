"use client";

/**
 * The landing page's two pricing cards, the cycle toggle over them, and the
 * comparison underneath.
 *
 * **An island, because the page around it is a Server Component.** The toggle
 * is state, and a visitor comparing a monthly and a yearly price should be able
 * to see each one rather than read one out of a note under the other.
 *
 * What the section was rebuilt around still holds: the claims come from `ROWS`
 * and `plan-highlights.ts`, so this page and `/upgrade` cannot drift into two
 * lists about one product. Only the chrome differs — a link here, a checkout
 * there.
 *
 * **Two cards since 2026-09-14.** There were five — Free, the Starter Pass and
 * three paid plans that differed only by assistant credits. The AI went, and
 * with it everything that separated the paid plans; Pro is what is left.
 */

import { useState } from "react";
import Link from "next/link";
import { PlanCard, PricingDecor } from "@/components/upgrade/plan-card";
import { PlanTable } from "@/components/upgrade/plan-table";
import { PeriodToggle } from "@/components/upgrade/period-toggle";
import {
  PLAN_BUTTON_PLAIN,
  planButton,
} from "@/components/upgrade/plan-button";
import { BEST_FOR, highlightsFor } from "@/lib/billing/plan-highlights";
import {
  displayPrice,
  perMonthOf,
  priceOf,
  type Period,
} from "@/lib/billing/plans";
import { TIER_NAMES } from "@/lib/billing/tiers";
import { notePlanInterest } from "@/lib/plan-interest";

export function PricingCards() {
  /* **Annual, not monthly.** The toggle's own badge says what a year saves,
     and opening on the cycle that badge is about means the first figure a
     reader sees is the one being recommended. Monthly is one press away. */
  const [period, setPeriod] = useState<Period>("annual");

  return (
    <>
      {/* The same section `/upgrade` draws, to the same reference: its own
          ground, the switch over the paid column, and the two cards. This
          page is pinned to the dark scheme, so it shows the night values of
          `price-*`. */}
      <div className="relative mx-auto mt-10 max-w-[52rem] overflow-hidden rounded-3xl bg-price-ground px-4 pt-7 pb-10 text-left sm:px-10">
        <PricingDecor />

        <div className="relative mx-auto flex max-w-[45rem] justify-center sm:justify-end sm:pr-8">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

      <div className="relative mx-auto mt-5 grid max-w-[45rem] gap-5 sm:grid-cols-2 sm:items-stretch">
        <PlanCard
          name={TIER_NAMES.free}
          subtitle={BEST_FOR.free}
          price="$0"
          per="/month"
          note="No card needed"
          highlights={highlightsFor("free")}
          action={
            <Link href="/signup" className={PLAN_BUTTON_PLAIN}>
              Start writing free
            </Link>
          }
        />

        <PlanCard
          tone="featured"
          badge="Recommended"
          name={TIER_NAMES.pro}
          subtitle={BEST_FOR.pro}
          was={
            period === "annual"
              ? displayPrice(priceOf("pro", "monthly"))
              : undefined
          }
          price={displayPrice(perMonthOf("pro", period))}
          per="/month"
          note={
            period === "annual"
              ? `${displayPrice(priceOf("pro", "annual"))} billed annually`
              : "Billed monthly"
          }
          highlights={highlightsFor("pro")}
          action={
            /* **Still a link, and the press is still heard.**
               Turning this into a button to record the press would cost
               middle-click, open-in-new-tab and the keyboard behaviour a
               visitor expects of something that navigates — for a signal a
               beacon can carry without touching any of it. `notePlanInterest`
               uses `sendBeacon` precisely so it survives the navigation this
               same press starts. */
            <Link
              href="/upgrade"
              onClick={() => notePlanInterest("pro", period, "landing")}
              className={planButton(true)}
            >
              Choose {TIER_NAMES.pro}
            </Link>
          }
        />
      </div>
      </div>

      {/* The contract under the pitch, and the same component `/upgrade`
          draws — so a visitor who reads it here and again after signing in is
          reading one table rather than two lists that agree today. */}
      <div className="mx-auto max-w-3xl">
        <PlanTable spotlight="pro" />
      </div>
    </>
  );
}
