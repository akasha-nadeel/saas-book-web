"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { subjectParts } from "@/lib/comps/subjects";
import {
  openingFrom,
  proseFrom,
  restOf,
  type RankedComp,
} from "@/lib/comps/rank";
import { toBlocks } from "@/lib/export/blocks";
import {
  bookWordCount,
  chapterMatterOf,
  findBook,
  getBody,
  orderedChapters,
  setTargetWords,
} from "@/lib/library-store";
import { GENRES, suggestTarget } from "@/lib/book-kinds";
import { useHydrated, useShelf } from "@/lib/use-library";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * Comparable titles for one book.
 *
 * The screen exists because "what books is mine like?" is asked by every
 * listing form and every query letter, and answered by guessing. It is the
 * first of the six features that read Google Books and Open Library, and the
 * other five are all different readings of what this fetches — which is why it
 * was built first.
 *
 * **It opens on a shelf, not on a form.** The query is seeded from the book's
 * genre and blurb and *run* on arrival, so a writer lands among twenty real
 * books rather than in front of an empty box and a paragraph explaining what a
 * comparable title is — which asks them to imagine the answer before they have
 * seen one, on the screen that exists because they cannot. The seed stays
 * visible and editable in the box; they know what their book is like and we do
 * not.
 *
 * **The covers come first and the arithmetic comes after.** Median pages, the
 * length reading and the subject counts are all readings *of* the shelf, and
 * they used to sit above it — a screen and a half of analysis before a single
 * cover. Ordered the other way round, the numbers arrive after the books they
 * were counted from, which is when they mean anything.
 *
 * **The search does not judge, and the ranking is a separate press.** What the
 * two services return is what they return, in their order. Working out which
 * five of those twenty are genuinely comparable is a fuzzy judgement and the
 * one place a model earns its cost — so it is a control on the results bar
 * rather than part of the search, and everything else works with the model
 * switched off and the bill at zero.
 *
 * **That press is where this screen sends prose**, and it is the only thing in
 * the tool that does. The opening of the manuscript answers what a keyword
 * search cannot — does this *sound* like that book — so the line under the
 * button names exactly what leaves before it is pressed, in the shape the
 * feedback dialog uses. Nothing is sent by loading the page except the query
 * in the box.
 */
