"use client";

import { useState } from "react";
import { BookCover } from "@/components/ui/book-cover";
import { Picker } from "@/components/ui/picker";
import { Segmented } from "@/components/ui/segmented";
import { ViewMenu } from "@/components/ui/view-menu";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { publisherGroup, type PublisherGroup } from "@/lib/pricing/publishers";
import { isGrid, resultsGridClass, type ShelfLayout } from "@/lib/shelf-layout";
import { money } from "./money";

type Which = "all" | PublisherGroup;
type Order = "list" | "price";

const ORDER = [
  { value: "list", label: "Best-selling first" },
  { value: "price", label: "Cheapest first" },
] as const;

const WHICH_LABEL: Record<Which, string> = {
  all: "All publishers",
  independent: "Self-published & small presses",
  traditional: "Traditional publishers",
  amazon: "Amazon’s own publishers",
};

const SIDE_TAG: Partial<Record<PublisherGroup, string>> = {
  traditional: "Traditional",
  amazon: "Amazon’s own",
};

/**
 * Every book on the list: the evidence under every figure above.
 *
 * **This is the table view of the chart and it is not optional.** A middle
 * price with no books under it asks to be trusted; with the books, it can be
 * checked — and each one opens on its own store page.
 *
 * **The publisher is printed on every row**, because the side a book is
 * counted on is decided by that name alone. A writer who disagrees with where
 * one landed can see why it landed there.
 *
 * **On Amazon's list each row says more**: whether the book is in Kindle
 * Unlimited, its place in a series and its length — and the list can be cut to
 * the Kindle Unlimited books alone.
 *
 * **The publisher filter is a picker, not segments.** With Amazon's own
 * imprints there are four choices, and four segments do not fit a phone.
 */
export function ShelfBooks({
  books,
  source,
  layout,
  onLayout,
}: {
  books: readonly ListedBook[];
  source: "apple" | "amazon";
  layout: ShelfLayout;
  onLayout: (next: ShelfLayout) => void;
}) {
  const [which, setWhich] = useState<Which>("all");
  const [order, setOrder] = useState<Order>("list");
  const [kuOnly, setKuOnly] = useState(false);

  const sides = new Set(books.map((b) => publisherGroup(b.publisher)));
  const choices: Which[] = ["all", "independent", "traditional", "amazon"].filter(
    (w) => w === "all" || sides.has(w as PublisherGroup),
  ) as Which[];
  const hasKu = books.some((b) => typeof b.kindleUnlimited === "boolean");

  const shown = books
    .filter((b) => which === "all" || publisherGroup(b.publisher) === which)
    .filter((b) => !kuOnly || b.kindleUnlimited === true)
    .slice()
    .sort((a, b) =>
      order === "price"
        ? a.price - b.price || a.position - b.position
        : a.position - b.position,
    );

  const store = source === "amazon" ? "Amazon’s" : "Apple’s";

  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-fg">The books</h2>
          <p className="mt-1 text-sm text-muted">
            {store} top {books.length}, in its own order. Open one to see its
            listing.
          </p>
        </div>
        <ViewMenu value={layout} onChange={onLayout} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Picker
          label="Which publishers"
          value={which}
          width={280}
          onChange={setWhich}
          triggerClassName="min-h-11 justify-between border border-line bg-surface px-3"
          options={choices.map((w) => ({ value: w, label: WHICH_LABEL[w] }))}
        />
        <Segmented
          label="Order"
          value={order}
          onChange={setOrder}
          options={ORDER}
          className="w-full @lg:w-auto @lg:min-w-[17rem]"
        />
        {hasKu && (
          <button
            type="button"
            role="switch"
            aria-checked={kuOnly}
            onClick={() => setKuOnly(!kuOnly)}
            className={`min-h-11 rounded-[10px] border px-3 text-[13px] font-semibold outline-none
                        focus-visible:ring-2 focus-visible:ring-accent/60 ${
                          kuOnly
                            ? "border-accent bg-accent/10 text-fg"
                            : "border-line bg-surface text-muted hover:text-fg"
                        }`}
          >
            Kindle Unlimited only
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No book on this list matches{kuOnly ? " in Kindle Unlimited" : ""}
          {which === "all" ? "." : ` from ${WHICH_LABEL[which].toLowerCase()}.`}
        </p>
      ) : isGrid(layout) ? (
        <ul className={`mt-4 ${resultsGridClass(layout)}`}>
          {shown.map((book) => (
            <li key={book.id} className="min-w-0">
              <a
                href={book.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <BookCover src={book.cover ?? undefined} className="rounded-sm!" />
                <span className="mt-2 block truncate text-sm font-medium text-fg">
                  {book.title}
                </span>
              </a>
              <span className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-muted">
                  {book.kindleUnlimited ? "Kindle Unlimited · " : ""}
                  {book.author}
                </span>
                <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">
                  {money(book.price)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {shown.map((book) => {
            const tag = SIDE_TAG[publisherGroup(book.publisher)];
            const extras = [
              book.series ? `Book ${book.series.number} of ${book.series.of}` : null,
              book.pages ? `${book.pages} pages` : null,
            ].filter(Boolean);
            return (
              <li key={book.id} className="flex items-center gap-3 py-2.5">
                <span className="w-7 shrink-0 text-right text-xs text-muted tabular-nums">
                  {book.position}
                </span>
                <span className="w-8 shrink-0">
                  <BookCover src={book.cover ?? undefined} className="rounded-sm!" />
                </span>
                <span className="min-w-0 flex-1">
                  {book.url ? (
                    <a
                      href={book.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {book.title}
                    </a>
                  ) : (
                    <span className="text-fg">{book.title}</span>
                  )}
                  <span className="block truncate text-sm text-muted">
                    {book.author}
                    {book.publisher ? ` · ${book.publisher}` : ""}
                    {book.released ? ` · ${book.released.slice(0, 4)}` : ""}
                    {tag ? ` · ${tag}` : ""}
                  </span>
                  {(book.kindleUnlimited || extras.length > 0) && (
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {book.kindleUnlimited && (
                        <span className="rounded-md border border-line px-1.5 py-0.5 font-semibold text-fg">
                          Kindle Unlimited
                        </span>
                      )}
                      {extras.join(" · ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-fg tabular-nums">
                  {money(book.price)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
