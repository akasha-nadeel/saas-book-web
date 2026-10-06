"use client";

import { useRef, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { Picker } from "@/components/ui/picker";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, setPref, bookWordCount } from "@/lib/library-store";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { remember, recall } from "@/lib/comps/search-memory";
import { toolShell, type ToolPageProps, toolMeasure } from "@/lib/tool-page";
import { noteActivity } from "@/lib/activity-log";
import type { ListedBook } from "@/lib/pricing/apple-list";
import {
  BESTSELLER_SHELVES,
  amazonLink,
  shelfById,
  shelfForBookGenre,
} from "@/lib/pricing/shelves";
import { shelfFacts } from "@/lib/pricing/shelf-facts";
import { estimatePages } from "@/lib/paperback";
import { GenreTiles } from "./genre-tiles";
import { ShelfAnswer } from "./shelf-answer";
import { YourPrice } from "./your-price";
import { ShelfBooks } from "./shelf-books";
import { Disclosure } from "./disclosure";
import { PaperbackPay } from "./paperback-pay";

/**
 * What the best sellers in a genre charge, and what Amazon would pay the
 * writer at any price they try.
 *
 * **The list is Apple Books' top 100 per genre, US store** — free, public, and
 * a real best-seller list in which every book carries a price, where the
 * Google keyword search this screen used to run often found a handful. The
 * books arrive through `/api/price-shelf` as `ListedBook`s; Amazon's lists,
 * when there is money for them, arrive in the same shape and nothing here
 * changes. The decision and its measurements are in
 * `docs/plans/2026-10-05-price-check-amazon-design.md`.
 *
 * **The screen reports and does not advise.** No recommended price, and the
 * price field starts empty so that no number on it can read as one. Every
 * figure carries the count it came from; every figure about pay is Amazon's
 * published arithmetic, shown working.
 *
 * **One page, answer first.** The genre, then the two middle prices, then the
 * price the writer tries, then the books — and the answers only some writers
 * want (paperback, and what this list cannot say) behind two cards that open.
 */

type State = "idle" | "loading" | "done" | "error";

interface ShelfList {
  shelf: string;
  updated: string | null;
  books: ListedBook[];
}

/** This tool's slots in the tab's memory. See `search-memory.ts`. */
const MEMORY = "price-check";
/**
 * The genres opened in this tab. Opening one again spends nothing: the writer
 * is looking back at an answer they already paid for, not asking a new
 * question.
 */
const OPENED = "price-check:opened";

const dateOf = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

