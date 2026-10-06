"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { Picker } from "@/components/ui/picker";
import { UpgradeDialog } from "@/components/upgrade/upgrade-dialog";
import { findBook, setPref, bookWordCount } from "@/lib/library-store";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";
import { onFreePlan } from "@/lib/launch";
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
import { AmazonExtras } from "./amazon-extras";
import { StoreSwitch, type Store } from "./store-switch";

/**
 * What the best sellers in a genre charge, and what Amazon would pay the
 * writer at any price they try.
 *
 * **Two lists, since 2026-10-06.**
 * - **Apple Books' top 100** (`/api/price-shelf`) is free, public and
 *   unlimited on every plan.
 * - **Amazon's own top 100** (`/api/price-shelf/amazon`) is Pro. It carries
 *   what writers asked for most — real Amazon prices and how many books are in
 *   Kindle Unlimited — and every request for it is paid for, so the server
 *   checks the plan itself.
 * - A Pro writer lands on Amazon; a free writer lands on Apple and meets
 *   Amazon as a locked tab that opens the offer. Both arrive as the same
 *   `ListedBook`, so every card below draws either. The decision and its
 *   measurements are in `docs/plans/2026-10-05-price-check-amazon-design.md`.
 *
 * **The screen reports and does not advise.** No recommended price, and the
 * price field starts empty so that no number on it can read as one. Every
 * figure carries the count it came from; every figure about pay is Amazon's
 * published arithmetic, shown working.
 *
 * **While the plan is unknown, nothing is fetched.** Which list to show
 * depends on it, and guessing would flash Apple's list at a writer paying for
 * Amazon's — the "waiting is the only state that flashes nothing" rule.
 */

interface ShelfList {
  shelf: string;
  updated: string | null;
  books: ListedBook[];
}

type Result = { list: ShelfList } | { error: string };

/** This tool's slots in the tab's memory. See `search-memory.ts`. */
const MEMORY_SHELF = "price-check:shelf";
const MEMORY_RESULTS = "price-check:results";

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

