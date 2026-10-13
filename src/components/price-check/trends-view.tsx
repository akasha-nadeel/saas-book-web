"use client";

import { useState } from "react";
import { BookCover } from "@/components/ui/book-cover";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { priceBands, ratingFacts, type Band } from "@/lib/pricing/trend-facts";
import { money } from "./money";

/**
 * The Trends tab: what is new, rising and wanted in a genre, how many ratings
 * its books carry, and what its covers look like together.
 *
 * **The pains it answers**, from what writers say about launching: what a new
 * book is up against in reviews, what books launch at, which books are
 * climbing, and the cover look a genre's readers expect. Every figure is
 * Amazon's own — a ratings count, a price, a list position, Amazon's note on
 * a move — counted, never turned into sales.
 */

export type TrendKey = "NEW_RELEASES" | "MOVERS_AND_SHAKERS" | "MOST_WISHED_FOR";

export type TrendAnswer =
  | { ok: true; books: ListedBook[]; updated: string | null }
  | { ok: false; reason: "none" | "failed" };

const TREND_TITLES: Record<TrendKey, { title: string; about: string }> = {
  NEW_RELEASES: {
    title: "New releases",
    about: "Amazon's best-selling new books in this genre.",
  },
  MOVERS_AND_SHAKERS: {
    title: "Movers & shakers",
    about: "The books whose sales rank rose most in the last day, with Amazon's own note on the move.",
  },
  MOST_WISHED_FOR: {
    title: "Most wished for",
    about: "The books readers in this genre add to their wish lists most.",
  },
};

const ORDER: TrendKey[] = ["NEW_RELEASES", "MOVERS_AND_SHAKERS", "MOST_WISHED_FOR"];

const n = (value: number) => value.toLocaleString("en-US");

export function TrendsView({
  lists,
  bestSellers,
  genre,
}: {
  lists: Record<TrendKey, TrendAnswer>;
  /** The genre's Amazon top 100, for the review counts and the cover wall. */
  bestSellers: readonly ListedBook[] | null;
  genre: string;
}) {
  const newReleases = lists.NEW_RELEASES.ok ? lists.NEW_RELEASES.books : null;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-2">
        <div className="rounded-xl border border-line p-5">
          <h3 className="text-lg font-bold text-fg">Ratings</h3>
          <p className="mt-1 text-sm text-muted">
            How many ratings each book&rsquo;s Amazon page shows.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-5 @xl:grid-cols-2">
            {bestSellers && <RatingBlock title="Top 100 best sellers" books={bestSellers} />}
            {newReleases && <RatingBlock title="New releases" books={newReleases} />}
          </div>
        </div>

        <div className="rounded-xl border border-line p-5">
          <h3 className="text-lg font-bold text-fg">What new books launch at</h3>
          {newReleases ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {/* One string: the compiler dropped the space after the
                    count when the sentence wrapped round an entity. */}
                {`The ${newReleases.length} ${newReleases.length === 1 ? "new release" : "new releases"} on Amazon’s list, counted by price.`}
              </p>
              <Bands bands={priceBands(newReleases).bands} of={priceBands(newReleases).of} />
              <p className="mt-3 text-xs text-muted">
                Counted in bands rather than given a middle price: this list
                doesn&rsquo;t say who published each book, so self-published
                and publishers&rsquo; prices can&rsquo;t be kept apart the way
                the Prices tab keeps them.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">{missing(lists.NEW_RELEASES, "New Releases")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-3">
        {ORDER.map((key) => (
          <TrendList key={key} which={key} answer={lists[key]} />
        ))}
      </div>

      {bestSellers && bestSellers.length > 0 && (
        <div className="rounded-xl border border-line p-5">
          <h3 className="text-lg font-bold text-fg">The covers on the top 100</h3>
          <p className="mt-1 text-sm text-muted">
            Amazon&rsquo;s {genre} best sellers side by side, in list order — the
            look readers of this genre see when they browse.
          </p>
          <ul className="mt-4 grid grid-cols-5 gap-2 @xl:grid-cols-8 @4xl:grid-cols-10">
            {bestSellers.map((book) => (
              <li key={book.id} className="min-w-0">
                <a
                  href={book.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  title={`#${book.position} ${book.title}`}
                  className="block"
                >
                  <BookCover src={book.cover ?? undefined} className="rounded-sm!" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function missing(answer: TrendAnswer, name: string): string {
  if (answer.ok) return "";
  return answer.reason === "none"
    ? `Amazon has no ${name} list for this genre.`
    : `Amazon's ${name} list couldn't be fetched just now.`;
}

function RatingBlock({ title, books }: { title: string; books: readonly ListedBook[] }) {
  const facts = ratingFacts(books);
  return (
    <div>
      <h4 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <p className="mt-2 text-sm text-fg">
        {facts.middle === null ? (
          <span className="text-muted">Too few counts for a middle.</span>
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums">{n(facts.middle)}</span>{" "}
            <span className="text-muted">middle of {facts.known}</span>
          </>
        )}
      </p>
      {facts.middleStars !== null && (
        <p className="text-xs text-muted">Middle star average {facts.middleStars.toFixed(1)}</p>
      )}
      <Bands bands={facts.bands} of={facts.known} />
    </div>
  );
}

function Bands({ bands, of }: { bands: Band[]; of: number }) {
  return (
    <dl className="mt-3 space-y-1.5 text-sm">
      {bands.map((band) => (
        <div key={band.label} className="flex items-center gap-3">
          <dt className="w-28 shrink-0 text-muted">{band.label}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: of ? `${(band.count / of) * 100}%` : 0 }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-semibold text-fg tabular-nums">
              {band.count}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** How many rows a trend list shows before "Show all". */
const FIRST = 10;

function TrendList({ which, answer }: { which: TrendKey; answer: TrendAnswer }) {
  const [all, setAll] = useState(false);
  const { title, about } = TREND_TITLES[which];
  const books = answer.ok ? answer.books : [];
  const shown = all ? books : books.slice(0, FIRST);

  return (
    <div className="min-w-0 rounded-xl border border-line p-5">
      <h3 className="text-lg font-bold text-fg">{title}</h3>
      <p className="mt-1 text-sm text-muted">{about}</p>
      {!answer.ok ? (
        <p className="mt-4 text-sm text-muted">{missing(answer, title)}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line">
            {shown.map((book) => (
              <li key={book.id} className="flex items-center gap-3 py-2">
                <span className="w-6 shrink-0 text-right text-xs text-muted tabular-nums">
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
                      className="line-clamp-2 text-sm text-accent hover:underline"
                    >
                      {book.title}
                    </a>
                  ) : (
                    <span className="line-clamp-2 text-sm text-fg">{book.title}</span>
                  )}
                  <span className="block truncate text-xs text-muted">
                    {money(book.price)}
                    {typeof book.ratings === "number"
                      ? ` · ${n(book.ratings)} ${book.ratings === 1 ? "rating" : "ratings"}`
                      : ""}
                  </span>
                  {book.change && (
                    <span className="block truncate text-xs text-fg">{book.change}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {books.length > FIRST && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-2 min-h-11 text-sm font-semibold text-accent"
            >
              {all ? "Show fewer" : `Show all ${books.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
