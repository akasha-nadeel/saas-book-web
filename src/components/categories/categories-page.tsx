"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { buildQuery, type CompTitle } from "@/lib/comps/comps";
import { rankSubjects, worthSuggesting } from "@/lib/comps/subjects";
import { findBook, setPublishing } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Categories, worked out from where comparable books are actually filed.
 *
 * A shop's category box is asking for BISAC, and BISAC is owned by BISG and
 * licensed — shipping the code list is neither free nor ours to do. The way
 * round it turns out to be the better answer anyway: read what books like this
 * one are filed under and rank that. It comes off the shelf rather than out of
 * a taxonomy, which is how a writer would answer it themselves given a
 * bookshop and an afternoon.
 *
 * **Suggestions, and the writer picks.** Every row says how many of the
 * comparable books carry it, because "9 of 20" and "2 of 20" are different
 * kinds of advice and the number is the only honest way to say which. Nothing
 * is selected automatically.
 *
 * The cleaning is in `subjects.ts` and it is most of the feature — raw, these
 * two catalogues answer with "Fiction", which is true of every novel ever
 * written, and with "Protected DAISY", which is a note about a copy.
 */
export function CategoriesPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => book?.publishing?.subjects ?? [],
    [book?.publishing?.subjects],
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setQuery(
      buildQuery({ genre: book.genre, blurb: book.publishing?.description }),
    );
  }, [book]);

  const suggestions = useMemo(
    () => worthSuggesting(rankSubjects(books), books.length),
    [books],
  );

  async function search(q: string) {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/comps?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setBooks(data.books ?? []);
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }

  function toggle(name: string) {
    if (!book) return;
    const next = chosen.includes(name)
      ? chosen.filter((s) => s !== name)
      : [...chosen, name];
    setPublishing(book.id, { subjects: next });
  }

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
        <h1 className="mt-4 text-3xl font-extrabold text-fg">Categories</h1>
        <p className="mt-3 text-muted">
          Which shelf your book lands on. Worked out from where books like yours
          are actually filed, rather than from a list we made up.
        </p>

        {/* ---- What is chosen ------------------------------------------ */}
        <section className="mt-8 rounded-xl border border-line bg-panel p-5">
          <h2 className="font-bold text-fg">On this book</h2>
          {chosen.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              None chosen yet. These decide which shelf the book turns up on,
              and an empty list is one of the things the pre-upload check will
              raise.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {chosen.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white"
                  >
                    {name} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Suggestions --------------------------------------------- */}
        <form
          className="mt-8 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Words that describe your book"
            aria-label="Search for comparable books"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={state === "loading" || query.trim().length < 2}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Suggest categories"}
          </button>
        </form>

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {state === "done" && suggestions.length === 0 && (
          <p className="mt-8 text-muted">
            Nothing came back often enough to be worth suggesting. One book out
            of twenty filed under something is that book, not a pattern — try a
            broader search.
          </p>
        )}

        {suggestions.length > 0 && (
          <>
            <p className="mt-8 text-sm text-muted">
              From {books.length} comparable books. Tap to add one to your book.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {suggestions.map((subject) => {
                const on = chosen.includes(subject.name);
                return (
                  <li key={subject.name}>
                    <button
                      type="button"
                      onClick={() => toggle(subject.name)}
                      className={`flex w-full flex-wrap items-center justify-between gap-3
                                  rounded-lg border px-4 py-3 text-left ${
                                    on
                                      ? "border-accent bg-accent/10"
                                      : "border-line bg-panel"
                                  }`}
                    >
                      <span className="font-medium text-fg">
                        {subject.name}
                      </span>
                      <span className="text-sm text-muted">
                        {/* The number, always. "9 of 20" and "2 of 20" are
                            different kinds of advice, and this is the only
                            honest way to say which one a row is. */}
                        {subject.count} of {books.length} books
                        {on ? " · on your book" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          These are the subjects two public catalogues file comparable books
          under, not official shop categories — shops use their own scheme, and
          the box on their form may not accept these words as typed. Treat them
          as the answer to &ldquo;what is this book, to a librarian&rdquo;, and
          match them to the shop&rsquo;s own list yourself.
        </p>
      </div>
    </div>
  );
}
