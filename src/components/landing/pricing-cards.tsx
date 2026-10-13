"use client";

/**
 * The landing page's pricing cards, the cycle toggle over them, and the
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
 * **Three cards since 2026-10-12: Free, Pro and Pro Plus.** There were five
 * once — Free, the Starter Pass and three paid plans that differed only by
 * assistant credits — and two from 2026-09-14, when the AI went. Pro Plus is
 * Pro and Amazon's data, which costs money by the request. The paid cards are
 * drawn from `PAID_TIERS`, so a plan cannot be sold here and missing there.
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
  upgradeTo,
  type Period,
} from "@/lib/billing/plans";
import { PAID_TIERS, TIER_NAMES, type PaidTier } from "@/lib/billing/tiers";
import { signupTo } from "@/lib/file-check";
import { notePlanInterest } from "@/lib/plan-interest";

/** The plan the page recommends; it wears the featured card. */
const FEATURED: PaidTier = "pro";

export function PricingCards({
  soon = [],
}: {
  /**
   * Paid plans that cannot be bought yet (no Paddle prices set). Their card
   * says so instead of sending a visitor to a checkout that will refuse them.
   * Decided on the server, where the configuration is.
   */
  soon?: readonly PaidTier[];
}) {
  /* **Monthly first, by the owner's choice (2026-09-24).** It was annual, on
     the argument that the toggle's "Save" badge is about the year; the owner
     wants the first price a visitor reads to be the plain monthly one. The
     annual saving is still one press away, and its badge still says so. */
  const [period, setPeriod] = useState<Period>("monthly");

  return (
    <>
      {/* The same section `/upgrade` draws, to the same reference: its own
          ground, the switch over the paid columns, and the cards. This
          page is pinned to the light scheme, so it shows the day values of
          `price-*`. */}
      {/* `px-3` on a phone rather than `px-4`. The 8px it gives back is what
          keeps the cycle toggle's full arrangement — pill, arrow and all three
          words — inside a 360px screen with room to spare rather than by a
          hair; this box is `overflow-hidden`, so "by a hair" is the difference
          between tight and a word silently missing. See the measurement on
          `PeriodToggle`. */}
      <div className="relative mx-auto mt-10 max-w-[72rem] overflow-hidden rounded-3xl bg-price-ground px-3 pt-7 pb-10 text-left sm:px-10">
        <PricingDecor />

        <div className="relative mx-auto flex max-w-[66rem] justify-center sm:justify-end sm:pr-8">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        <div className="relative mx-auto mt-5 grid max-w-[66rem] gap-5 sm:grid-cols-2 sm:items-stretch lg:grid-cols-3">
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

          {PAID_TIERS.map((tier) => {
            const featured = tier === FEATURED;
            const offSale = soon.includes(tier);
            return (
              <PlanCard
                key={tier}
                tone={featured ? "featured" : "plain"}
                badge={featured ? "Recommended" : undefined}
                name={TIER_NAMES[tier]}
                subtitle={BEST_FOR[tier]}
                was={
                  period === "annual"
                    ? displayPrice(priceOf(tier, "monthly"))
                    : undefined
                }
                price={displayPrice(perMonthOf(tier, period))}
                per="/month"
                note={
                  period === "annual"
                    ? `${displayPrice(priceOf(tier, "annual"))} billed annually`
                    : "Billed monthly"
                }
                highlights={highlightsFor(tier)}
                action={
                  offSale ? (
                    /* Not a link to a checkout that would refuse the
                       visitor: the press is still heard, and nothing else
                       happens. */
                    <button
                      type="button"
                      onClick={() => notePlanInterest(tier, period, "landing")}
                      className={planButton(featured)}
                    >
                      Available soon
                    </button>
                  ) : (
                    /* **Still a link, and the press is still heard.**
                       Turning this into a button to record the press would
                       cost middle-click, open-in-new-tab and the keyboard
                       behaviour a visitor expects of something that
                       navigates — for a signal a beacon can carry without
                       touching any of it. `notePlanInterest` uses
                       `sendBeacon` precisely so it survives the navigation
                       this same press starts.

                       **It carries the plan and the cycle through the door,
                       and the door is sign-up.** Nobody on this page has an
                       account — that is what the page is for — so the
                       destination after signing up is the checkout they were
                       already asking for. Someone who does have one switches
                       to sign-in on that same form, which keeps `next`. */
                    <Link
                      href={signupTo(upgradeTo(tier, period))}
                      onClick={() => notePlanInterest(tier, period, "landing")}
                      className={planButton(featured)}
                    >
                      Choose {TIER_NAMES[tier]}
                    </Link>
                  )
                }
              />
            );
          })}
        </div>
      </div>

      {/* The contract under the pitch, and the same component `/upgrade`
          draws — so a visitor who reads it here and again after signing in is
          reading one table rather than two lists that agree today. */}
      <div className="mx-auto max-w-4xl">
        <PlanTable spotlight={FEATURED} />
      </div>
    </>
  );
}
