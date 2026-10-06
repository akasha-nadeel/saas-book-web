"use client";

import { useState } from "react";
import type { ListedBook } from "@/lib/pricing/apple-list";
import {
  ASSUMED_MB,
  DELIVERY_PER_MB,
  EBOOK_35,
  EBOOK_70,
  ebookPay,
} from "@/lib/pricing/kdp-terms";
import { GROUP_LABEL, type PublisherGroup } from "@/lib/pricing/publishers";
import {
  CHART_CEILING,
  priceBins,
  standingBySide,
  type Standing,
} from "@/lib/pricing/shelf-facts";
import { PriceHistogram } from "./price-histogram";
import { money, parsePrice } from "./money";

/**
 * The prices the − and + step through: the ones a store actually shows.
 * Typing any other price works too; the ladder only saves the typing.
 */
const LADDER = [
  0.99, 1.99, 2.99, 3.99, 4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 10.99, 11.99,
  12.99, 13.99, 14.99, 19.99,
];

const cents = (n: number) => `${Math.round(n * 100)}¢`;

/** Self-published first: it is the side most writers here are pricing into. */
const SIDES: PublisherGroup[] = ["independent", "traditional", "amazon"];

/** "30 cost less, 8 the same, 3 more" — or that the side has no books at all. */
function compared(s: Standing): string {
  if (s.cheaper + s.same + s.dearer === 0) return "none on this list.";
  return `${s.cheaper} cost less, ${s.same} the same, ${s.dearer} more.`;
}

/**
 * Try a price: where it sits on the list, and what Amazon would pay for it.
 *
 * **It starts empty, on purpose.** Any number it opened on would read as the
 * number to charge — the self-published middle most of all — and this screen
 * never names one. The writer types or steps to a price of their own.
 *
 * **What it says is Amazon's arithmetic, shown working**: the rate, the
 * delivery charge and the assumption about file size are all on screen, so
 * the figure can be checked against KDP's own calculator.
 */
export function YourPrice({ books }: { books: readonly ListedBook[] }) {
  const [text, setText] = useState("");
  const price = parsePrice(text);

  function step(direction: 1 | -1) {
    const from = price ?? (direction === 1 ? 0 : Infinity);
    const next =
      direction === 1
        ? LADDER.find((p) => p > from + 0.001)
        : [...LADDER].reverse().find((p) => p < from - 0.001);
    if (next !== undefined) setText(next.toFixed(2));
  }

  const bins = priceBins(books);
  const where = price === null ? null : standingBySide(books, price);
  const pay = price === null ? null : ebookPay(price);
  const lowest = books.reduce((m, b) => Math.min(m, b.price), Infinity);
  const highest = books.reduce((m, b) => Math.max(m, b.price), 0);

  const description =
    `A chart of the ${books.length} books' prices, from ${money(lowest)} to ${money(highest)}, ` +
    `self-published above the line and traditional publishers below it, with Amazon's 70% band ` +
    `from ${money(EBOOK_70.min)} to ${money(EBOOK_70.max)} shaded` +
    (price === null ? "." : `, and your price of ${money(price)} marked.`);

  const stepper =
    "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface " +
    "text-xl font-semibold text-fg outline-none hover:bg-raised focus-visible:ring-2 " +
    "focus-visible:ring-accent/60";

  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <h2 className="text-lg font-bold text-fg">Try a price</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        See where it sits among these books, and what Amazon would pay you for
        each Kindle sale.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Lower price"
          onClick={() => step(-1)}
          className={stepper}
        >
          &minus;
        </button>
        <label className="flex h-11 items-center gap-1 rounded-[10px] bg-raised px-3 focus-within:ring-2 focus-within:ring-accent/50">
          <span className="text-lg text-muted">$</span>
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0.00"
            aria-label="Your ebook price, in US dollars"
            className="w-20 bg-transparent text-xl font-bold text-fg tabular-nums outline-none placeholder:text-muted/60"
          />
        </label>
        <button
          type="button"
          aria-label="Raise price"
          onClick={() => step(1)}
          className={stepper}
        >
          +
        </button>
      </div>

      <PriceHistogram
        bins={bins}
        price={price}
        ceiling={CHART_CEILING}
        description={description}
      />

      {price !== null && pay && where && (
        <div className="mt-5 grid gap-5 border-t border-line pt-5 @2xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              Amazon pays you
            </p>
            {pay.allowed ? (
              <>
                <p className="mt-1 text-4xl font-bold text-fg tabular-nums">
                  {money(pay.pay)}
                  <span className="text-base font-medium text-muted"> a sale</span>
                </p>
                <p className="mt-1 max-w-prose text-sm text-muted">
                  {pay.rate === EBOOK_70.rate
                    ? `70% of ${money(price)}, after a ${cents(pay.delivery)} delivery charge. Amazon charges ${cents(DELIVERY_PER_MB)} per MB of file; this assumes ${ASSUMED_MB} MB, which a novel without pictures usually stays under.`
                    : `35% of ${money(price)}. Amazon pays 70% only from ${money(EBOOK_70.min)} to ${money(EBOOK_70.max)}.`}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-fg">
                Amazon does not accept a Kindle price{" "}
                {price < EBOOK_35.min
                  ? `under ${money(EBOOK_35.min)}`
                  : `over ${money(EBOOK_35.max)}`}
                .
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              Among these books
            </p>
            {/* **Each side on its own line.** Compared with all hundred books,
                a $4.99 indie novel was being measured against $12.99 trade
                editions it is not competing with. */}
            <ul className="mt-1 space-y-1.5 text-sm text-fg">
              {SIDES.filter(
                (side) => side !== "amazon" || where.amazon.cheaper + where.amazon.same + where.amazon.dearer > 0,
              ).map((side) => (
                <li key={side}>
                  <span className="font-semibold">{GROUP_LABEL[side]}:</span>{" "}
                  <span className="tabular-nums">{compared(where[side])}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs text-muted">
        In Kindle Unlimited, Amazon also pays for each page read. The rate
        changes every month, and a book in it must be sold only on Amazon.
      </p>
    </section>
  );
}
