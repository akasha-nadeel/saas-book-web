"use client";

import { useState } from "react";
import { BookCover } from "@/components/ui/book-cover";
import { Segmented } from "@/components/ui/segmented";
import { ViewMenu } from "@/components/ui/view-menu";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { publisherGroup, type PublisherGroup } from "@/lib/pricing/publishers";
import { isGrid, resultsGridClass, type ShelfLayout } from "@/lib/shelf-layout";
import { money } from "./money";

type Which = "all" | PublisherGroup;
type Order = "list" | "price";

const WHICH = [
  { value: "all", label: "All" },
  /* "Indie" rather than "Self-published": three equal segments on a phone
     leave each about 90px, and the long word was cut to "Self-publi…". */
  { value: "independent", label: "Indie" },
  { value: "traditional", label: "Traditional" },
] as const;

const ORDER = [
  { value: "list", label: "Best-selling first" },
  { value: "price", label: "Cheapest first" },
] as const;

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
 */
export function ShelfBooks({
  books,
  layout,
  onLayout,
}: {
  books: readonly ListedBook[];
  layout: ShelfLayout;
  onLayout: (next: ShelfLayout) => void;
}) {
  const [which, setWhich] = useState<Which>("all");
  const [order, setOrder] = useState<Order>("list");

  const shown = books
    .filter((b) => which === "all" || publisherGroup(b.publisher) === which)
    .slice()
    .sort((a, b) =>
      order === "price"
        ? a.price - b.price || a.position - b.position
        : a.position - b.position,
    );

  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-fg">The books</h2>
          <p className="mt-1 text-sm text-muted">
            Apple&rsquo;s top {books.length}, in its own order. Open one to see
            its listing.
          </p>
        </div>
        <ViewMenu value={layout} onChange={onLayout} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Segmented
          label="Which publishers"
          value={which}
          onChange={setWhich}
          options={WHICH}
          className="w-full @lg:w-auto @lg:min-w-[22rem]"
        />
        <Segmented
          label="Order"
          value={order}
          onChange={setOrder}
          options={ORDER}
          className="w-full @lg:w-auto @lg:min-w-[17rem]"
        />
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          None of these books are from{" "}
          {which === "traditional"
            ? "a traditional publisher"
            : "a self-published writer or a small press"}
          .
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
                <span className="truncate text-xs text-muted">{book.author}</span>
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
            const traditional = publisherGroup(book.publisher) === "traditional";
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
                    {traditional ? " · Traditional" : ""}
                  </span>
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
