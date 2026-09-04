/**
 * One plan, drawn as a card: a mark, the name, the figure, who it is for, what
 * you get, what a month of credits comes to, and a button.
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
 * rounded corners — four of them side by side is forty lines, most of them
 * identical across the four columns, and the one line a buyer is choosing
 * between (the credit grant) was the eighth of ten. So the card now leads with
 * a handful out of `plan-highlights.ts` and `PlanTable` underneath carries
 * every claim in full. Nothing was dropped; it moved to where it can be read.
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
 * Which of the three skins a card wears.
 *
 * **`pass` is a different *kind* of thing, not a louder plan**, and that is the
 * whole reason it gets a hue of its own rather than a bigger badge. Four of
 * these cards are subscriptions and one is a single charge; a reader who takes
 * the pass for a fifth plan has been misled by the layout. Violet says "not one
 * of these" before a word is read.
 *
 * It takes `badge-pro-*`, which is already in the palette and already stated in
 * all three theme blocks. **No new token was added for this** — the app's
 * colour exceptions are a closed list, and a sixth ground invented for one card
 * is exactly what that list exists to prevent.
 */
export type CardTone = "plain" | "featured" | "pass";

export function PlanCard({
  tone = "plain",
  badge,
  mark,
  name,
  bestFor,
  price,
  note,
  highlights,
  replies,
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
  /**
   * What a month of credits comes to, in replies.
   *
   * **The one figure a reader wants and the one a credit balance never gives.**
   * Absent on a plan with no grant, where the box would be three zeroes.
   */
  replies?: { label: string; count: string }[];
  action: React.ReactNode;
}) {
  const featured = tone === "featured";
  const pass = tone === "pass";

  return (
    <section
      className={`relative flex h-full flex-col gap-3 rounded-lg px-5 pt-8 pb-5
                  text-center shadow-lg ${
                    featured
                      ? // No outline on the filled card. It is already the
                        // loudest thing here, and a line around a block of
                        // colour only muddies its edge.
                        "bg-accent text-accent-ink"
                      : pass
                        ? // Tinted rather than filled, with its border in the
                          // same hue: the pass reads as *aside from* the row
                          // rather than as competing with the featured plan.
                          "border border-badge-pro-line bg-badge-pro-bg text-fg"
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
                          ? "bg-accent-ink text-accent"
                          : pass
                            ? "bg-badge-pro-ink text-badge-pro-bg"
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
            ? "bg-accent-ink/15 text-accent-ink"
            : pass
              ? "bg-badge-pro-ink/15 text-badge-pro-ink"
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
          featured ? "text-accent-ink/75" : "text-muted"
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
                        ? "bg-accent-ink/12 text-accent-ink"
                        : pass
                          ? // Solid violet with its own ink, which is the
                            // tint's ground — the fill is light by day and
                            // dark at night, so one literal would vanish in
                            // one of the two.
                            "bg-badge-pro-ink text-badge-pro-bg"
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
            featured ? "text-accent-ink/70" : "text-faint"
          }`}
        >
          What you get
        </p>
        {/* No rules between the rows. At five short items the hairlines were
            doing no separating that the leading does not already do, and they
            made a five-line list look like a five-row table. */}
        <ul className="flex flex-col">
          {highlights.map((line) => (
            <li
              key={`${line.lead ?? ""}${line.text}`}
              className={`py-1.5 font-sans text-sm leading-snug ${
                featured ? "text-accent-ink/90" : "text-fg/85"
              }`}
            >
              {line.lead && (
                <b
                  className={`font-semibold tabular-nums ${
                    featured ? "text-accent-ink" : "text-fg"
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

      {replies && (
        /* What the month actually buys, boxed under the list. `flex-1 basis-auto`
           rather than equal thirds: equal columns cut "1,000" off on Studio at
           this size, and letting each figure take its own width keeps every
           card on one line. */
        <div
          className={`mt-2 flex items-start justify-center gap-0.5 rounded-md
                      border px-1 py-2.5 ${
                        featured
                          ? "border-accent-ink/25"
                          : pass
                            ? "border-badge-pro-line"
                            : "border-line"
                      }`}
        >
          {replies.map((model, index) => (
            <div key={model.label} className="flex min-w-0 items-start">
              {index > 0 && (
                /* Sits on the figures' line rather than the box's middle, so
                   the three counts read as one sentence across the box. */
                <span
                  className={`shrink-0 pt-1.5 font-sans text-[0.625rem] italic ${
                    featured ? "text-accent-ink/70" : "text-muted"
                  }`}
                >
                  or&nbsp;
                </span>
              )}
              <div className="flex min-w-0 flex-col items-center gap-px px-1">
                <b className="font-display text-[1.4375rem] leading-tight font-bold tracking-tight tabular-nums whitespace-nowrap">
                  {model.count}
                </b>
                <i
                  className={`font-sans text-[0.625rem] font-semibold tracking-[0.05em] uppercase not-italic ${
                    featured ? "text-accent-ink/70" : "text-muted"
                  }`}
                >
                  {model.label}
                </i>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* `mt-auto` is what puts the four buttons on one line whatever the lists
          above them did. */}
      <div className="mt-auto pt-3">{action}</div>
    </section>
  );
}

/* The two card marks. Same alphabet as the rest of the app: a 20-grid at 1.5
   weight, taking `currentColor` so the chip decides the hue. */

export function PenIcon({ className }: { className?: string }) {
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
      <path d="M13.5 3.5a1.77 1.77 0 0 1 2.5 2.5L7 15l-3.5 1L4.5 12.5Z" />
      <path d="M12 5 15 8" />
    </svg>
  );
}

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

/** The pass's mark. A key, because it opens something rather than being it. */
export function KeyIcon({ className }: { className?: string }) {
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
      <circle cx="7" cy="13" r="3.5" />
      <path d="m9.6 10.6 6.4-6.4" />
      <path d="m13.5 6.7 1.8 1.8" />
    </svg>
  );
}

export function ShelfIcon({ className }: { className?: string }) {
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
      <rect x="2.5" y="3" width="15" height="5" rx="1" />
      <rect x="2.5" y="12" width="15" height="5" rx="1" />
      <path d="M5.5 8v4M14.5 8v4" />
    </svg>
  );
}
