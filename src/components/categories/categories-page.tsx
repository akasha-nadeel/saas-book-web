"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { GENRES } from "@/lib/book-kinds";
import { buildQuery, type CompTitle } from "@/lib/comps/comps";
import { rankSubjects, worthSuggesting } from "@/lib/comps/subjects";
import { findBook, setPublishing } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * Categories, worked out from where comparable books are actually filed.
 *
 * A shop's category box is asking for BISAC, and BISAC is owned by BISG and
 * licensed — shipping the code list is neither free nor ours to do. The way
 * round it turns out to be the better answer anyway: read what books like this
 * one are filed under and rank that. It comes off the shelf rather than out of
 * a taxonomy, which is how a writer would answer it themselves given a bookshop
 * and an afternoon.
 *
 * **Suggestions, and the writer picks.** Nothing is selected automatically, and
 * every row carries how many of the comparable books are filed under it —
 * because "9 of 20" and "2 of 20" are different kinds of advice and the number
 * is the only honest way to say which.
 *
 * **That number is drawn as well as written.** It was plain text at the end of
 * a row, which made the most important thing on the line the last thing read
 * and impossible to compare down a column. A bar is scanned in one pass; the
 * figure stays beside it, because a bar alone says *more* without saying how
 * many.
 *
 * The cleaning is in `subjects.ts` and it is most of the feature — raw, these
 * two catalogues answer with "Fiction", which is true of every novel ever
 * written, and with "Protected DAISY", which is a note about a copy.
 */
export function CategoriesPage({ bookId, embedded, heading }: ToolPageProps) {
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

  // The app's splash is for the app. In the roadmap's panel it would take
  // over half the window with a logo, so an embedded tool waits silently —
  // see `Pending` in `roadmap/step-panel.tsx`.
  if (!hydrated)
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;

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
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader book={book} tool="Categories">
          Which shelf your book lands on — worked out from where books like yours
          are actually filed, rather than from a list we made up.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        {heading}
        {/* ---- What is chosen --------------------------------------------
            A strip rather than the card this was. Before the first search a
            writer cannot have chosen anything, so a panel headed "On this
            book" containing one sentence of apology was the largest thing on
            the screen and the least useful thing on it. */}
        {chosen.length > 0 ? (
          <section className="rounded-xl border border-line bg-panel p-4">
            <p className="text-xs font-bold tracking-widest text-muted uppercase">
              On this book · {chosen.length}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {chosen.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    aria-label={`Remove ${name}`}
                    className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5
                               text-sm font-medium text-accent-ink"
                  >
                    {name}
                    <span aria-hidden="true" className="text-accent-ink/70">
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-muted">
              Saved to this book. Check the shop&rsquo;s own limit on how many
              it takes.
            </p>
          </section>
        ) : (
          <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
            <strong className="text-fg">Nothing chosen yet.</strong> An empty
            list is one of the things the pre-upload check raises, because a
            book with no categories has no shelf to turn up on.
          </p>
        )}

        {/* ---- Find some -------------------------------------------------- */}
        <form
          className="mt-6 flex flex-wrap gap-2"
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
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Suggest categories"}
          </button>
        </form>

        {/* With no genre and no blurb the seed is empty, which left the box
            blank and the button dead. Same fix as the comps screen: the app's
            own genres as starting points, which search rather than save. */}
        {!book.genre && (
          <div className="mt-3">
            <p className="text-xs text-muted">
              This book has no genre set, so there was nothing to seed the box
              with. Start from one of these, or describe the story above.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GENRES.filter((g) => g !== "Other").map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    const seed = `subject:"${genre}"`;
                    setQuery(seed);
                    void search(seed);
                  }}
                  className="rounded-full border border-line bg-panel px-3 py-1 text-xs
                             font-medium text-fg hover:border-accent/40"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-note-line bg-note-bg p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {state === "idle" && (
          <section className="mt-8 rounded-xl border border-line bg-panel p-5">
            <h2 className="font-bold text-fg">What these are, exactly</h2>
            <p className="max-w-prose mt-1.5 text-sm text-muted">
              Not a shop&rsquo;s category list. These are the subjects two
              public catalogues file comparable books under — the answer to
              &ldquo;what is this book, to a librarian&rdquo;. Shops run their
              own scheme, so the box on their form may not take these words as
              typed; what they give you is the right shape of answer, and the
              vocabulary to match against theirs.
            </p>
            <p className="max-w-prose mt-3 text-sm text-muted">
              Search, and each suggestion says how many comparable books carry
              it. A subject one book in twenty is filed under is that book
              rather than a pattern, which is why those are left out.
            </p>
          </section>
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
            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold text-fg">
                {suggestions.length} worth considering
              </h2>
              <p className="max-w-prose text-sm text-muted">
                From {books.length} comparable books · tap to add
              </p>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {suggestions.map((subject) => (
                <SuggestionRow
                  key={subject.name}
                  name={subject.name}
                  count={subject.count}
                  total={books.length}
                  on={chosen.includes(subject.name)}
                  onToggle={() => toggle(subject.name)}
                />
              ))}
            </ul>
          </>
        )}

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs text-muted">
            These are the subjects two public catalogues file comparable books
            under, not official shop categories — shops use their own scheme, and
            the box on their form may not accept these words as typed. Treat them
            as the answer to &ldquo;what is this book, to a librarian&rdquo;, and
            match them to the shop&rsquo;s own list yourself.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * One suggestion, with its share of the comparable books drawn.
 *
 * The bar gives a column of "9 of 20", "7 of 20", "4 of 20" the sorting sense
 * it does not otherwise have: those must be read and compared one at a time,
 * where the shape is taken in at a glance. The figure stays beside it, because
 * a bar alone says *more* without saying how many — and the whole reason this
 * screen prints the count is that a subject carried by two books and one
 * carried by nine are different advice.
 */
function SuggestionRow({
  name,
  count,
  total,
  on,
  onToggle,
}: {
  name: string;
  count: number;
  total: number;
  on: boolean;
  onToggle: () => void;
}) {
  const share = total > 0 ? (count / total) * 100 : 0;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left
                    transition-colors ${
                      on
                        ? "border-accent bg-accent/8"
                        : "border-line bg-panel hover:border-accent/40"
                    }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px]
                      font-bold ${
                        on
                          ? "bg-accent text-accent-ink"
                          : "border-2 border-line text-transparent"
                      }`}
        >
          ✓
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">
            {name}
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-raised">
            <span
              className={`block h-full rounded-full ${on ? "bg-accent" : "bg-fg/25"}`}
              style={{ width: `${share}%` }}
            />
          </span>
        </span>

        <span className="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums">
          {count} of {total}
        </span>
      </button>
    </li>
  );
}
