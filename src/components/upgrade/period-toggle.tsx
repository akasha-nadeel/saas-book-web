"use client";

/**
 * The billing-cycle pill, shared by the two pages that price things.
 *
 * **Its own module because the landing page is a Server Component.** It lived
 * inside `plans.tsx` while `/upgrade` was the only page with a cycle to choose;
 * the landing page now offers the same choice, and a Server Component cannot
 * hold the state a toggle needs. One island, imported by both, rather than a
 * second toggle that can disagree with this one about what a year saves.
 */

import type { Period } from "@/lib/billing/plans";
import { uniformAnnualSaving } from "@/lib/billing/plans";

/**
 * Monthly / Annually.
 *
 * A radiogroup rather than two buttons with `aria-pressed`: these are one
 * choice with two answers, and a screen reader should hear it that way — which
 * is also how the tab key then behaves, landing on the group once instead of
 * on each half.
 *
 * The chosen half is a filled pill on a light track, so the state is carried by
 * the fill and not by a weight change that only sighted readers catch.
 */
export function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (next: Period) => void;
}) {
  const saving = uniformAnnualSaving();

  const options: { value: Period; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annually" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="mt-8 inline-flex items-center gap-1 rounded-full border
                 border-line bg-panel p-1"
    >
      {options.map((option) => {
        const on = period === option.value;
        /* The saving rides *on the control that switches to it*, which is
           where every subscription page puts it and the only place it is an
           answer rather than a fact: the reader is deciding between two
           buttons and this is the difference between them. On the price
           beneath it, it would be arriving after the decision.

           The percentage is computed from the prices (see
           `annualSavingPercent`) rather than written here — a badge is a claim
           about figures that live somewhere else, and the last hand-typed one
           in this codebase went stale the day a price moved.

           **One badge now sits above three columns**, so it is drawn only when
           all three paid plans actually save the same percentage —
           `uniformAnnualSaving` answers null when they do not, and a single
           figure printed over three different savings would be the same stale
           claim one level up. */
        const badge = option.value === "annual" && saving !== null && saving > 0;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-full py-2
                        font-sans text-sm font-medium outline-none
                        transition-colors focus-visible:ring-2
                        focus-visible:ring-accent/60 ${badge ? "pr-2 pl-5" : "px-5"} ${
                          on
                            ? "bg-fg text-surface"
                            : "text-muted hover:text-fg"
                        }`}
          >
            {option.label}
            {badge && (
              /* `ok`, the status family's green, because a saving is money
                 kept rather than a feature — the same ink the readiness
                 badges use for "nothing owed here". It keeps its own ground
                 on both sides of the toggle, so the figure stays legible when
                 the pill behind it inverts. */
              <span
                className="rounded-md border border-ok-line bg-ok-bg px-2 py-0.5
                           font-sans text-[0.6875rem] font-semibold text-ok-fg"
              >
                Save {saving}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
