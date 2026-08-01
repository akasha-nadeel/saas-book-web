"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  buildQuery,
  type CompSummary,
  type CompTitle,
} from "@/lib/comps/comps";
import {
  compareLength,
  lengthFromPages,
  WORDS_PER_PAGE,
} from "@/lib/comps/length";
import { bookWordCount, findBook, setTargetWords } from "@/lib/library-store";
import { GENRES, suggestTarget } from "@/lib/book-kinds";
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
  const [sources, setSources] = useState<{
    google: boolean;
    openLibrary: boolean;
  } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
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
      <ToolHeader book={book} tool="Comp titles" width="4xl">
        The published books yours sits beside — what every listing form and
        every query letter asks for. Edit the search; you know what your book is
        like better than we do.
      </ToolHeader>

      <div className="mx-auto max-w-4xl px-6 pt-6 pb-16">
        <form
          className="flex flex-wrap gap-2"
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

        {book.genre ? (
          <p className="mt-2 text-xs text-muted">
            Seeded from this book&rsquo;s genre
            {book.publishing?.description ? " and blurb" : ""}.
          </p>
        ) : (
          /* A book with no genre and no blurb seeds an empty box, which left
             this screen telling the writer to "edit the search" with nothing
             to edit and the button disabled. The genres are the app's own
             list, and pressing one is only a search — nothing is written to
             the book, which is why they read as starting points rather than
             as a form. */
          <div className="mt-3">
            <p className="text-xs text-muted">
              This book has no genre set, so there was nothing to seed the box
              with. Start from one of these, or describe the story in your own
              words above.
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
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* Before the first search the page was blank below the box, which on
            a screen most writers have never used before reads as broken rather
            than as waiting. */}
        {state === "idle" && (
          <section className="mt-8 rounded-xl border border-line bg-panel p-5">
            <h2 className="font-bold text-fg">What a comp is for</h2>
            <p className="mt-1.5 text-sm text-muted">
              A comparable title is a published book a reader who liked yours
              would also have bought — recent, in your genre, and roughly your
              size. It is not a book you admire, and it is not a bestseller: an
              agent or a shop reads &ldquo;like Tolkien&rdquo; as someone who
              has not looked.
            </p>
            <p className="mt-3 text-sm text-muted">
              Search, then take the five that are genuinely close. What comes
              back is what these two catalogues hold for those words, in their
              order — the page does not rank them, because deciding which are
              really like yours is a judgement it cannot make.
            </p>
          </section>
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

        {/* ---- What that means for your length ------------------------ */}
        {summary && (
          <LengthPanel
            medianPages={summary.medianPages}
            from={summary.pagesFrom}
            words={bookWordCount(book)}
            target={book.targetWords}
            folklore={suggestTarget(
              book.kind ?? "novel",
              book.genre ?? "Other",
            )}
            onUseTarget={(words) => setTargetWords(book.id, words)}
          />
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
 * A word range from the page counts of real books, against the writer's own
 * count and against the folklore number `book-kinds.ts` would have suggested.
 *
 * The folklore is shown rather than replaced. "110,000 for a fantasy novel" is
 * roughly right and nobody can say which books it came from; putting it beside
 * a figure that names its twenty is the whole argument for this feature, and
 * hiding it would be claiming a victory over a number the writer never saw.
 *
 * "Under" and "over" are stated as positions, never as verdicts. A book is
 * finished when it is finished, and a tool that tells a writer their novel is
 * too short is doing the thing this product exists not to do.
 */
function LengthPanel({
  medianPages,
  from,
  words,
  target,
  folklore,
  onUseTarget,
}: {
  medianPages?: number;
  from: number;
  words: number;
  target?: number;
  folklore: number;
  onUseTarget: (words: number) => void;
}) {
  const range = lengthFromPages(medianPages, from);

  if (!range) {
    return (
      <section className="mt-4 rounded-xl border border-line bg-panel px-5 py-4">
        <p className="text-sm font-bold text-fg">
          How long is a book like this?
        </p>
        <p className="mt-1.5 text-sm text-muted">
          Not enough of these results carried a page count to say. Your setup
          suggests {folklore.toLocaleString()} words, which is the figure
          everybody repeats for this genre — roughly right, and from books
          nobody can name.
        </p>
      </section>
    );
  }

  const where = compareLength(words, range);

  return (
    <section className="mt-4 rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-sm font-bold text-fg">How long is a book like this?</p>
      <p className="mt-1.5 text-fg">
        <strong>
          {range.low.toLocaleString()}–{range.high.toLocaleString()} words
        </strong>
        , from a median of {range.medianPages} pages across {range.from} books.
      </p>
      <p className="mt-1.5 text-xs text-muted">
        Pages, not words — catalogues record pages, and a trade paperback runs
        somewhere between {WORDS_PER_PAGE.low} and {WORDS_PER_PAGE.high} words a
        page depending on trim size and type. That is why this is a range.
      </p>

      <p className="mt-3 text-sm text-muted">
        You have {words.toLocaleString()} words
        {where === "inside"
          ? ", which is inside that range."
          : where === "under"
            ? ", which is below it. That is a position, not a problem."
            : ", which is above it. Long books get published all the time."}
      </p>

      <p className="mt-3 text-sm text-muted">
        The suggested target for this genre is {folklore.toLocaleString()} — the
        number everybody repeats, from books nobody can name.
        {target ? ` Yours is set to ${target.toLocaleString()}.` : ""}
      </p>

      <button
        type="button"
        onClick={() => onUseTarget(range.middle)}
        className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-fg"
      >
        Set my target to {range.middle.toLocaleString()}
      </button>
    </section>
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
