"use client";

import {
  aboveCeiling,
  axisCeiling,
  type PriceLook,
  type PricedBook,
} from "@/lib/comps/price-check";

/**
 * Every comparable price on one line, with the median marked.
 *
 * **Mounted by nothing since 2026-09-26, and that is a decision rather than an
 * oversight.** It was on the screen for a few hours the day the price check
 * shipped and the owner took it out after using it. Two reasons, and both have
 * to be answered before it goes back:
 *
 * - **Its caption repeated the headline.** The figure above it already said
 *   "$6.49 is the median of 11 prices, from 12 of 56 books that carried one",
 *   and the caption then said "Median $6.49, from 11 prices". The one fact the
 *   caption held that the headline did not — the middle-half range — has moved
 *   into that sentence, so nothing true was lost with the chart.
 * - **The screen reads as one figure and its evidence without it.** A median,
 *   a spread, and the list of books each price came from. The chart sat
 *   between the two halves of that.
 *
 * Kept whole rather than deleted because it works and because the argument for
 * it is still good on its own terms: a genre's prices cluster in two places
 * and a chart is the only way to *see* that. `axisCeiling` and `aboveCeiling`
 * in `comps/price-check.ts` are its arithmetic and are kept with it, tested.
 * See `TODO.md` under "Taken out on purpose".
 *
 * **A strip of dots rather than a bar chart or a box plot**, and the data is
 * why. A genre's prices are usually two clusters — an indie one near five
 * dollars and a trade-published one near twelve — with nothing in between. A
 * bar per book sorts that into a staircase and hides the gap; a box plot draws
 * the gap as the middle of the box, which is the one place no book sits. Dots
 * on a price axis put each book where its price actually is, so the shape of
 * the shelf is the shape on the screen.
 *
 * **One hue and a grey, not a palette.** There is a single series here — the
 * books — so identity is carried by position and the accent is spent on the
 * one thing that is not a book: the median. Nothing needs a legend, because
 * the heading above says what the dots are.
 *
 * **Dots that share a price stack upwards.** Five books at $4.99 drawn on top
 * of each other are one dot, and the cluster that matters most is exactly the
 * one that would vanish.
 *
 * **The axis stops above the bulk and says what is past it.** See
 * `axisCeiling`: a $119 criminology textbook scaled the whole axis to itself
 * and squeezed every novel into the first eighth of it.
 */

/** Design width. The SVG scales; everything inside is in these units. */
const W = 1000;
/**
 * Side inset, so the first and last axis labels are not cut in half.
 *
 * A tick's label is centred on the tick, and the last tick is the ceiling — so
 * with the plot running the full width, "$20" lost its right half off the edge
 * of the viewBox.
 */
const PAD = 26;
/** Room for the axis labels under the plot. */
const AXIS_H = 26;
/** Dot radius, and the gap between stacked rows. About 9px as rendered. */
const R = 5;
const ROW = 13;
/** The plot never draws shorter than this, so a thin result is not a sliver. */
const MIN_ROWS = 4;

/** Books grouped by price, cheapest first, each group a stack. */
function stacks(prices: PricedBook[], ceiling: number) {
  const byAmount = new Map<number, PricedBook[]>();
  for (const p of prices) {
    // Everything past the ceiling piles onto the ceiling itself, which is
    // where it is drawn — counted in the line under the plot, never dropped.
    const at = Math.min(p.amount, ceiling);
    const group = byAmount.get(at);
    if (group) group.push(p);
    else byAmount.set(at, [p]);
  }
  return [...byAmount.entries()].sort((a, b) => a[0] - b[0]);
}

const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

export function PriceStrip({ look }: { look: PriceLook }) {
  if (!look.summary) return null;

  const ceiling = axisCeiling(look.summary);
  const over = aboveCeiling(look.prices, ceiling);
  const grouped = stacks(look.prices, ceiling);
  const tallest = Math.max(MIN_ROWS, ...grouped.map(([, g]) => g.length));

  const plotH = tallest * ROW + R * 2;
  const height = plotH + AXIS_H;
  const x = (amount: number) => PAD + (amount / ceiling) * (W - PAD * 2);
  const baseline = plotH;

  /* Every five dollars, plus zero. A tick per dollar is a ruler nobody reads. */
  const ticks: number[] = [];
  for (let t = 0; t <= ceiling; t += 5) ticks.push(t);

  const medianX = x(look.summary.median);

  return (
    <figure className="mt-5">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${look.summary.from} prices from ${money(look.summary.low)} to ${money(
          look.summary.high,
        )}, median ${money(look.summary.median)}. Every book is listed in the table below.`}
      >
        {/* Axis */}
        <line
          x1={PAD}
          y1={baseline}
          x2={W - PAD}
          y2={baseline}
          className="stroke-line"
          strokeWidth={2}
        />
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={baseline}
              x2={x(t)}
              y2={baseline + 5}
              className="stroke-line"
              strokeWidth={2}
            />
            <text
              x={x(t)}
              y={baseline + 20}
              textAnchor="middle"
              className="fill-muted text-[13px]"
            >
              {t === ceiling && over > 0 ? `${money(t)}+` : money(t)}
            </text>
          </g>
        ))}

        {/* **The middle half sits on the axis, not behind the dots.** It was a
            full-height wash to begin with and read as a bar — a tall block
            with crisp edges standing among the dots looks like a mark of its
            own rather than like context. On the axis it is plainly a span. */}
        <rect
          x={x(look.summary.middleLow)}
          y={baseline - 3}
          width={Math.max(
            2,
            x(Math.min(look.summary.middleHigh, ceiling)) -
              x(look.summary.middleLow),
          )}
          height={6}
          rx={3}
          className="fill-accent/35"
        />

        {/* The median, the one thing here that is not a book. */}
        <line
          x1={medianX}
          y1={0}
          x2={medianX}
          y2={baseline + 3}
          className="stroke-accent"
          strokeWidth={2}
        />

        {/* The books. */}
        {grouped.map(([amount, group]) =>
          group.map((p, i) => (
            <circle
              key={p.book.key + i}
              cx={x(amount)}
              cy={baseline - R - i * ROW}
              r={R}
              /* The ring is the page's own ground, so two dots touching stay
                 two dots. */
              className={
                amount === 0
                  ? "fill-muted/50 stroke-panel"
                  : "fill-muted stroke-panel"
              }
              strokeWidth={2}
            >
              <title>
                {p.book.title}
                {p.book.authors[0] ? ` — ${p.book.authors[0]}` : ""}
                {p.book.year ? ` (${p.book.year})` : ""}: {money(p.amount)}
              </title>
            </circle>
          )),
        )}
      </svg>

      <figcaption className="mt-2 text-sm text-muted">
        Median {money(look.summary.median)}, from{" "}
        {look.summary.from} {look.summary.from === 1 ? "price" : "prices"}. Half
        sit between {money(look.summary.middleLow)} and{" "}
        {money(look.summary.middleHigh)}.
        {over > 0 && (
          <>
            {" "}
            {over === 1 ? "One book is" : `${over} books are`} above{" "}
            {money(ceiling)} and {over === 1 ? "is" : "are"} drawn on the edge.
          </>
        )}
      </figcaption>
    </figure>
  );
}
