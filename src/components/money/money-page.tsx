"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { findBook } from "@/lib/library-store";
import { copiesToBreakEven, REALITIES, SPENDS } from "@/lib/money";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * What a book usually earns, and what to check before paying anybody.
 *
 * The money pains are the loudest in the research and the least served by
 * software — *"I look at the massive amount of money I wasted"*, *"spent
 * upwards of a grand on covers and even more on ads, only to make next to
 * nothing"*, *"I fell for the [publisher] scam"*. None of that is a feature
 * request. It is a request to be told something before the money leaves.
 *
 * Being told is cheap, which is precisely why almost nobody does it: everyone
 * else in this market is paid when a writer spends. That is the whole argument
 * for this page existing, and the reason it is free.
 *
 * **The figures carry their own provenance.** They are directional, mostly
 * repeated rather than audited, and the page says so under each one — a page
 * that presented them as hard data would be doing the thing it warns about.
 *
 * **No company is named.** Several come up by name in the research; naming one
 * as a scam is a legal problem rather than a feature, and unnecessary, because
 * the checks describe the shape of the thing.
 */
export function MoneyPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [spend, setSpend] = useState("1000");
  const [royalty, setRoyalty] = useState("2");
  const copies = copiesToBreakEven(Number(spend), Number(royalty));

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg">
          Before you spend
        </h1>
        <p className="mt-3 text-muted">
          What a book usually earns, what the things cost, and what to establish
          before the money moves. Everyone else in this market is paid when you
          spend; we are not, which is the only reason you are reading this.
        </p>

        {/* ---- The numbers -------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          What usually happens
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {REALITIES.map((reality) => (
            <li
              key={reality.id}
              className="rounded-xl border border-line bg-panel p-5"
            >
              <p className="text-2xl font-extrabold text-fg">
                {reality.figure}
              </p>
              <p className="mt-1 text-fg">{reality.claim}</p>
              {/* Under every figure, always. A number with no provenance on a
                  page about not being misled would be its own joke. */}
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {reality.provenance}
              </p>
            </li>
          ))}
        </ul>

        {/* ---- Break-even --------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          What that spend has to earn back
        </h2>
        <section className="mt-4 rounded-xl border border-line bg-panel p-5">
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">You spend</span>
              <input
                type="number"
                min={0}
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-fg
                           outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-fg">You earn a copy</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={royalty}
                onChange={(e) => setRoyalty(e.target.value)}
                className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-fg
                           outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
            </label>
          </div>

          <p className="mt-4 text-lg text-fg">
            {copies === null ? (
              "Put a spend and a royalty in and this will tell you."
            ) : (
              <>
                <strong>{copies.toLocaleString()} copies</strong> to get back to
                nothing.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted">
            70% of a £2.99 ebook is about £2, which is the default here. Your
            own figure is on your royalty report and is worth using instead.
            Compare the answer with the first number on this page before you
            decide.
          </p>
        </section>

        {/* ---- The checks --------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          Before you pay anybody
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {SPENDS.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-line bg-panel p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-fg">{item.what}</p>
                <p className="text-sm text-muted">{item.typical}</p>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {item.checks.map((check) => (
                  <li key={check} className="flex gap-2 text-sm text-muted">
                    <span aria-hidden="true" className="text-accent">
                      ✓
                    </span>
                    <span>{check}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 rounded-lg bg-raised px-3 py-2 text-sm text-muted">
                <strong className="text-fg">Where it goes wrong.</strong>{" "}
                {item.trap}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          No company is named here. Several come up by name in what writers
          post, and calling a named business a scam is a legal matter rather
          than a feature — the checks above describe the shape of the thing,
          which is more use anyway, because next year it will have a different
          name. None of this is financial advice, and spending money on your
          book can be exactly the right decision. It should just be a decision.
        </p>
      </div>
    </div>
  );
}
