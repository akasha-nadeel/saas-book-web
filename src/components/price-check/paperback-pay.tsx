"use client";

import { useState } from "react";
import { Picker } from "@/components/ui/picker";
import { bookWordCount, type Book } from "@/lib/library-store";
import { PRINT, paperbackLowest, paperbackPay, printCost } from "@/lib/pricing/kdp-terms";
import { estimatePages } from "@/lib/paperback";
import { money, parsePrice } from "./money";

/**
 * What Amazon would pay on a printed copy.
 *
 * **Amazon's published print rules and nothing else**: printing is taken off
 * first, then 50% or 60% of the price depending on which side of $9.99 it
 * sits. The figure needs the page count, which the writer types or fills from
 * one of their own books — estimated from its word count, and the screen says
 * it is an estimate.
 *
 * It names the lowest price Amazon will accept at that length, because that is
 * a rule rather than advice: below it, KDP refuses the listing.
 */
export function PaperbackPay({
  books,
  initialPages,
}: {
  books: readonly Book[];
  initialPages: number | null;
}) {
  const [pagesText, setPagesText] = useState(
    initialPages ? String(initialPages) : "",
  );
  const [priceText, setPriceText] = useState("");
  const [from, setFrom] = useState<{ title: string; words: number } | null>(null);

  const pages = Number.parseInt(pagesText, 10);
  const price = parsePrice(priceText);
  const printing = Number.isFinite(pages) ? printCost(pages) : null;
  const pay = printing !== null && price !== null ? paperbackPay(price, pages) : null;

  const field =
    "h-11 rounded-[10px] bg-raised px-3 text-fg tabular-nums outline-none " +
    "focus-visible:ring-2 focus-visible:ring-accent/50";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg">Pages</span>
          <input
            inputMode="numeric"
            value={pagesText}
            onChange={(e) => {
              setPagesText(e.target.value);
              setFrom(null);
            }}
            placeholder="300"
            aria-label="Pages in the paperback"
            className={`${field} w-28`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg">Paperback price</span>
          <span className={`${field} flex w-32 items-center gap-1`}>
            <span className="text-muted">$</span>
            <input
              inputMode="decimal"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="0.00"
              aria-label="Paperback price, in US dollars"
              className="w-full bg-transparent outline-none placeholder:text-muted/60"
            />
          </span>
        </label>

        {books.length > 0 && (
          <Picker
            label="Use one of your books' length"
            value=""
            width={260}
            onChange={(id) => {
              const book = books.find((b) => b.id === id);
              if (!book) return;
              const words = bookWordCount(book);
              const estimate = estimatePages(words);
              setPagesText(estimate ? String(estimate) : "");
              setFrom({ title: book.title, words });
            }}
            triggerClassName="h-11 border border-line bg-surface px-3"
            options={[
              { value: "", label: "Use my book’s length…" },
              ...books.map((b) => ({ value: b.id, label: b.title })),
            ]}
          />
        )}
      </div>

      {from && (
        <p className="mt-2 text-xs text-muted">
          Estimated from {from.title}&rsquo;s {from.words.toLocaleString()} words at
          275 a page. The real count depends on the trim size and the type.
        </p>
      )}

      <div className="mt-4 space-y-2 text-sm">
        {pagesText.trim() !== "" && printing === null && (
          <p className="text-fg">
            Amazon prints black-ink paperbacks from {PRINT.minPages} to{" "}
            {PRINT.maxPages} pages.
          </p>
        )}

        {printing !== null && (
          <>
            <p className="text-fg">
              Printing costs{" "}
              <span className="font-semibold tabular-nums">{money(printing)}</span> a
              copy. The lowest price Amazon accepts at this length is{" "}
              <span className="font-semibold tabular-nums">
                {money(paperbackLowest(printing))}
              </span>
              .
            </p>
            {pay && price !== null && (
              pay.pay >= 0 ? (
                <p className="text-fg">
                  At {money(price)} Amazon pays {Math.round(pay.rate * 100)}% of the
                  price, minus printing: you would get{" "}
                  <span className="text-lg font-bold tabular-nums">{money(pay.pay)}</span>{" "}
                  a sale.
                </p>
              ) : (
                <p className="text-fg">
                  Amazon would refuse {money(price)}: printing costs more than it
                  would pay you.
                </p>
              )
            )}
          </>
        )}

        <p className="text-xs text-muted">
          Black ink, sold on Amazon.com. Amazon pays 50% of a price up to $9.98
          and 60% from $9.99, minus printing.
        </p>
      </div>
    </div>
  );
}