export function CompsPage({ bookId, embedded, heading }: ToolPageProps) {
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

  const [picks, setPicks] = useState<RankedComp[] | null>(null);
  const [pattern, setPattern] = useState<string | null>(null);
  const [ranking, setRanking] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);

  /**
   * The opening of the book, for the ranking to judge voice against.
   *
   * The first body chapter that has any prose in it, rather than the first
   * chapter: a book whose chapter one is an empty stub would otherwise send
   * nothing and be told there was nothing to judge, while the prose sat in
   * chapter two.
   */
  const opening = useMemo(() => {
    if (!book) return "";
    for (const chapter of orderedChapters(book)) {
      if (chapterMatterOf(chapter) !== "body") continue;
      const raw = getBody(chapter.id);
      if (!raw) continue;
      try {
        const text = openingFrom(proseFrom(toBlocks(JSON.parse(raw))));
        if (text) return text;
      } catch {
        // A corrupt body contributes nothing, as it does to search.
      }
    }
    return "";
  }, [book]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    // A ranking belongs to the list it was made from. Leaving it up over a new
    // search would attribute five reasons to twenty different books.
    setPicks(null);
    setPattern(null);
    setRankError(null);
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

  /**
   * Seed the box once the shelf has been read, and run it.
   *
   * **Arriving on an empty form was the bug.** The screen used to open on a
   * search box and a paragraph explaining what a comparable title is, which
   * asks a writer to do the work of imagining the answer before they have seen
   * one — on a screen whose whole subject is that they do not know what their
   * book sits beside. A shelf of real books is the explanation; the paragraph
   * was standing in for it.
   *
   * The search that runs is the one already in the box, so nothing happens
   * behind the writer's back: they land on the results of a query they can
   * read, edit and run again. It costs nothing to do — `/api/comps` is free,
   * keyless and cached for a day, so the second writer in a genre is served
   * from the cache.
   *
   * Once, and never again: a writer who has edited the query does not want it
   * rewritten under them on a re-render.
   */
  /**
   * Which shelf the covers below are from, or null for a query of the writer's
   * own words.
   *
   * Read off the query rather than off the book, because the shelf chips
   * change the query and the book's genre never moves. `GENRES` is the closed
   * list those chips are built from, so a match here means a chip is lit and
   * the caption can name it with confidence.
   */
  const shownShelf = useMemo(
    () => GENRES.find((g) => query === `subject:"${g}"`) ?? null,
    [query],
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    const seed = buildQuery({
      genre: book.genre,
      blurb: book.publishing?.description,
    });
    setQuery(seed);
    void search(seed);
  }, [book, search]);

  /**
   * Ask the model which of these are actually alike.
   *
   * The reply comes back as keys and reasons rather than whole records — the
   * browser already has the books, and echoing twenty of them back would be
   * paying to move data that never left.
   */
  const rank = useCallback(async () => {
    setRanking(true);
    setRankError(null);
    try {
      const response = await fetch("/api/comps/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blurb: book?.publishing?.description ?? "",
          opening,
          books,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRankError(data?.error ?? "The ranking did not work.");
        return;
      }
      const byKey = new Map(books.map((b) => [b.key, b]));
      const chosen: RankedComp[] = (data.picks ?? []).flatMap(
        (p: { key?: string; reason?: string }) => {
          const found = p.key ? byKey.get(p.key) : undefined;
          return found && p.reason
            ? [{ book: found, reason: p.reason }]
            : [];
        },
      );
      setPicks(chosen);
      setPattern(typeof data.pattern === "string" ? data.pattern : null);
    } catch {
      setRankError("Could not reach the ranking. Check your connection.");
    } finally {
      setRanking(false);
    }
  }, [book, books, opening]);

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
        <ToolHeader book={book} tool="Comp titles" width="6xl">
          The published books yours sits beside — what a reader who liked yours
          would also have bought, which every listing form and every query
          letter asks for. Not a book you admire and not a bestseller: a shop
          reads &ldquo;like Tolkien&rdquo; as somebody who has not looked.
        </ToolHeader>
      )}

      {/* A query container, so the figures below break on the width this page
          actually has rather than on the window's — it opens in the roadmap's
          panel at about half a screen. See the note in `blurb-page.tsx`. */}
      <div className="@container mx-auto max-w-6xl px-6 pt-6 pb-16">
        {heading}
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
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Find comps"}
          </button>
        </form>

        {/* Shelves to walk along, always — not only when the book has no genre.
            A writer who does not know what their book sits beside is exactly
            the writer this screen is for, and the useful move for them is to
            look at a few shelves rather than to phrase a better query. Pressing
            one is only a search: nothing is written to the book, which is why
            these read as places to go rather than as a form to fill in. */}
        <div className="mt-3">
          {/* What is *on screen*, not what the book says it is.
              This read "Showing Mystery, from this book’s genre" while the
              Fantasy shelf was open and its chip lit, because it was written
              from `book.genre` and the genre never changes. A caption that
              contradicts the covers under it is worse than no caption: the
              reader has to work out which of the two is lying. */}
          <p className="text-xs text-muted">
            {shownShelf
              ? `Showing ${shownShelf}${
                  shownShelf === book.genre
                    ? `, from this book’s genre${book.publishing?.description ? " and blurb" : ""}`
                    : ""
                }. Look at another shelf:`
              : book.genre
                ? `Searching your own words. Or look at a shelf:`
                : "This book has no genre set. Pick a shelf to look at, or describe the story in your own words above."}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GENRES.filter((g) => g !== "Other").map((genre) => {
              const seed = `subject:"${genre}"`;
              const on = query === seed;
              return (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setQuery(seed);
                    void search(seed);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    on
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-line bg-panel text-fg hover:border-accent/40"
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* The shelf loads on arrival, so the wait is the first thing anybody
            sees — and an empty page for two seconds reads as broken on a screen
            most writers have never opened before. Shaped like the rows that
            replace them, so nothing jumps when they do. */}
        {state === "loading" && (
          <ul
            className="mt-12 grid grid-cols-2 gap-x-4 gap-y-6 @sm:grid-cols-3 @lg:grid-cols-4 @2xl:grid-cols-5"
            aria-hidden
          >
            {Array.from({ length: 10 }, (_, i) => (
              <li key={i} className="animate-pulse">
                <div className="aspect-[2/3] w-full rounded-lg bg-raised" />
                <div className="mt-2 h-3.5 w-4/5 rounded bg-raised" />
                <div className="mt-1.5 h-3 w-3/5 rounded bg-raised" />
              </li>
            ))}
          </ul>
        )}

        {/* Only reachable when the book had nothing to seed a search with, now
            that arriving runs one. The shelves above are the way out of it, so
            this is a line rather than the essay that used to sit here. */}
        {state === "idle" && (
          <p className="mt-8 text-muted">
            Pick a shelf above to see what is on it, or describe your story in
            the box.
          </p>
        )}

        {/* ---- The books ------------------------------------------------

            First, and that is the whole of this section's design. These panels
            used to run figures, then a length reading, then the ranking card
            before a single cover appeared — about a screen and a half of
            analysis above the thing being analysed, so the answer to "what
            does my book sit beside" was below the fold on every screen size.
            Every shop that sells books puts the shelf directly under the
            search box and its facets and summaries around or after it; there
            is no version of this where the arithmetic outranks the covers.
        ---------------------------------------------------------------- */}

        {state === "done" && books.length === 0 && (
          <p className="mt-8 text-muted">
            Nothing came back for that. Try fewer words, or describe the story
            rather than naming the genre.
          </p>
        )}

        {books.length > 0 && (
          <ResultsBar
            picks={picks}
            pattern={pattern}
            ranking={ranking}
            error={rankError}
            count={books.length}
            hasBlurb={Boolean(book.publishing?.description?.trim())}
            hasOpening={Boolean(opening)}
            onRank={rank}
          />
        )}

        {/* Said plainly rather than left as a short list. A writer who sees ten
            results instead of twenty should know a service was down, not
            conclude that their genre is nearly empty. */}
        {state === "done" && sources && !sources.google && (
          <p className="mt-3 text-xs text-muted">
            Google Books did not answer, so these are Open Library&rsquo;s
            records only and carry no blurbs. It rate-limits without an API key.
          </p>
        )}

        {picks && picks.length > 0 && (
          <CompGrid comps={picks.map((p) => p.book)} reasons={picks} />
        )}

        {books.length > 0 && (
          <>
            {picks && picks.length > 0 && (
              <h2 className="mt-10 text-sm font-bold text-fg">
                The rest of what came back
              </h2>
            )}
            <CompGrid comps={picks ? restOf(books, picks) : books} />
          </>
        )}

        {/* ---- What the shelf adds up to ---------------------------------

            After the covers, because it is a reading *of* them. A writer who
            wants the median page count has already seen the books it was
            counted from, which is the order in which the number means
            anything.
        ---------------------------------------------------------------- */}

        {summary && books.length > 0 && (
          <section className="mt-12 grid gap-3 @md:grid-cols-3">
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

        {summary && books.length > 0 && (
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

        {/* Cut from four sentences to one. Three of them were restating what
            the cards above already say at the moment it matters — the ranking
            card lists what it sends, right where it is sent. What cannot go is
            the source: these are contributed catalogues, and a reader deciding
            how much to trust a record needs to know whose record it is. */}
        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs text-muted">
            From Google Books and Open Library — contributed catalogues, so
            records vary.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The bar over the shelf: how many books, and the one action that costs money.
 *
 * **This was a card, and the card was the problem.** It explained comps at
 * length, listed what ranking sends, and did all of that *above* the covers —
 * so the answer to "what does my book sit beside" started below the fold. A
 * results bar is what every shop selling books puts here instead: a count on
 * one side, the control that reorders the list on the other, one line tall.
 *
 * **The disclosure survived the shrinking**, because it is the one part that
 * could not go. Ranking sends prose, and a writer is owed that in plain words
 * at the moment it applies rather than in a policy page — so the line under
 * the button names exactly what leaves, and it sits there before the press and
 * goes after it. Add a field to what is sent and add it to that line.
 *
 * **Failure is text where the count is, never a missing button.** No key, no
 * account, no plan and a bad answer all read as a sentence — a control that
 * quietly does nothing is what the house rules call dead UI, and the shelf
 * below it still works, which is what the writer most needs to know.
 */
function ResultsBar({
  picks,
  pattern,
  ranking,
  error,
  count,
  hasBlurb,
  hasOpening,
  onRank,
}: {
  picks: RankedComp[] | null;
  pattern: string | null;
  ranking: boolean;
  error: string | null;
  count: number;
  hasBlurb: boolean;
  hasOpening: boolean;
  onRank: () => void;
}) {
  const nothingToJudge = !hasBlurb && !hasOpening;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <p className="text-sm text-muted">
          {picks === null ? (
            <>
              <span className="font-bold text-fg">{count}</span>{" "}
              {count === 1 ? "book" : "books"}, in the catalogues&rsquo; own
              order
            </>
          ) : picks.length === 0 ? (
            <>None of these {count} came back as close</>
          ) : (
            <>
              <span className="font-bold text-fg">{picks.length}</span> of{" "}
              {count} judged closest, best first
            </>
          )}
        </p>

        {picks === null && (
          <button
            type="button"
            onClick={onRank}
            disabled={ranking || nothingToJudge}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink
                       disabled:opacity-50"
          >
            {ranking ? "Reading\u2026" : "Rank these"}
          </button>
        )}
      </div>

      {picks === null && (
        <p className="mt-2 text-xs text-muted">
          {nothingToJudge ? (
            <>
              Ranking needs something of yours to judge against &mdash; write a
              blurb in the export screen&rsquo;s listing details, or some prose
              in your first chapter.
            </>
          ) : (
            <>
              Ranking sends{" "}
              {[
                hasBlurb && "your blurb",
                hasOpening && "the opening of your first chapter",
              ]
                .filter(Boolean)
                .join(" and ")}{" "}
              to a model, only when you press it. Nothing is kept, and no score
              comes back &mdash; an order and a reason each.
            </>
          )}
        </p>
      )}

      {picks !== null && picks.length === 0 && (
        <p className="mt-2 text-xs text-muted">
          That is an answer rather than a failure. Try a search that describes
          the story rather than naming the genre.
        </p>
      )}

      {pattern && <p className="mt-3 text-sm text-fg">{pattern}</p>}

      {error && <p className="mt-2 text-sm text-fg">{error}</p>}
    </div>
  );
}

/**
 * The shelf itself &mdash; covers in a grid, the way a bookshop shows books.
 *
 * A stacked list of rows was the wrong shape for this. Comps are judged by eye
 * first: a writer scanning twenty is asking "are these the same kind of book
 * as mine", which is a question about spines and artwork, and a list answers
 * it four books to a screen. A grid answers it twenty at a glance &mdash;
 * which is what the covers wall one tool over already does, for the same
 * reason.
 *
 * The columns are **container** queries rather than viewport ones, because
 * this screen also opens at about half a window inside the roadmap step panel;
 * breaking on the window there would put five columns in a half-width column.
 */
function CompGrid({
  comps,
  reasons,
}: {
  comps: CompTitle[];
  reasons?: RankedComp[];
}) {
  const reasonFor = new Map((reasons ?? []).map((r) => [r.book.key, r.reason]));

  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 @sm:grid-cols-3 @lg:grid-cols-4 @2xl:grid-cols-5">
      {comps.map((comp) => (
        <CompCard key={comp.key} comp={comp} reason={reasonFor.get(comp.key)} />
      ))}
    </ul>
  );
}

/**
 * One book on the shelf.
 *
 * The whole card is the link where the catalogue gave us somewhere to go, so
 * the target is a cover rather than a four-word phrase underneath it.
 *
 * **A missing cover is drawn, not left as a hole.** Both services return
 * records with no artwork, and a grey rectangle in a grid of covers reads as a
 * broken image; a tile with the title set into it reads as a book whose
 * picture nobody uploaded, which is what it is.
 */
function CompCard({ comp, reason }: { comp: CompTitle; reason?: string }) {
  /**
   * What this one is filed under, cleaned.
   *
   * **Through `subjectParts` rather than straight off the record**, which is
   * the whole reason this line is worth having. Raw, these two catalogues file
   * a novel under `Fiction`, `Protected DAISY`, `In library` and
   * `Accessible book` — true of everything, or a note a librarian made about a
   * copy — and a grid of twenty cards all labelled FICTION teaches a writer
   * that their genre has no shelves in it. The same cleaning already sits
   * behind the Filed under figure and the categories tool, so a card and that
   * panel cannot disagree.
   *
   * **One, not two.** The cleaning drops what is true of every novel, but it
   * cannot tell a shelf from a curiosity: past the first entry these records
   * run to "Superintendent battle (fictitious character)" and "Older women",
   * which are real filings and useless as a tag. The first survivor is
   * reliably the genre, and the whole list is still under Filed under below.
   */
  const filed = comp.subjects.flatMap(subjectParts)[0];

  const inner = (
    <>
      <span className="block overflow-hidden rounded-lg border border-line bg-raised">
        {comp.coverUrl ? (
          // A plain img, not next/image: these are two third-party hosts whose
          // URLs we do not control, and adding them to the image config to gain
          // a resize on a thumbnail is a configuration file that goes stale.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comp.coverUrl}
            alt=""
            loading="lazy"
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <span className="flex aspect-[2/3] w-full items-center justify-center p-3">
            <span className="line-clamp-4 text-center text-xs font-medium text-muted">
              {comp.title}
            </span>
          </span>
        )}
      </span>

      {/* The line is kept even when it is empty, so titles sit on one baseline
          across a row. A record with nothing usable left after cleaning is
          common, and letting its title ride up makes the grid look broken. */}
      <span className="mt-2.5 block truncate text-[0.625rem] tracking-[0.08em] text-muted uppercase">
        {filed || " "}
      </span>
      <span className="mt-0.5 block truncate text-sm font-bold text-fg">
        {comp.title}
      </span>
      <span className="block truncate text-xs text-muted">
        {comp.authors.join(", ")}
      </span>
      <span className="block text-xs text-muted">
        {[comp.year, comp.pageCount ? `${comp.pageCount}pp` : null]
          .filter(Boolean)
          .join(" \u00b7 ")}
      </span>
    </>
  );

  return (
    <li className="min-w-0">
      {comp.infoUrl ? (
        <a
          href={comp.infoUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {inner}
        </a>
      ) : (
        <div>{inner}</div>
      )}

      {reason && (
        <p className="mt-1.5 border-l-2 border-accent/40 pl-2 text-xs leading-relaxed text-fg">
          {reason}
        </p>
      )}
    </li>
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
