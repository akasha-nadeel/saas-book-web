/**
 * One plan, drawn as a card: a mark, the name, the figure, who it is for, what
 * you get, and a button.
 *
 * **No `"use client"`, deliberately.** Nothing here holds state or listens for
 * anything — the period toggle, the checkout and the provider branching all
 * live in `plans.tsx`, which passes the result down as `price` and `action`.
 * That is what lets the landing page, a Server Component, render exactly the
 * same card as `/upgrade` rather than keeping a second one of its own. Two
 * hand-written lists of claims about one product is how a pricing page ends up
 * disagreeing with itself.
 *
 * ## What changed on 2026-09-04, and why
 *
 * **The card stopped being the comparison.** It used to carry all ten rows of
 * `ROWS` with a tick and a value badge against each, which is a table with
 * rounded corners — most of the lines identical across the columns, and the
 * one line a buyer is choosing between buried among them. So the card led with
 * a handful out of `plan-highlights.ts` and `PlanTable` underneath carried
 * every claim in full. **Since 2026-09-14 the card lists every row again**, as
 * plain lines rather than ticks and badges, and the table stays for reading
 * across.
 *
 * **Centred, and the figure is the largest thing on it.** A price list is
 * scanned across before it is read down, so the four figures have to land at
 * one height in one size — which is what the reserved blocks below are for.
 * Ragged prose is fine; four prices on four baselines reads as carelessness on
 * the one row where it costs a sale.
 *
 * **Everything is a token.** The design this follows carries its own palette;
 * this does not, because the app's is a closed list and a seventh exception on
 * a page the writer reaches from inside the app would be a second product. The
 * shape is the design's, the colour is the app's, and it holds in both themes.
 */

import type { Highlight } from "@/lib/billing/plan-highlights";

/**
 * Which of the two skins a card wears.
 *
 * **The featured card changes fill at night, and only at night.** By day it is
 * the brand blue with white ink. At night the accent is a bright periwinkle
 * (#8ab4ff), and white type on that is about 2:1 — so in dark mode the card
 * takes the upgrade gradient (`--color-upgrade-from` / `-to`, the app's one
 * licensed gradient, stated identically in every theme block) and every word
 * on it goes white, which clears 5:1 against both ends. `dark:` answers to
 * `[data-theme="dark"]`, so the three dark tints get it too.
 */
export type CardTone = "plain" | "featured";

