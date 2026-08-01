"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { buildQuery, type CompSummary, type CompTitle } from "@/lib/comps/comps";
import { findBook } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";

/**
 * Comparable titles for one book.
 *
 * The screen exists because "what books is mine like?" is asked by every
 * listing form and every query letter, and answered by guessing. It is the
 * first of the six features that read Google Books and Open Library, and the
 * other five are all different readings of what this fetches — which is why it
 * was built first.
 *
 * **The search is seeded from the book, and then handed to the writer.** A
 * first query built from their genre and blurb is a starting point rather than
 * an answer; they know what their book is like and we do not, so the box stays
 * editable and the seed is visible in it rather than hidden behind a button.
 *
 * **Nothing here judges.** The list is what the two services returned for that
 * query, in their order. Working out which five of these twenty are genuinely
 * comparable is a fuzzy judgement and the one place a model earns its cost —
 * a later step, and deliberately not this one, so the whole screen works with
 * the model switched off and the bill at zero.
 */
export function CompsPage({ bookId }: { bookId: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [summary, setSummary] = useState<CompSummary | null>(null);
  const [sources, setSources] = useState<{ google: boolean; openLibrary: boolean } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Seed the box once the shelf has been read, and never again — a writer who
  // has edited the query does not want it rewritten under them on a re-render.
  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setQuery(
      buildQuery({
        genre: book.genre,
        blurb: book.publishing?.description,
      }),
    );
  }, [book]);

  const search = useCallback(async (q: string) => {
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
      setSummary(data.summary ?? null);
      setSources(data.sources ?? null);
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }, []);

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
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href={`/book/${bookId}`} className="text-sm text-muted">
          ← {book.title}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold text-fg">Comp titles</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The published books yours sits beside. Every listing form and every
          query letter asks for these. Edit the search — you know what your book
          is like better than we do.
        </p>

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
            aria-label="Search for comparable titles"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={state === "loading" || query.trim().length < 2}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Find comps"}
          </button>
        </form>

        {book.genre && (
          <p className="mt-2 text-xs text-muted">
            Seeded from this book&rsquo;s genre
            {book.publishing?.description ? " and blurb" : ""}.
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* Said plainly rather than left as a short list. A writer who sees ten
            results instead of twenty should know a service was down, not
            conclude that their genre is nearly empty. */}
        {state === "done" && sources && !sources.google && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-muted">
            Google Books did not answer, so this list is from Open Library only
            and has no blurbs in it. It rate-limits without an API key.
          </p>
        )}

        {state === "done" && books.length === 0 && (
          <p className="mt-8 text-muted">
            Nothing came back for that. Try fewer words, or describe the story
            rather than naming the genre.
          </p>
        )}

        {summary && books.length > 0 && (
          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            <Figure
              value={summary.medianPages ? `${summary.medianPages}` : "—"}
              label="median pages"
              from={summary.pagesFrom}
              total={books.length}
            />
            <Figure
              value={
                summary.medianBlurbChars ? `${summary.medianBlurbChars}` : "—"
              }
              label="median blurb characters"
              from={summary.blurbsFrom}
              total={books.length}
            />
            <div className="rounded-xl border border-line bg-panel px-5 py-4">
              <p className="text-sm font-bold text-fg">Filed under</p>
              <p className="mt-1.5 text-sm text-muted">
                {summary.subjects
                  .slice(0, 5)
                  .map((s) => `${s.name} (${s.count})`)
                  .join(", ") || "—"}
              </p>
            </div>
          </section>
        )}

        {books.length > 0 && (
          <ul className="mt-8 flex flex-col gap-3">
            {books.map((comp) => (
              <li
                key={comp.key}
                className="flex gap-4 rounded-xl border border-line bg-panel p-4"
              >
                {comp.coverUrl ? (
                  // A plain img, not next/image: these are two third-party
                  // hosts whose URLs we do not control, and adding them to the
                  // image config to gain a resize on a 60px thumbnail is a
                  // configuration file that goes stale.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comp.coverUrl}
                    alt=""
                    className="h-[84px] w-[56px] shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-[84px] w-[56px] shrink-0 rounded bg-raised" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-fg">{comp.title}</p>
                  <p className="text-sm text-muted">
                    {comp.authors.join(", ")}
                    {comp.year ? ` · ${comp.year}` : ""}
                    {comp.pageCount ? ` · ${comp.pageCount} pages` : ""}
                  </p>
                  {comp.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted">
                      {comp.description}
                    </p>
                  )}
                  {comp.subjects.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {comp.subjects.slice(0, 4).join(" · ")}
                    </p>
                  )}
                  {comp.infoUrl && (
                    <a
                      href={comp.infoUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-block text-xs text-accent"
                    >
                      Look at it yourself →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          From Google Books and Open Library. Both are contributed catalogues,
          so records vary — this is what is out there, not a verdict. Nothing
          you have written is sent: only the words in the search box.
        </p>
      </div>
    </div>
  );
}

/**
 * A figure, and how many books it was drawn from.
 *
 * The denominator is not decoration. "The median is 320 pages" from three of
 * twenty books is a different statement from the same figure from eighteen,
 * and a writer about to set their own length off it needs to know which.
 */
function Figure({
  value,
  label,
  from,
  total,
}: {
  value: string;
  label: string;
  from: number;
  total: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted">
        from {from} of {total} books
      </p>
    </div>
  );
}
