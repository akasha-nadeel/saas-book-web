/**
 * One plan, drawn as a card: the name, who it is for, the price, a button, and
 * the features.
 *
 * **No `"use client"`, deliberately.** Nothing here holds state or listens for
 * anything — the period toggle, the checkout and the provider branching all
 * live in `plans.tsx`, which passes the result down as `price` and `action`.
 * That is what lets the landing page, a Server Component, render exactly the
 * same card as `/upgrade` rather than keeping a second one of its own. Two
 * hand-written lists of claims about one product is how a pricing page ends up
 * disagreeing with itself.
 *
 * ## The reference design (2026-09-16)
 *
 * **Drawn to a reference the owner supplied, measure for measure**: a white
 * card with a thin indigo outline beside an indigo card with a gold tab, the
 * name large and left-aligned, a struck price over a very large one, a
 * full-width button, a rule, "Features:" and a list behind gold bolts. The
 * reference's "Contact for Inquiry" button is left out at the owner's request.
 *
 * **Its palette is its own** — `price-*` in `globals.css`, the seventh entry on
 * the closed list, with a night version — and so is its face, Roboto
 * (`font-pricing`). The earlier card was built on the app's own tokens so it
 * could not read as a second product; the owner chose the reference over that.
 *
 * **What the reference shows and this does not say.** Three departures, each
 * because the reference's version would be a claim the code cannot back:
 *
 * - The struck price is the real monthly price, shown only on the annual cycle
 *   over the real per-month annual figure. Free has nothing to strike, and
 *   neither does Pro on the monthly cycle — the line keeps its height either way
 *   so the two prices stay on one baseline.
 * - One small line under the price says how the figure is billed. A per-month
 *   price with no word of the annual total is how a checkout surprises
 *   somebody.
 * - The tab says "Recommended", not "Popular": nobody has bought Pro yet.
 */

import type { Highlight } from "@/lib/billing/plan-highlights";

/** The white card or the indigo one. */
export type CardTone = "plain" | "featured";

/**
 * How far the gold tab stands above the card's top edge.
 *
 * The plain card takes the same space above it from `sm`, where the two sit in
 * one row, so both names and both prices still share a line.
 */
const TAB = "1.85rem";

export function PlanCard({
  tone = "plain",
  badge,
  name,
  subtitle,
  was,
  price,
  per,
  note,
  highlights,
  action,
}: {
  tone?: CardTone;
  /** The gold tab over the card's top edge. Only on the featured one. */
  badge?: string;
  name: string;
  /** Who the plan is for, in one sentence. */
  subtitle: string;
  /** The struck price, when there is a true one to strike. */
  was?: string;
  price: string;
  /** Beside the price — "/month". */
  per: string;
  /** Under the price — how this figure is billed. */
  note?: string;
  highlights: Highlight[];
  action: React.ReactNode;
}) {
  const featured = tone === "featured";
  const pale = featured ? "text-white/55" : "text-price-pale";

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ paddingTop: badge ? TAB : undefined }}
    >
      {badge && (
        /* **Behind the card, not on it.** The gold block is the card's width
           and runs down under its top edge, so the card's own rounded corners
           show gold in the notches — which is what makes the tab read as part
           of the card rather than a sticker placed over it. */
        <div
          className="absolute inset-x-0 top-0 h-20 rounded-t-[2.2rem] bg-price-gold"
          aria-hidden="true"
        />
      )}
      {badge && (
        <p
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center font-pricing text-[0.9375rem] font-medium text-white"
          style={{ height: TAB }}
        >
          {badge}
        </p>
      )}

      <section
        className={`relative flex flex-1 flex-col rounded-2xl px-5 pt-7 pb-7 text-left font-pricing ${
          badge ? "" : "sm:mt-[1.85rem]"
        } ${
          featured
            ? "bg-price-brand text-white"
            : "border-[1.5px] border-price-card-line bg-price-card text-price-ink"
        }`}
      >
        <h2 className="text-[1.75rem] leading-tight font-bold">{name}</h2>
        {/* Two lines reserved, so a one-line sentence on one card does not
            lift that card's price above the other's. */}
        <p className={`mt-1 min-h-[2rem] text-[0.75rem] leading-[1.35] ${pale}`}>
          {subtitle}
        </p>

        {/* Always this tall, filled or not — see the header. */}
        <p
          className={`mt-5 h-7 text-[1.375rem] leading-7 ${
            featured ? "text-white/85" : "text-price-old"
          }`}
        >
          {was && (
            <del
              className={`decoration-2 ${
                featured ? "decoration-price-gold" : "decoration-price-brand"
              }`}
            >
              <span className="sr-only">Monthly price </span>
              {was}
            </del>
          )}
        </p>

        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[3.75rem] leading-none font-black tracking-tight tabular-nums sm:text-[4.5rem]">
            {price}
          </span>
          <span className={`text-[1.125rem] ${pale}`}>{per}</span>
        </p>
        <p className={`mt-1.5 h-5 text-[0.8125rem] ${pale}`}>{note}</p>

        <div className="mt-7 px-1.5">{action}</div>

        <hr
          className={`mt-6 h-px border-0 ${
            featured ? "bg-white/15" : "bg-price-rule"
          }`}
        />

        <h3 className="mt-5 text-[1.375rem] font-medium">Features:</h3>

        <ul className="mt-5 flex flex-col gap-1.5">
          {highlights.map((line) => (
            <li
              key={`${line.lead ?? ""}${line.text}`}
              /* Stronger than the reference's pale grey, at the owner's
                 request — these are the lines a reader is comparing. */
              className={`flex items-start gap-3 text-[0.9375rem] leading-[1.4] ${
                featured ? "text-white/85" : "text-price-list"
              }`}
            >
              <BoltIcon />
              {/* One style for the whole line, as the reference sets it: the
                  figure and the words are not split into two weights. */}
              <span>{line.lead ? `${line.lead} ${line.text}` : line.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The gold bolt in front of each feature. Filled, as the reference draws it. */
function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="mt-[0.2rem] h-3.5 w-3.5 shrink-0 text-price-gold"
    >
      <path d="M13.5 1.5 4 13.5h6.5L9.5 22.5 20 10h-6.6l.1-8.5Z" />
    </svg>
  );
}

/**
 * The three small marks scattered over the section in the reference — a gold
 * ring, an indigo plus and a gold dash at the right edge.
 *
 * Decoration and nothing else: hidden from screen readers, never in the way of
 * a press, and placed inside the section's own box so it cannot widen the page.
 */
export function PricingDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="absolute top-14 left-[9%] h-[1.1rem] w-[1.1rem] rounded-full border-[3px] border-price-gold" />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="absolute top-8 left-[28%] h-4 w-4 text-price-brand/70"
      >
        <path d="M8 2v12M2 8h12" />
      </svg>
      <span className="absolute top-[64%] right-0 h-[3px] w-5 rounded-l-full bg-price-gold" />
    </div>
  );
}