export function PriceCheckPage({
  bookId,
  embedded,
  heading,
}: Omit<ToolPageProps, "bookId"> & { bookId?: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = bookId ? findBook(shelf, bookId) : null;
  const myBooks = shelf.books.filter((b) => !b.trashedAt);

  /* Read once, into the lazy initialisers below: the dashboard throws this
     component away on an area switch, and a writer who glanced at their shelf
     should come back to the answer rather than to the tiles. */
  const [kept] = useState(() => recall<ShelfList>(MEMORY));
  const [list, setList] = useState<ShelfList | null>(kept);
  const [shelfId, setShelfId] = useState<string | null>(() => kept?.shelf ?? null);
  const [state, setState] = useState<State>(() => (kept ? "done" : "idle"));
  const [error, setError] = useState<string | null>(null);
  /** Guards against a slow answer for one genre landing after a newer one. */
  const ticket = useRef(0);

  const layout = usePrefs().priceCheckLayout;
  const gate = useLimitGate({ action: "priceCheck" });
  const suggested = shelfForBookGenre(book?.genre)?.id ?? null;

  async function open(id: string) {
    if (!shelfById(id)) return;
    const opened = recall<string[]>(OPENED) ?? [];
    if (!opened.includes(id)) {
      // Refused rather than disabled: the refused press is what puts the
      // banner and the dialog on screen.
      if (!gate.spend()) return;
      noteActivity("price_check_run");
      remember<string[]>(OPENED, [...opened, id]);
    }

    const mine = ++ticket.current;
    setShelfId(id);
    setState("loading");
    setError(null);

    try {
      const response = await fetch(
        `/api/price-shelf?shelf=${encodeURIComponent(id)}`,
      );
      const data = await response.json().catch(() => null);
      if (mine !== ticket.current) return;

      if (!response.ok || !data || !Array.isArray(data.books)) {
        setError(data?.error ?? "That list did not load. Try again in a moment.");
        setState("error");
        return;
      }

      const next: ShelfList = {
        shelf: id,
        updated: typeof data.updated === "string" ? data.updated : null,
        books: data.books as ListedBook[],
      };
      setList(next);
      setState("done");
      remember<ShelfList>(MEMORY, next);
    } catch {
      if (mine !== ticket.current) return;
      setError("Could not reach the list. Check your connection.");
      setState("error");
    }
  }

  if (!hydrated) {
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;
  }

  const chosen = shelfId ? shelfById(shelfId) : null;
  const showing = list && list.shelf === shelfId && state === "done" ? list : null;
  const facts = showing ? shelfFacts(showing.books) : null;
  const pages = book ? estimatePages(bookWordCount(book)) : 0;

  const premise =
    "The top 100 best-selling ebooks in your genre and what they cost, self-published and traditional publishers kept apart, and what Amazon would pay you at any price you try. We never tell you what to charge.";

  return (
    <div className={toolShell(embedded)}>
      {!embedded && book && (
        <ToolHeader
          book={book}
          tool="Price check"
          title="What do books like yours sell for?"
          width="7xl"
        >
          {premise}
        </ToolHeader>
      )}

      <div
        className={`@container ${toolMeasure(embedded)} pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6`}
      >
        {embedded && (
          <p className="-mt-2 mb-2 max-w-2xl text-sm text-muted">{premise}</p>
        )}

        {heading && (
          <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
            {heading}
          </div>
        )}

        {!chosen ? (
          <GenreTiles suggested={suggested} onOpen={(id) => void open(id)}>
            <LeftPill allowance={gate.allowance} className="mt-4" />
            <LimitBanner
              allowance={gate.allowance}
              refused={gate.refused}
              className="mt-4"
            />
          </GenreTiles>
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-fg">
                    {chosen.label}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Apple Books, US store &middot; top 100 best-selling ebooks
                    {showing && dateOf(showing.updated)
                      ? ` · ${dateOf(showing.updated)}`
                      : ""}
                  </p>
                </div>
                {/* `Picker`, not a native select: a focused select changes on
                    a mouse wheel in Chrome, which re-picked the genre when the
                    dashboard scrolled past it. See `ui/picker.tsx`. */}
                <Picker
                  label="Genre"
                  value={chosen.id}
                  width={240}
                  onChange={(id) => {
                    if (id !== chosen.id) void open(id);
                  }}
                  triggerClassName="justify-between border border-line bg-surface px-3 py-2"
                  options={BESTSELLER_SHELVES.map((s) => ({
                    value: s.id,
                    label: s.label,
                  }))}
                />
              </div>

              <LeftPill allowance={gate.allowance} className="mt-3" />
              <LimitBanner
                allowance={gate.allowance}
                refused={gate.refused}
                className="mt-4"
              />

              {state === "loading" && (
                <div className="mt-5 grid animate-pulse gap-3 @2xl:grid-cols-2" aria-busy="true">
                  <div className="h-32 rounded-xl bg-raised" />
                  <div className="h-32 rounded-xl bg-raised" />
                </div>
              )}

              {state === "error" && error && (
                <p className="mt-5 rounded-lg border border-line p-4 text-sm text-muted">
                  {error}
                </p>
              )}

              {facts && (
                <ShelfAnswer facts={facts} amazon={amazonLink(chosen)} />
              )}
            </section>

            {showing && (
              <>
                <YourPrice key={showing.shelf} books={showing.books} />
                <ShelfBooks
                  key={`books-${showing.shelf}`}
                  books={showing.books}
                  layout={layout}
                  onLayout={(next) => setPref("priceCheckLayout", next)}
                />
                <Disclosure
                  title="Paperback"
                  summary="What Amazon would pay you on a printed copy, and the lowest price it accepts."
                >
                  <PaperbackPay books={myBooks} initialPages={pages || null} />
                </Disclosure>
                <Disclosure
                  title="What this list can't tell you"
                  summary="Kindle Unlimited, series, length and paperback prices."
                >
                  <p className="max-w-prose text-sm text-fg">
                    Apple&rsquo;s list doesn&rsquo;t say which of these books are
                    part of a series, how long they are, or what their paperbacks
                    cost, so this check can&rsquo;t either. And no book in Kindle
                    Unlimited can be on it: those are sold only on Amazon.
                  </p>
                  <p className="mt-3 max-w-prose text-sm text-muted">
                    The two sides are sorted by the publisher&rsquo;s name. A
                    small press can land with the self-published, which is the
                    side of the trade it prices like.
                  </p>
                </Disclosure>
              </>
            )}
          </>
        )}
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="priceCheck" onClose={gate.closeDialog} />
      )}
    </div>
  );
}
