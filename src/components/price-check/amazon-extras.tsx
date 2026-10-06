import { MIN_PRICES } from "@/lib/comps/price-check";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { GROUP_LABEL, type PublisherGroup } from "@/lib/pricing/publishers";
import {
  lengthBands,
  paperbackBySide,
  seriesSplit,
  type GroupFacts,
} from "@/lib/pricing/shelf-facts";
import { money } from "./money";

/**
 * Series, length and paperback — what only Amazon's data can say.
 *
 * **Each answers a question writers ask, with what the list charges rather
 * than advice.** "Should book 1 be cheap?" becomes what book 1s on this list
 * cost against later books; "does length matter?" becomes what short and long
 * books cost. A row with fewer than `MIN_PRICES` books says so instead of
 * printing a middle price off three.
 */
export function AmazonExtras({ books }: { books: readonly ListedBook[] }) {
  const series = seriesSplit(books);
  const bands = lengthBands(books);
  const paperback = paperbackBySide(books);

  return (
    <div className="grid gap-6 text-sm @3xl:grid-cols-3">
      <div>
        <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          Series
        </h3>
        <dl className="mt-2 space-y-2">
          <Row label="Book 1 of a series" facts={series.firsts} />
          <Row label="Book 2 and later" facts={series.later} />
        </dl>
        <p className="mt-2 text-xs text-muted">
          {series.standalone} {series.standalone === 1 ? "book names" : "books name"} no
          series.
        </p>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          Length
        </h3>
        <dl className="mt-2 space-y-2">
          {bands.map((band) => (
            <Row key={band.label} label={band.label} facts={band} />
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">Amazon&rsquo;s print length.</p>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          Their paperbacks
        </h3>
        <dl className="mt-2 space-y-2">
          {(Object.keys(paperback) as PublisherGroup[])
            .filter((side) => paperback[side].count > 0)
            .map((side) => (
              <Row key={side} label={GROUP_LABEL[side]} facts={paperback[side]} />
            ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          Books with no paperback are left out.
        </p>
      </div>
    </div>
  );
}

function Row({ label, facts }: { label: string; facts: GroupFacts }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-fg">{label}</dt>
      <dd className="shrink-0 text-right tabular-nums">
        {facts.summary ? (
          <>
            <span className="font-semibold text-fg">{money(facts.summary.median)}</span>
            <span className="text-muted"> middle of {facts.count}</span>
          </>
        ) : (
          <span className="text-muted">
            {facts.count === 0 ? "none" : `only ${facts.count} — needs ${MIN_PRICES}`}
          </span>
        )}
      </dd>
    </div>
  );
}