export function PlanCard({
  tone = "plain",
  badge,
  mark,
  name,
  bestFor,
  price,
  note,
  highlights,
  action,
}: {
  tone?: CardTone;
  /** The tab that straddles the card's top edge. Only on the featured one. */
  badge?: string;
  mark: React.ReactNode;
  name: string;
  /** Who the plan is for, in one sentence, on a tint of its own. */
  bestFor: string;
  price: string;
  /** Shown under the price — which cycle this figure is. */
  note?: string;
  highlights: Highlight[];
  action: React.ReactNode;
}) {
  const featured = tone === "featured";

  return (
    <section
      className={`relative flex h-full flex-col gap-3 rounded-lg px-5 pt-8 pb-5
                  text-center shadow-lg ${
                    featured
                      ? // No outline on the filled card. It is already the
                        // loudest thing here, and a line around a block of
                        // colour only muddies its edge.
                        `bg-accent text-accent-ink dark:bg-linear-to-br
                         dark:from-upgrade-from dark:to-upgrade-to dark:text-white`
                      : "border border-line bg-panel text-fg"
                  }`}
    >
      {badge && (
        /* Straddles the top edge rather than sitting inside the card, so it
           reads as a label *on* the plan rather than as its first line. The
           ring is the page's own ground, which is what cuts the border cleanly
           where the tab crosses it. */
        <span
          className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                      rounded-full px-3 py-1 font-sans text-[0.625rem]
                      font-bold tracking-[0.12em] whitespace-nowrap uppercase
                      ring-2 ring-surface ${
                        featured
                          ? "bg-accent-ink text-accent dark:bg-white dark:text-upgrade-ink"
                          : "bg-accent text-accent-ink"
                      }`}
        >
          {badge}
        </span>
      )}

      {/* One mark a card, on a chip of the accent. Tinted rather than filled:
          at 42px a filled disc competes with the figure directly under it. */}
      <span
        className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${
          featured
            ? "bg-accent-ink/15 text-accent-ink dark:bg-white/15 dark:text-white"
            : "bg-accent/12 text-accent"
        }`}
      >
        {mark}
      </span>

      {/* Set in caps with wide tracking. A plan name is a label rather than a
          word being read, and caps at this width sit better over a very large
          figure than a mixed-case line does. */}
      <h2 className="font-sans text-[0.9375rem] font-bold tracking-[0.13em] uppercase">
        {name}
      </h2>

      <p className="flex items-baseline justify-center gap-1 font-display text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">
        {price}
      </p>

      {/* Reserved whether or not it is filled, so the four buttons stay on one
          line as the period switches. */}
      <p
        className={`h-5 font-sans text-sm font-medium ${
          featured ? "text-accent-ink/75 dark:text-white/75" : "text-muted"
        }`}
      >
        {note}
      </p>

      {/* The positioning line, on a tint rather than loose in the card. It is
          the one sentence saying who the plan is *for*, and a ground of its own
          is what stops it being read as the first bullet. The reserved height
          keeps the four tinted blocks on one line across the row — ragged
          boxes look like a mistake in a way ragged prose does not. */}
      <p
        className={`flex min-h-[4.125rem] items-center justify-center rounded-md
                    px-3.5 py-3 font-sans text-sm leading-snug ${
                      featured
                        ? "bg-accent-ink/12 text-accent-ink dark:bg-white/12 dark:text-white"
                        : "bg-accent/10 text-fg"
                    }`}
      >
        {bestFor}
      </p>

      <div className="mt-1 text-left">
        {/* Gives the list a head, so the card reads price → promise → contents
            rather than as one undifferentiated column. */}
        <p
          className={`pb-1.5 font-sans text-[0.625rem] font-semibold tracking-[0.11em] uppercase ${
            featured ? "text-accent-ink/70 dark:text-white/70" : "text-faint"
          }`}
        >
          What you get
        </p>
        {/* No rules between the rows. On short items the hairlines were doing
            no separating that the leading does not already do, and they made
            the list look like a table. */}
        <ul className="flex flex-col">
          {highlights.map((line) => (
            <li
              key={`${line.lead ?? ""}${line.text}`}
              className={`py-1.5 font-sans text-sm leading-snug ${
                featured ? "text-accent-ink/90 dark:text-white/90" : "text-fg/85"
              }`}
            >
              {line.lead && (
                <b
                  className={`font-semibold tabular-nums ${
                    featured ? "text-accent-ink dark:text-white" : "text-fg"
                  }`}
                >
                  {line.lead}{" "}
                </b>
              )}
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      {/* `mt-auto` is what puts the four buttons on one line whatever the lists
          above them did. */}
      <div className="mt-auto pt-3">{action}</div>
    </section>
  );
}

/* The two card marks. Same alphabet as the rest of the app: a 20-grid at 1.5
   weight, taking `currentColor` so the chip decides the hue. */

export function StackIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[21px] w-[21px]"}
    >
      <path d="M10 2.5 17.5 6 10 9.5 2.5 6Z" />
      <path d="M2.5 10 10 13.5 17.5 10" />
      <path d="M2.5 14 10 17.5 17.5 14" />
    </svg>
  );
}

export function NibIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[21px] w-[21px]"}
    >
      <path d="M10 2.5 15.5 8v6.5A1.5 1.5 0 0 1 14 16H6a1.5 1.5 0 0 1-1.5-1.5V8Z" />
      <path d="M10 9.5v4" />
      <circle cx="10" cy="7.5" r="1.1" />
    </svg>
  );
}
