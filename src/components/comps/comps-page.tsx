"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { BookCover } from "@/components/ui/book-cover";
import {
  BROWSE_SHELVES,
  buildQuery,
  type CompSummary,
  type CompTitle,
} from "@/lib/comps/comps";
import { looksPlain } from "@/lib/comps/query";
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
import { suggestTarget } from "@/lib/book-kinds";
import { ToolStepDone } from "@/components/ui/tool-save";
import { useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";
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

  /*
   * Nothing here is a draft — a search is not an edit, and "Use this target"
   * writes the moment it is pressed.
   *
   * Two road steps land on this screen and they are ticked in opposite ways.
   * "Set a length to aim at" is detected from `book.targetWords`, so pressing
   * that button ticks it. "Find your comp titles" cannot be detected: the two
   * or three a writer settles on are copied into a query letter and a shop's
   * form, and nothing in the library records that they chose them. So it is
   * this press.
   */
  const save = useToolSave({ book, tool: "comps" });

  /* Generated, not a literal: the roadmap mounts this tool in a panel, so the
     page can hold this screen and the road at once and a hard-coded id would
     be a duplicate the label points at by chance. */
  const queryId = useId();

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [summary, setSummary] = useState<CompSummary | null>(null);
  const [sources, setSources] = useState<{
    google: boolean;
    openLibrary: boolean;
  } | null>(null);
  /** Whether Google was ever able to answer — see the route's own note. */
  const [googleKeyed, setGoogleKeyed] = useState(true);
  /** How each source failed, when it did — `SourceFailure` from the route. */
  const [why, setWhy] = useState<{
    google: string | null;
    openLibrary: string | null;
  } | null>(null);
  /** Whether the worked example is showing in the empty box. */
  const [hint, setHint] = useState(true);
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

  /**
   * The query the result on screen belongs to.
   *
   * `query` is the box, which the writer can edit after a search; this is what
   * was actually asked. The empty state reads it rather than the box, or
   * clearing the field would rewrite the explanation of a result that is still
   * on screen — the same fault the title check had with its own answer.
   */
  const [searched, setSearched] = useState("");


  /**
   * Search, translating the writer's words into a catalogue query first.
   *
   * **The translation is the fix for the wrong-books problem**, and it has to
   * happen here rather than in the ranking: `Rank these` reorders what was
   * fetched, so a fetch that brought back a comedian's memoir and a devotional
   * about dessert stays wrong however well it is sorted.
   *
   * Three things keep it honest. It runs **only on plain words** — a shelf chip
   * or a hand-written `subject:"…"` is already a query, and rewriting it would
   * spend a model call to change nothing. It **puts the query it used in the
   * box**, so what was searched is on screen and can be edited or undone. And
   * **every failure falls through to the raw words**: no plan, no key, a bad
   * parse or a dead model all end in the search that would have run anyway,
   * because a free keyless search is the thing this screen may never lose.
   */
  const search = useCallback(async (q: string, genre?: string) => {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    // A ranking belongs to the list it was made from. Leaving it up over a new
    // search would attribute five reasons to twenty different books.
    setPicks(null);
    setPattern(null);
    setRankError(null);

    let asked = q;
    if (looksPlain(q)) {
      try {
        const response = await fetch("/api/comps/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: q, genre }),
        });
        if (response.ok) {
          const built = (await response.json())?.query;
          if (typeof built === "string" && built.trim()) {
            asked = built.trim();
            setQuery(asked);
          }
        }
      } catch {
        // The words themselves are a working search. Never block on this.
      }
    }

    try {
      let response = await fetch(`/api/comps?q=${encodeURIComponent(asked)}`);
      let data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }

      /*
       * **A translation that finds nothing loses to the words it replaced.**
       *
       * Measured, and it is not a rare edge: "cozy village mystery with a nosy
       * librarian" came back as `subject:"Fantasy" subject:"Cozy mystery"
       * librarian village` — four terms, which the catalogue ANDs, and
       * therefore **0 books**. The same words sent raw found 6, and the single
       * term `subject:"Cozy mystery"` found 20. The clever step had made the
       * screen worse than not having it, which is the one thing a clever step
       * may never do.
       *
       * The prompt was tightened to stop stacking terms, but a prompt is a
       * request rather than a guarantee, so this is the guarantee: if the
       * rewritten query finds nothing, the writer's own words run instead and
       * the box goes back to showing what was actually searched.
       */
      if ((data.books ?? []).length === 0 && asked !== q) {
        const plain = await fetch(`/api/comps?q=${encodeURIComponent(q)}`);
        const fallback = await plain.json();
        if (plain.ok && (fallback.books ?? []).length > 0) {
          asked = q;
          setQuery(q);
          response = plain;
          data = fallback;
        }
      }
      setBooks(data.books ?? []);
      setSummary(data.summary ?? null);
      setSources(data.sources ?? null);
      setGoogleKeyed(data.googleKeyed !== false);
      setWhy(data.why ?? null);
      // What was actually asked, which is the translated query when there was
      // one. The empty state explains a result, so it has to name the search
      // that produced it rather than the words that were typed.
      setSearched(asked);
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
    () => BROWSE_SHELVES.find((g) => query === `subject:"${g}"`) ?? null,
    [query],
  );

  const seeded = useRef(false);
  /**
   * Whether the writer has touched the box.
   *
   * The seed runs when `book` arrives, which is *after* hydration and can be
   * after somebody has started typing — the shelf is read from storage on the
   * client, so on a slow load the field is live for a moment before the effect
   * fires. Observed: a search typed and submitted, then silently replaced by
   * the seeded query, which then ran its own search. The writer's words were
   * gone and the results were for something they never asked.
   *
   * A seed is a starting point. Once there is anything of the writer's in the
   * box, there is nothing left to start.
   */
  const touched = useRef(false);
  useEffect(() => {
    if (!book || seeded.current || touched.current) return;
    seeded.current = true;
    const seed = buildQuery({
      genre: book.genre,
      blurb: book.publishing?.description,
    });
    setQuery(seed);
    void search(seed, book.genre);
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
      {/* The trail keeps the trade word, the heading asks the writer's own
          question. "Comp titles" is what this is called in the launcher and on
          a query letter, so it stays where a writer goes looking for it — but
          as the `h1` it names the thing rather than saying what the screen
          does, and somebody who does not yet know the term reads the page's
          most prominent line and learns nothing. The title check made the same
          split first: trail "Title check", heading "Is this title taken?". */}
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Comp titles"
          title="What books is yours like?"
          width="6xl"
          action={<ToolStepDone state={save} />}
        >
          {/* **The problem before the definition.** This used to open by
              defining the term — "the published books yours sits beside" —
              which only lands for somebody who already knew what a comp was
              and had therefore not come here to find out. A writer arrives at
              this screen because a form asked them a question they cannot
              answer, so the deck now opens on that form.

              Three sentences, in the order the writer meets the problem: what
              is being asked of them, how it goes wrong, what this screen hands
              back. The Tolkien line survived the rewrite because it is the one
              sentence writers repeat to each other — it names the specific
              mistake rather than warning about mistakes in general.

              Every claim in the last sentence is a thing on the page below:
              the shelf of real records, the median length, the Filed under
              row. Nothing here promises the ranking, which is gated. */}
          Every listing form and every letter to an agent asks the same thing:
          name two or three published books like yours. Most writers either do
          not know what is out there or reach for a bestseller — and a shop
          reads &ldquo;like Tolkien&rdquo; as somebody who has not looked. This
          searches two catalogues for real ones you can name, how long they
          run, and what shelf they sit on.
        </ToolHeader>
      )}

      {/* A query container, so the figures below break on the width this page
          actually has rather than on the window's — it opens in the roadmap's
          panel at about half a screen. See the note in `blurb-page.tsx`. */}
      <div className="@container mx-auto max-w-6xl px-6 pt-6 pb-16">
        {heading}

        {/* The panel draws no `ToolHeader`, and `embedded` may hide the frame
            but never a feature. */}
        {embedded && (
          <div className="-mt-2 mb-4 flex justify-end">
            <ToolStepDone state={save} />
          </div>
        )}

        {/* **A label, because the field was teaching the wrong thing.**
            The box arrived seeded and unlabelled, with a placeholder that a
            seeded field never shows — so the only instruction on screen was
            the button, and "Find comps" tells somebody who does not know the
            word nothing at all. What a writer does next is type the one thing
            they are certain of: the name of their book. That search cannot
            work, and the screen was letting them make it before saying so.

            So the instruction goes *above* the input, where it is read before
            the first keystroke rather than after the empty result. The example
            is the load-bearing half — "describe the story" is abstract until
            somebody sees the shape of an answer, and one concrete phrase
            teaches the register faster than a sentence of guidance.

            A real `<label>` rather than the `aria-label` it replaces: that
            attribute was doing this job for screen readers only, which is the
            wrong half of the audience to help when the fault is that nobody
            can see what to type. */}
        <label
          htmlFor={queryId}
          /* **An instruction, not a question.** "What is your book about?" was
             the wrong shape for a label sitting on top of an empty field: a
             question invites an answer in the writer's head, where what is
             needed is the one thing they should do next. It also duplicated
             the page's `h1`, which is already a question — two on one screen
             and neither is clearly the one being asked.

             A step under that `h1` and no further. At `text-sm` this was set
             smaller than the book titles in the results below and read as a
             field label rather than as the thing to do. */
          className="block text-lg font-semibold tracking-tight text-fg"
        >
          Type a few words about your book
        </label>
        {/* **Says what to type, not what the machine does with it.** The
            translation step is deliberately unadvertised: it needs a plan and
            a model key, so a line promising that your words become a proper
            search would be false for anyone without either — and this screen's
            free half is the part that may never come with an asterisk. The
            query it lands on is visible in the box afterwards, which is a
            demonstration rather than a claim.

            "Plain words are fine" is the sentence that earns its place now,
            because before the translation they were not fine: a sentence went
            to the catalogue verbatim and came back with a comedian's memoir.
            *Not the title* stays, since that is still the commonest mistake
            and no amount of translating fixes it. */}
        <p className="mt-1.5 mb-3 max-w-prose text-sm leading-relaxed text-muted">
          Plain words are fine — the kind of story, who it is for, where it is
          set. Not the title, though: comps are books <em>like</em> yours.
        </p>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query, book.genre);
          }}
        >
          <input
            id={queryId}
            value={query}
            onChange={(e) => {
              touched.current = true;
              setQuery(e.target.value);
            }}
            /* **The example, where it is needed and only then.** The box is
               seeded on load, so this shows the moment a writer clears it to
               type their own — which is the one instant they are looking at an
               empty field wondering what shape of thing goes in it. "Words
               that describe your book" was the old text and it restates the
               label; a worked example teaches the register instead.

               **Cleared on focus rather than left to the browser.** A native
               placeholder survives the click and only goes on the first
               keystroke, so it sits under the caret while somebody is deciding
               what to write. It comes back on blur if nothing was typed, so
               the hint is not spent by a stray click. */
            /* **Chosen by running the candidates, not by taste.** An example
               in a field is an instruction, so it has to be a search that
               actually works — measured against the live catalogues, three
               words beat a sentence and a *shape* beat a plot:

                 second chance romance  → romance novels, every one
                 witch academy          → YA fantasy novels
                 haunted house horror   → a film study and a how-to build one
                 small town murder      → The Dark Half, a comic, a computing book
                 young adult fantasy    → books *about* the genre: criticism,
                                          "Language Arts & Disciplines"

               That last row is the trap worth knowing: a bare genre name
               matches the titles of academic books written about the genre,
               because that is where those words appear as a title. What
               survives is [hook] + [genre] — narrow enough to miss the
               criticism, plain enough that a writer recognises the form and
               can copy it with their own hook. */
            placeholder={hint ? "Eg : second chance romance" : ""}
            onFocus={() => setHint(false)}
            onBlur={() => setHint(true)}
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none placeholder:text-muted/70
                       focus-visible:ring-2 focus-visible:ring-accent/50"
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
            {BROWSE_SHELVES.map((genre) => {
              const seed = `subject:"${genre}"`;
              const on = query === seed;
              return (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setQuery(seed);
                    void search(seed, book.genre);
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

        {/* Why nothing came back — see `emptyReason`. */}
        {state === "done" && books.length === 0 && (
          <p className="mt-8 max-w-prose text-muted">
            {emptyReason(searched, book.title, sources, googleKeyed, why)}
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
        {/* Gated on there being records for "these" to refer to. With none, it
            sat under "Nothing came back" and announced that the nothing was
            Open Library's records only, carrying no blurbs — describing the
            shape of an empty list. The zero case is now said once, above, and
            said as what it is: half a search. */}
        {state === "done" &&
          books.length > 0 &&
          sources &&
          (!sources.google || !sources.openLibrary) && (
            <p className="mt-3 text-xs text-muted">
              {!sources.google
                ? `Google Books did not answer, so these are Open Library’s
                   records only and carry no blurbs. It rate-limits without an
                   API key.`
                : `Open Library did not answer, so these are Google Books’
                   records only — thinner on covers, and the shelves below are
                   Google’s broad categories rather than librarians’ subjects.`}
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
 * Why nothing came back — the reason, not one line for every cause.
 *
 * This started as a single sentence ("try fewer words, or describe the story
 * rather than naming the genre") shown whatever had happened: advice about
 * naming a genre, given to somebody who had searched their own book's title,
 * under a search where the catalogues were down.
 *
 * **The load-bearing rule is that an empty result is only an answer when the
 * search actually ran.** A failure and a genuine nothing are identical in the
 * data — zero records either way — so the source flags are the only thing that
 * can tell them apart, and a screen that stays quiet about them reports an
 * outage as a fact about the world. Same rule as the title check's all-clear.
 *
 * The order matters. **Neither-answered is checked first among the failures**,
 * because the version that only asked `!sources.google` told a writer that
 * "only one of the two catalogues answered" at a moment when *none* had — a
 * sentence that is not merely unhelpful but false, and reassuringly so.
 *
 * The own-title case leads because it is a predictable dead end rather than a
 * fault: the title check next door seeds with the book's own name, so a writer
 * crossing between the two screens does the one search that cannot work.
 */
function emptyReason(
  searched: string,
  bookTitle: string,
  sources: { google: boolean; openLibrary: boolean } | null,
  googleKeyed: boolean,
  why: { google: string | null; openLibrary: string | null } | null,
): string {
  const asked = searched.trim();

  if (asked && asked.toLowerCase() === bookTitle.trim().toLowerCase()) {
    return `Nothing came back — that was this book’s own title. A comp search
            looks for books like yours, so it wants the kind of story rather
            than the name: pick a shelf above, or describe it in a few words.`;
  }

  // A quota is the one failure the button makes worse. Checked before the
  // others because it is the case where "try again" is the wrong instruction:
  // every press while limited spends the allowance the next press needs, which
  // is exactly the loop a writer falls into when the screen will not say why.
  if (why?.google === "limited" || why?.openLibrary === "limited") {
    return `Nothing came back — the catalogue is rate-limiting us, which is a
            cap on how often it will answer rather than anything to do with
            your words. Pressing again spends the same allowance, so give it a
            minute and it will come back on its own.`;
  }

  if (sources && !sources.google && !sources.openLibrary) {
    return `Neither catalogue answered, so nothing was actually searched — this
            is not an empty result, it is a failed one. Try again in a moment.`;
  }

  // Only when Google is the one missing *and* could never have answered. A
  // keyed deployment losing Google is weather; an unkeyed one loses it every
  // time, and "try again in a moment" would be a retry that cannot succeed.
  if (sources && !sources.google && !googleKeyed) {
    return `Nothing came back, and Google Books did not answer — it rate-limits
            without an API key, so only Open Library was searched. Open Library
            matches titles and shelves rather than what a book is about, so
            describing the story finds little there. Pick a shelf above.`;
  }

  if (sources && (!sources.google || !sources.openLibrary)) {
    const down = sources.google ? "Open Library" : "Google Books";
    return `Nothing came back, but ${down} did not answer — so only half the
            search ran, and this is not a reliable empty. Try again in a
            moment, or pick a shelf above.`;
  }

  return `Nothing came back for that. Try fewer words, or describe the story
          rather than naming the genre.`;
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
      <BookCover src={comp.coverUrl} />

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
