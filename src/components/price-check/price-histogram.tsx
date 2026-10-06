"use client";

import { useState } from "react";
import { EBOOK_70 } from "@/lib/pricing/kdp-terms";
import type { PriceBin } from "@/lib/pricing/shelf-facts";

/**
 * Every book on the list, by price, with the two kinds of publisher on either
 * side of one line.
 *
 * **Position does the separating, not colour.** Self-published books stand
 * above the line and traditional ones hang below it. So the two clusters a
 * genre usually has can be told apart without telling hues apart — in either
 * theme, for any eye — and the chart needs no palette outside the app's own
 * tokens.
 *
 * Amazon's 70% band sits behind the bars and the writer's price is a line
 * through both halves: one picture of the three things the screen is about.
 * The book list below it is the table view of the same data, so nothing here
 * is only available to someone who can see the chart.
 */

const W = 600;
const HALF = 64;
const H = HALF * 2 + 2;

const binLabel = (bin: PriceBin, ceiling: number) =>
  bin.from >= ceiling
    ? `$${ceiling} and over`
    : `$${bin.from}–$${bin.from}.99`;

export function PriceHistogram({
  bins,
  price,
  ceiling,
  description,
}: {
  bins: PriceBin[];
  price: number | null;
  ceiling: number;
  /** What the chart shows, in words, for a screen reader. */
  description: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(
    1,
    ...bins.map((b) => Math.max(b.independent, b.traditional)),
  );
  const slot = W / bins.length;
  const x = (dollars: number) =>
    (Math.min(dollars, ceiling + 1) / (ceiling + 1)) * W;
  const pct = (dollars: number) => (x(dollars) / W) * 100;
  const shown = hover === null ? null : bins[hover];

  return (
    <figure className="mt-5">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-36 w-full"
          role="img"
          aria-label={description}
        >
          <rect
            x={x(EBOOK_70.min)}
            y={0}
            width={x(EBOOK_70.max) - x(EBOOK_70.min)}
            height={H}
            className="fill-raised"
          />
          {bins.map((bin, i) => {
            const up = (bin.independent / peak) * HALF;
            const down = (bin.traditional / peak) * HALF;
            return (
              <g
                key={bin.from}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                // A tap on a phone, where there is no hover.
                onClick={() => setHover(hover === i ? null : i)}
              >
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                />
                {up > 0 && (
                  <rect
                    x={i * slot + 1}
                    y={HALF - up}
                    width={slot - 2}
                    height={up}
                    rx={1.5}
                    className="fill-fg"
                  />
                )}
                {down > 0 && (
                  <rect
                    x={i * slot + 1}
                    y={HALF + 2}
                    width={slot - 2}
                    height={down}
                    rx={1.5}
                    className="fill-muted"
                    opacity={0.6}
                  />
                )}
              </g>
            );
          })}
          <line
            x1={0}
            x2={W}
            y1={HALF + 1}
            y2={HALF + 1}
            className="stroke-line"
            vectorEffect="non-scaling-stroke"
          />
          {price !== null && (
            <line
              x1={x(price)}
              x2={x(price)}
              y1={0}
              y2={H}
              className="stroke-accent"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

      </div>

      <div
        className="relative mt-1 h-4 text-[11px] text-muted tabular-nums"
        aria-hidden="true"
      >
        {[0, 5, 10, 15].map((tick) => (
          <span
            key={tick}
            className={`absolute ${tick === 0 ? "" : "-translate-x-1/2"}`}
            style={{ left: `${pct(tick)}%` }}
          >
            ${tick}
          </span>
        ))}
        <span className="absolute right-0">${ceiling}+</span>
      </div>

      {/* **A readout line, not a floating tooltip.** A tooltip pinned over a
          bar near either edge ran off a phone's screen, and a phone has no
          hover to summon it anyway — so the answer to "which bar is this"
          has a fixed place under the axis, reached by pointing or tapping. */}
      <p
        role="status"
        className="mt-2 min-h-5 text-xs text-muted tabular-nums"
      >
        {shown ? (
          <>
            <span className="font-semibold text-fg">{binLabel(shown, ceiling)}</span>
            {": "}
            {shown.independent} self-published, {shown.traditional} traditional
          </>
        ) : (
          "Point at a bar, or tap it, to see how many books sit at that price."
        )}
      </p>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-fg" />
          Self-published &amp; small presses, above the line
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted/60" />
          Traditional publishers, below it
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-line bg-raised" />
          Where Amazon pays 70%
        </span>
        {price !== null && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-accent" />
            Your price
          </span>
        )}
      </figcaption>
    </figure>
  );
}
