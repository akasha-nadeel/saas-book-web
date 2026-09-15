"use client";

/**
 * The billing-cycle switch, shared by the two pages that price things.
 *
 * **Its own module because the landing page is a Server Component.** It lived
 * inside `plans.tsx` while `/upgrade` was the only page with a cycle to choose;
 * the landing page now offers the same choice, and a Server Component cannot
 * hold the state a toggle needs. One island, imported by both, rather than a
 * second toggle that can disagree with this one about what a year saves.
 *
 * **Drawn to the reference the pricing cards copy (2026-09-16)**: "annually", a
 * switch, "Monthly", and a discount pill above with a hand-drawn arrow down to
 * the annual label. The knob sits on the right for Monthly, as the reference
 * has it; the chosen word takes the indigo.
 */

import type { Period } from "@/lib/billing/plans";
import { uniformAnnualSaving } from "@/lib/billing/plans";

export function PeriodToggle({
  period,
  onChange,
  className = "",
}: {
  period: Period;
  onChange: (next: Period) => void;
  className?: string;
}) {
  const saving = uniformAnnualSaving();
  const monthly = period === "monthly";

  /* The percentage is computed from the prices (see `annualSavingPercent`)
     rather than written here — a badge is a claim about figures that live
     somewhere else, and the last hand-typed one in this codebase went stale the
     day a price moved. `uniformAnnualSaving` answers null when the plans do not
     all save the same, and then no figure is printed at all. */
  const badge = saving !== null && saving > 0;

  const label = (on: boolean) =>
    `cursor-pointer rounded-sm text-[1.0625rem] outline-none transition-colors
     focus-visible:ring-2 focus-visible:ring-price-brand/60 ${
       on ? "text-price-brand-text" : "text-price-ink"
     }`;

  return (
    <div
      className={`relative inline-flex items-center gap-3.5 font-pricing ${
        badge ? "pt-11 pl-[4.5rem]" : ""
      } ${className}`}
    >
      {badge && (
        <>
          <span
            className="absolute top-0 left-0 rounded-full border-[1.5px] border-price-brand-soft
                       px-2.5 py-0.5 text-[0.9375rem] leading-snug whitespace-nowrap
                       text-price-brand-text"
          >
            {saving}% discount
          </span>
          {/* From the pill down and round to the word it is about. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 34 30"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute top-[1.85rem] left-[2.3rem] h-[1.9rem] w-[2.1rem] text-price-ink"
          >
            <path d="M3 1c0 15 8 23 27 23" />
            <path d="m26.5 20.5 3.5 3.5-3.5 3.5" />
          </svg>
        </>
      )}

      <button
        type="button"
        aria-pressed={!monthly}
        onClick={() => onChange("annual")}
        className={label(!monthly)}
      >
        annually
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={monthly}
        aria-label="Bill monthly"
        onClick={() => onChange(monthly ? "annual" : "monthly")}
        className="relative h-[1.6rem] w-[3.25rem] shrink-0 cursor-pointer rounded-full
                   bg-price-brand outline-none focus-visible:ring-2
                   focus-visible:ring-price-brand/60 focus-visible:ring-offset-2
                   focus-visible:ring-offset-price-ground"
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white
                      shadow-sm transition-[left] duration-200 ${
                        monthly ? "left-[calc(100%_-_1.45rem)]" : "left-[0.2rem]"
                      }`}
        />
      </button>

      <button
        type="button"
        aria-pressed={monthly}
        onClick={() => onChange("monthly")}
        className={label(monthly)}
      >
        Monthly
      </button>
    </div>
  );
}
