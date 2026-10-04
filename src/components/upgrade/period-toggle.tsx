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
      /* **One control at one size everywhere, and the arrangement breaks at
          360px rather than at `sm`.** Nothing here is sized by breakpoint —
          the labels are 17px and the switch 52x26 on a phone exactly as on a
          desktop. What the width decides is only whether the pill can sit
          *beside* the row with its arrow, or has to sit centred over it.

          Measured 2026-10-04: "annually" 63px, the switch 52, "Monthly" 61,
          two 14px gaps — 204px of control — and `pl-[4.5rem]` puts 72px of
          reserve in front of it for the pill and the arrow, making 276.
          Against the room inside the pricing box (the viewport less the
          section's `px-6` and this box's own padding) that is 303 at 375px
          and 288 at 360px, so the full arrangement holds on every phone in
          circulation bar the 320px class — where it would be 248 and the box,
          being `overflow-hidden`, would not push "Monthly" anywhere, it would
          silently cut it off. So 360 is the line, and under it the pill goes
          over the row instead.

          The figure in the pill is read from `uniformAnnualSaving()` rather
          than typed, whichever way it sits. */
      className={`relative inline-flex items-center gap-3.5 font-pricing ${
        badge ? "pt-11 min-[360px]:pl-[4.5rem]" : ""
      } ${className}`}
    >
      {badge && (
        <>
          {/* Hard left wherever the reserve is there to hold it, centred over
              the row where it is not — on a 320px phone there is no reserve,
              so left-aligned it would sit against the edge pointing at
              nothing. */}
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full border-[1.5px]
                       border-price-brand-soft px-2.5 py-0.5 text-[0.9375rem] leading-snug
                       whitespace-nowrap text-price-brand-text
                       min-[360px]:left-0 min-[360px]:translate-x-0"
          >
            {saving}% discount
          </span>
          {/* From the pill down and round to the word it is about. It needs
              the reserve to travel across, so it appears with it at 360 and
              not before: under that "annually" starts at the left edge and
              there is nowhere for the arrow to come from. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 34 30"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute top-[1.85rem] left-[2.3rem] hidden h-[1.9rem] w-[2.1rem] text-price-ink min-[360px]:block"
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

      {/* **The two `min-` classes are what keep this the same switch on a
          phone as on a desktop, and without them it is not.** `globals.css`
          gives every `button` a 44px floor under `@media (pointer: coarse)`,
          which a finger matches and a mouse does not — so the drawn 52x26 pill
          came out 52x44 on a phone: a fat lozenge beside the same 17px words,
          where the reference and the desktop have a flat one. That rule is
          `:where(...)` and therefore weightless, so a single utility class
          overrules it — except that the rule is *unlayered* and Tailwind's
          utilities are in `@layer utilities`, and unlayered beats layered
          whatever the specificity. So the way out is a class the rule itself
          knows about, which is what `oc-touch-exempt` is; `globals.css` carries
          the reasoning beside it.

          **The hit box is kept, which is why the rule existed.** `before:` is
          an invisible 44x56 box centred on the pill, and a pseudo-element of a
          button is part of the button for the purposes of a press — so a
          finger still gets its target while the paint stays 26px. The two
          words either side are buttons too and keep the floor outright, so
          most of this control is finger-sized anyway. */}
      <button
        type="button"
        role="switch"
        aria-checked={monthly}
        aria-label="Bill monthly"
        onClick={() => onChange(monthly ? "annual" : "monthly")}
        className="oc-touch-exempt relative h-[1.6rem] w-[3.25rem] shrink-0
                   cursor-pointer rounded-full
                   bg-price-brand outline-none before:absolute before:top-1/2
                   before:left-1/2 before:h-11 before:w-14 before:-translate-x-1/2
                   before:-translate-y-1/2 before:content-[''] focus-visible:ring-2
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
