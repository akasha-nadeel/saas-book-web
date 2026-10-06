import { MIN_PRICES } from "@/lib/comps/price-check";
import { GROUP_LABEL, type PublisherGroup } from "@/lib/pricing/publishers";
import type { ShelfFacts } from "@/lib/pricing/shelf-facts";
import { money } from "./money";

/** Self-published first: it is the side most writers here are pricing into. */
const ORDER: PublisherGroup[] = ["independent", "traditional"];

/**
 * The answer: one middle price for each side of the trade.
 *
 * **Each figure carries the count it was drawn from**, and a side with too few
 * books gets no number off three books. No figure on this card is a
 * recommendation, and there is no "typical" or "sweet spot" wording — the
 * middle half is named for what it is.
 *
 * **When the self-published side is too thin, Amazon is the next step, and
 * the card says so with a button rather than a dash** (2026-10-06). In
 * thriller, historical, literary and young adult fiction, Apple's top 100
 * holds two to eighteen self-published books — many of them sell only on
 * Amazon, through Kindle Unlimited, where this list cannot see them. A dash
 * there was an honest answer that left the writer nowhere to go.
 *
 * **The Kindle Unlimited sentence is not optional.** Apple's list cannot hold
 * those books, and a writer reading this card without it would underestimate
 * how crowded the cheap end is.
 */
export function ShelfAnswer({
  facts,
  amazon,
}: {
  facts: ShelfFacts;
  amazon: { url: string; label: string };
}) {
  return (
    <>
      <div className="mt-5 grid gap-3 @2xl:grid-cols-2">
        {ORDER.map((group) => {
          const side = facts.groups[group];
          const s = side.summary;

          if (!s && group === "independent") {
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
                <a
                  href={amazon.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 self-start
                             rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                >
                  {amazon.label}
                  <span aria-hidden="true">&#8599;</span>
                </a>
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

      <p className="mt-4 max-w-prose text-sm text-muted">
        Kindle Unlimited books are sold only on Amazon, so none of them are on
        Apple&rsquo;s list, and self-published books may be fewer here than on
        Amazon.
        {/* Only when the card above has not already drawn the same link as
            its button — the same place twice, a few lines apart. */}
        {facts.groups.independent.summary && (
          <>
            {" "}
            <a
              href={amazon.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              {amazon.label}&nbsp;&#8599;
            </a>
          </>
        )}
      </p>
    </>
  );
}
