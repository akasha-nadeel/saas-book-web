"use client";

import { useState } from "react";
import type { ListedBook } from "@/lib/pricing/apple-list";
import { categoriesSeen, storeLadder } from "@/lib/pricing/category-facts";

/**
 * The Categories tab: how far down the whole Kindle Store this genre's best
 * sellers sit, and every category they also rank in.
 *
 * **Ranks, as Amazon printed them, and nothing made from them.** No sales a
 * rank "takes", no easy or hard — the tools that sell those numbers are the
 * ones this audience has stopped trusting. A writer reads where the #100 sits
 * and decides for themselves. See `category-facts.ts`.
 */

/** How many categories show before "Show all". */
const FIRST = 15;

const n = (value: number) => value.toLocaleString("en-US");

const dateOf = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** A search of the Kindle store for the category's name — called a search. */
const searchUrl = (name: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(name.replace(/\s*\((Books|Kindle Store)\)$/, ""))}&i=digital-text`;

export function CategoryCheck({
  books,
  genre,
  ranksRead,
}: {
  books: readonly ListedBook[];
  genre: string;
  ranksRead: string | null;
}) {
  const ladder = storeLadder(books);
  const seen = categoriesSeen(books);
  const [all, setAll] = useState(false);
  const shown = all ? seen.categories : seen.categories.slice(0, FIRST);
  const read = dateOf(ranksRead);

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="rounded-xl border border-line p-5">
        <h3 className="text-lg font-bold text-fg">How far down the store they sit</h3>
        <p className="mt-1 text-sm text-muted">
          Each book&rsquo;s rank in the whole Kindle Store, at points down
          Amazon&rsquo;s {genre} list.
        </p>
        <ol className="mt-4 divide-y divide-line">
          {ladder.map((step) => (
            <li key={step.position} className="flex items-baseline gap-3 py-2.5">
              <span className="w-12 shrink-0 text-sm font-semibold text-muted tabular-nums">
                #{step.position}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-fg" title={step.title}>
                {step.title}
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                {step.storeRank === null ? (
                  <span className="text-muted">no rank given</span>
                ) : (
                  <>
                    <span className="font-semibold text-fg">#{n(step.storeRank)}</span>
                    <span className="text-muted"> in store</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">
          {read ? `Store ranks read ${read}. ` : ""}A store rank moves every day,
          so these are a snapshot rather than a target.
        </p>
      </div>

      <div className="rounded-xl border border-line p-5">
        <h3 className="text-lg font-bold text-fg">Categories these books also rank in</h3>
        <p className="mt-1 text-sm text-muted">
          From the rank line on each book&rsquo;s page — {seen.known} of the{" "}
          {seen.of} books had one. Every category here has books ranking in it,
          so it has a real page readers can reach.
        </p>

        {seen.categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No book on this list named a category, so there is nothing to count.
          </p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-line">
              {shown.map((c) => (
                <li key={c.name} className="py-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{c.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold text-fg">{c.books}</span>
                      <span className="text-muted"> of {seen.of}</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    Top rank seen: #{n(c.topRank)}
                    {c.topStoreRank !== null ? ` (#${n(c.topStoreRank)} in store)` : ""} ·{" "}
                    <a
                      href={searchUrl(c.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      Search Kindle store
                    </a>
                  </p>
                </li>
              ))}
            </ul>
            {seen.categories.length > FIRST && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="mt-3 min-h-11 text-sm font-semibold text-accent"
              >
                {all ? "Show fewer" : `Show all ${seen.categories.length}`}
              </button>
            )}
          </>
        )}

        <div className="mt-4 space-y-2 text-xs text-muted">
          <p>
            Names are Amazon&rsquo;s own. &ldquo;(Books)&rdquo; marks a category in
            Amazon&rsquo;s print store; two spellings Amazon keeps apart are two
            categories here too.
          </p>
          <p>
            We can only see categories one of these books ranks in. A category
            none of them ranks in isn&rsquo;t listed, and this can&rsquo;t say
            whether it has a page.
          </p>
        </div>
      </div>
    </div>
  );
}
