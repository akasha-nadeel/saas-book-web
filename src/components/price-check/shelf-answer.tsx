import { MIN_PRICES } from "@/lib/comps/price-check";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { GROUP_LABEL, type PublisherGroup } from "@/lib/pricing/publishers";
import { kindleUnlimitedCount, type ShelfFacts } from "@/lib/pricing/shelf-facts";
import { money } from "./money";

/**
 * The answer: one middle price for each side of the trade.
 *
 * **Each figure carries the count it was drawn from**, and a side with too few
 * books gets no number off three books. No figure on this card is a
 * recommendation, and there is no "typical" or "sweet spot" wording — the
 * middle half is named for what it is.
 *
 * **Amazon's own publishers are a third tile only when the list has any**,
 * which in practice means Amazon's list: their ebooks are Amazon's own and are
 * not sold at Apple.
 *
 * **The Kindle Unlimited sentence depends on the list.** On Amazon's it is the
 * count — the figure writers asked for most. On Apple's it says plainly that
 * those books cannot be there, so a writer does not read the Apple list as the
 * whole market.
 *
 * **When the self-published side is too thin on Apple's list, the next step is
 * Amazon**: a button that switches to the Amazon tab for a Pro writer, and a
 * link to Amazon's own list for everyone else.
 */
export function ShelfAnswer({
  facts,
  books,
  source,
  amazon,
  onAmazon,
}: {
  facts: ShelfFacts;
  books: readonly ListedBook[];
  source: "apple" | "amazon";
  amazon: { url: string; label: string };
  /** Pro only: switch to the Amazon tab instead of leaving for Amazon's site. */
  onAmazon?: () => void;
}) {
  const order: PublisherGroup[] = [
    "independent",
    "traditional",
    ...(facts.groups.amazon.count > 0 ? (["amazon"] as const) : []),
  ];
  const ku = kindleUnlimitedCount(books);

  const amazonAction = (className: string) =>
    onAmazon ? (
      <button type="button" onClick={onAmazon} className={className}>
        See Amazon&rsquo;s list for this genre
      </button>
    ) : (
      <a href={amazon.url} target="_blank" rel="noreferrer" className={className}>
        {amazon.label}
        <span aria-hidden="true"> &#8599;</span>
      </a>
    );

  return (
    <>
      <div
        className={`mt-5 grid gap-3 ${order.length === 3 ? "@3xl:grid-cols-3" : "@2xl:grid-cols-2"}`}
      >
        {order.map((group) => {
          const side = facts.groups[group];
          const s = side.summary;

          if (!s && group === "independent" && source === "apple") {
            return (
              <div
                key={group}
                className="flex flex-col rounded-xl border border-line bg-accent/5 p-4"
              >
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {GROUP_LABEL[group]}
                </p>
                <p className="mt-2 text-sm text-fg">
                  {side.count === 0
                    ? "No self-published books made Apple’s top 100 here."
                    : `Only ${side.count} self-published ${side.count === 1 ? "book" : "books"} made Apple’s top 100 here — too few for a middle price, which takes ${MIN_PRICES}.`}{" "}
                  Self-published books in this genre may be selling only on
                  Amazon, where Apple&rsquo;s list can&rsquo;t see them.
                </p>
                {amazonAction(
                  "mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink",
                )}
              </div>
            );
          }

          return (
            <div key={group} className="rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                {GROUP_LABEL[group]}
              </p>
              {s ? (
                <>
                  <p className="mt-1 text-4xl font-bold text-fg tabular-nums">
                    {money(s.median)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    The middle price of {side.count} of the {facts.of} books.
                    {s.middleLow !== s.middleHigh && (
                      <>
                        {" "}
                        Half cost between {money(s.middleLow)} and{" "}
                        {money(s.middleHigh)}.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-4xl font-bold text-muted" aria-hidden="true">
                    &mdash;
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {side.count === 0
                      ? `None of the ${facts.of} books.`
                      : `Only ${side.count} of the ${facts.of} books — too few for a middle price, which takes ${MIN_PRICES}.`}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {facts.free > 0 && (
        <p className="mt-3 text-sm text-muted">
          {facts.free === 1 ? "One book is" : `${facts.free} books are`} listed
          free and kept out of these figures.
        </p>
      )}

      {source === "amazon" ? (
        <p className="mt-4 max-w-prose text-sm text-fg">
          <span className="font-semibold tabular-nums">
            {ku.inIt} of the {ku.known === ku.of ? ku.of : ku.known}
          </span>{" "}
          {ku.known === ku.of
            ? "books are in Kindle Unlimited,"
            : `books Amazon gave details for are in Kindle Unlimited (${ku.of - ku.known} more had none),`}{" "}
          where Amazon also pays for each page read. A self-published book in
          it may be sold only on Amazon.
        </p>
      ) : (
        <p className="mt-4 max-w-prose text-sm text-muted">
          Kindle Unlimited books are sold only on Amazon, so none of them are on
          Apple&rsquo;s list, and self-published books may be fewer here than on
          Amazon.
          {/* Only when the card above has not already drawn the same step as
              its button — the same place twice, a few lines apart. */}
          {facts.groups.independent.summary && (
            <>
              {" "}
              {amazonAction("font-semibold text-accent hover:underline")}
            </>
          )}
        </p>
      )}
    </>
  );
}