async function fetchList(shelf: string, store: Store): Promise<Result> {
  const path = store === "amazon" ? "/api/price-shelf/amazon" : "/api/price-shelf";
  try {
    const response = await fetch(`${path}?shelf=${encodeURIComponent(shelf)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !Array.isArray(data.books)) {
      return { error: data?.error ?? "That list did not load. Try again in a moment." };
    }
    return {
      list: {
        shelf,
        updated: typeof data.updated === "string" ? data.updated : null,
        books: data.books as ListedBook[],
      },
    };
  } catch {
    return { error: "Could not reach the list. Check your connection." };
  }
}

export function PriceCheckPage({
  bookId,
  embedded,
  heading,
}: Omit<ToolPageProps, "bookId"> & { bookId?: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = bookId ? findBook(shelf, bookId) : null;
  const myBooks = shelf.books.filter((b) => !b.trashedAt);
  const plan = usePlan();
  const free = onFreePlan(plan);

  /* Read once, into the lazy initialisers: the dashboard throws this component
     away on an area switch, and a writer who glanced at their shelf should come
     back to the answer rather than to the tiles. */
  const [shelfId, setShelfId] = useState<string | null>(() => recall<string>(MEMORY_SHELF) ?? null);
  const [results, setResults] = useState<Record<string, Result>>(
    () => recall<Record<string, Result>>(MEMORY_RESULTS) ?? {},
  );
  /** The writer's own choice of list. Unset means "the plan's default". */
  const [picked, setPicked] = useState<Store | null>(null);
  const [upsell, setUpsell] = useState(false);
  const inFlight = useRef(new Set<string>());

  const layout = usePrefs().priceCheckLayout;
  const suggested = shelfForBookGenre(book?.genre)?.id ?? null;

  /* Pro, or no plans configured at all, lands on Amazon; the free plan on
     Apple. Unknown is null, and nothing is fetched until it is known. */
  const store: Store | null = free ? "apple" : picked ?? (plan.loading ? null : "amazon");
  const key = shelfId && store ? `${store}:${shelfId}` : null;
  const result = key ? results[key] : undefined;

  /* Fetching is keyed on the genre *and* the list, and the state is only set
     when an answer arrives, so the loading state is derived rather than
     stored: no answer yet for this key means it is on its way. */
  useEffect(() => {
    if (!key || !shelfId || !store || results[key] || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    void fetchList(shelfId, store).then((answer) => {
      inFlight.current.delete(key);
      setResults((prev) => {
        const next = { ...prev, [key]: answer };
        // Kept only when it worked: a failure should be asked again next time.
        if ("list" in answer) remember(MEMORY_RESULTS, next);
        return next;
      });
    });
  }, [key, shelfId, store, results]);

  function open(id: string) {
    if (!shelfById(id)) return;
    noteActivity("price_check_run");
    setShelfId(id);
    remember(MEMORY_SHELF, id);
  }

  function retry() {
    if (!key) return;
    setResults((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  if (!hydrated) {
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;
  }

  const chosen = shelfId ? shelfById(shelfId) : null;
  const showing = result && "list" in result ? result.list : null;
  const failed = result && "error" in result ? result.error : null;
  const facts = showing ? shelfFacts(showing.books) : null;
  const pages = book ? estimatePages(bookWordCount(book)) : 0;
  const onAmazon = store === "amazon";

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
          <GenreTiles suggested={suggested} onOpen={open} />
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-fg">
                    {chosen.label}
                  </h2>
                  {store && (
                    <p className="mt-0.5 text-sm text-muted">
                      {onAmazon
                        ? "Amazon.com Kindle Store · top 100 best sellers"
                        : "Apple Books, US store · top 100 best-selling ebooks"}
                      {showing && dateOf(showing.updated)
                        ? ` · ${dateOf(showing.updated)}`
                        : ""}
                    </p>
                  )}
                </div>
                {/* `Picker`, not a native select: a focused select changes on
                    a mouse wheel in Chrome, which re-picked the genre when the
                    dashboard scrolled past it. See `ui/picker.tsx`. */}
                <Picker
                  label="Genre"
                  value={chosen.id}
                  width={240}
                  onChange={(id) => {
                    if (id !== chosen.id) open(id);
                  }}
                  triggerClassName="justify-between border border-line bg-surface px-3 py-2"
                  options={BESTSELLER_SHELVES.map((s) => ({
                    value: s.id,
                    label: s.label,
                  }))}
                />
              </div>

              {store && (
                <div className="mt-4">
                  <StoreSwitch
                    value={store}
                    locked={free}
                    onChange={setPicked}
                    onLocked={() => {
                      noteActivity("limit_hit", { detail: "priceCheck" });
                      setUpsell(true);
                    }}
                  />
                </div>
              )}

              {!showing && !failed && (
                /* The first Pro writer to open a genre in a week waits while
                   its books are looked up, so the wait is said rather than
                   left to look like a hang. */
                <div className="mt-5" aria-busy="true">
                  <div className="grid animate-pulse gap-3 @2xl:grid-cols-2">
                    <div className="h-32 rounded-xl bg-raised" />
                    <div className="h-32 rounded-xl bg-raised" />
                  </div>
                  {onAmazon && (
                    <p className="mt-3 text-sm text-muted">
                      Fetching Amazon&rsquo;s list. The first time a genre is
                      opened each week this can take up to half a minute.
                    </p>
                  )}
                </div>
              )}

              {failed && (
                <div className="mt-5 rounded-lg border border-line p-4 text-sm text-muted">
                  <p>{failed}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                  >
                    Try again
                  </button>
                </div>
              )}

              {facts && showing && (
                <ShelfAnswer
                  facts={facts}
                  books={showing.books}
                  source={onAmazon ? "amazon" : "apple"}
                  amazon={amazonLink(chosen)}
                  onAmazon={free ? undefined : () => setPicked("amazon")}
                />
              )}
            </section>

            {showing && (
              <>
                <YourPrice key={`price-${key}`} books={showing.books} />
                <ShelfBooks
                  key={`books-${key}`}
                  books={showing.books}
                  source={onAmazon ? "amazon" : "apple"}
                  layout={layout}
                  onLayout={(next) => setPref("priceCheckLayout", next)}
                />
                {onAmazon && (
                  <Disclosure
                    title="Series, length & paperback"
                    summary="What book 1s, long and short books, and paperbacks cost on this list."
                  >
                    <AmazonExtras books={showing.books} />
                  </Disclosure>
                )}
                <Disclosure
                  title="Paperback: what you'd keep"
                  summary="What Amazon would pay you on a printed copy, and the lowest price it accepts."
                >
                  <PaperbackPay books={myBooks} initialPages={pages || null} />
                </Disclosure>
                {!onAmazon && (
                  <Disclosure
                    title="What this list can't tell you"
                    summary="Kindle Unlimited, series, length and paperback prices."
                  >
                    <p className="max-w-prose text-sm text-fg">
                      Apple&rsquo;s list doesn&rsquo;t say which of these books
                      are part of a series, how long they are, or what their
                      paperbacks cost, so this check can&rsquo;t either. And no
                      book in Kindle Unlimited can be on it: those are sold only
                      on Amazon.
                      {free
                        ? " Amazon's own list, with all of that, is part of Pro."
                        : " Amazon's own list, with all of that, is the Amazon tab above."}
                    </p>
                    <p className="mt-3 max-w-prose text-sm text-muted">
                      The sides are sorted by the publisher&rsquo;s name. A
                      small press can land with the self-published, which is
                      the side of the trade it prices like.
                    </p>
                  </Disclosure>
                )}
              </>
            )}
          </>
        )}
      </div>

      {upsell && (
        <UpgradeDialog reason="amazon" onClose={() => setUpsell(false)} />
      )}
    </div>
  );
}
