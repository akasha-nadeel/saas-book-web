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
  type CompTitle,
} from "@/lib/comps/comps";
import { looksPlain } from "@/lib/comps/query";
import { subjectParts } from "@/lib/comps/subjects";
import {
  openingFrom,
  proseFrom,
  restOf,
  type RankedComp,
} from "@/lib/comps/rank";
import { plural } from "@/lib/plural";
import { toBlocks } from "@/lib/export/blocks";
import {
  chapterMatterOf,
  findBook,
  getBody,
  orderedChapters,
} from "@/lib/library-store";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { setPref } from "@/lib/library-store";
import { ViewMenu } from "@/components/ui/view-menu";
import {
  isGrid,
  resultsGridClass,
  type ShelfLayout,
} from "@/lib/shelf-layout";
import { COMPS_RANKING_LIVE } from "@/lib/launch";
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
   * **There is no "Mark step done" here any more, and no `useToolSave`.**
   *
   * It ticked "Find your comp titles" on the publishing roadmap — a step with
   * no detector, because nothing in a library records which two comps a writer
   * settled on. That reasoning still holds and the machinery is untouched
   * (`use-tool-save.ts`, `tool-steps.ts`, `ToolStepDone` are all still there);
   * what changed is that the roadmap is in `HIDDEN_BOOK_TOOL_PATHS`, so the
   * button ticked a step on a screen nobody can open and then said so in a
   * tooltip pointing at it.
   *
   * It comes back with the road, and restoring it is three edits: this hook,
   * the `action` on the header, and the row under it — all three, or the
   * control exists in one frame and not the other.
   */

  /* Generated, not a literal: the roadmap mounts this tool in a panel, so the
     page can hold this screen and the road at once and a hard-coded id would
     be a duplicate the label points at by chance. */
  const queryId = useId();

  /* Shared with the title check — one answer to "how do I want found books
     drawn", not one per screen, or the segmented control between them would
     appear to change the setting. */
  const layout = usePrefs().researchLayout;

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
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
    /* **The translation is skipped outright while the model routes are gated**,
       rather than left to fail into the catch below. The catch is still the
       right behaviour and stays — a translation that errors must never cost a
       writer their search — but firing a request we already know answers 404,
       on every search, is a round trip spent to reach a `catch` block. The flag
       is the one place that knows; see `COMPS_RANKING_LIVE`. */
    if (COMPS_RANKING_LIVE && looksPlain(q)) {
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

  /**
   * The free plan's ten comp searches.
   *
   * **Only a search the writer asked for is counted.** The seed below runs on
   * arrival, and charging for that would spend the ten on ten visits — a limit
   * on opening the screen rather than on searching it. So `ask` is what the
   * button and the shelf chips call, and the seed keeps calling `search`.
   */
  const gate = useLimitGate({ action: "comps" });
  const comps = gate.allowance;
  const ask = useCallback(
    (q: string, genre?: string) => {
      // Refused rather than disabled: the eleventh press is what puts the
      // banner and the dialog on screen. See `useLimitGate`.
      if (!gate.spend()) return;
      void search(q, genre);
    },
    [gate, search],
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
          return found && p.reason ? [{ book: found, reason: p.reason }] : [];
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
    return embedded ? (
      <div className={toolShell(embedded)} />
    ) : (
      <LoadingScreen />
    );

  if (!book) {
    return (
      <div className="grid h-[var(--oc-layout-height)] place-items-center bg-surface p-8 text-center">
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
          width="7xl"
          /* Two sentences, which is what a deck running the header's full
             width has to be. It was five lines in a narrow column beside an
             empty half-header — the shape a deck takes when it is written
             long. Shortened first: the aside about reaching for a bestseller
             was the best-written part of it and the least useful, since the
             two shelves below make the same point by showing it. */
        >
          {/* **The problem before the definition.** This used to open on what
              a comp title *is*, which is a definition read by somebody who
              does not yet know why they should care. The listing form asking
              for it is the reason they are here. */}
          Every listing form and every letter to an agent asks for two or three
          published books like yours. This finds real ones you can name — how
          long they run, and what shelf they sit on.
        </ToolHeader>
      )}

      {/* A query container, so the figures below break on the width this page
          actually has rather than on the window's — it opens in the roadmap's
          panel at about half a screen. See the note in `blurb-page.tsx`. */}
      <div className="@container mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {/* ---- The bench, and everything it produces --------------------

            **One box: the shelves, the box you type in, and the books.** They
            were three things loose on the band with nothing saying where the
            controls ended and the results began — and the covers, which are
            the answer, read as a separate page that happened to be underneath.
            Boxed together they read as one instrument: choose a shelf or
            describe the book, and what comes back is *inside* the same frame.

            **The shelves come first, and that is the argument.** A writer who
            knew what to type would not be on this screen; the useful move for
            everybody else is to walk a shelf and see what is on it. The box is
            second because it is the refinement, and it sits directly above the
            covers it produces, which is where every shop that sells books puts
            its search.

            What is *not* in here is the arithmetic below — median pages, the
            subjects, the length reading. Those are readings *of* the shelf and
            they keep their own cards, or this box would be the whole page and
            stop meaning anything. */}
        <section className="rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
          {/* ---- Whose book, and which search ---------------------------

              **The caller's own chrome, inside the instrument rather than
              stacked above it.** `heading` has always been drawn "in the page
              rather than on a bar above it"; the dashboard's Research area
              passes the book chip and the two-way switch down through it, and
              they belong in the same frame as the field they act on. A chip, a
              toggle and then the search, as three boxes down the screen, read
              as three separate things when they are one question asked in
              three parts.

              The rule under it is the only thing this file adds. Nothing at
              all is drawn when no heading is passed, which is every use of
              this screen as a whole window. */}
          {heading && (
            <div className="mb-5 border-b border-line pb-5">{heading}</div>
          )}

          {/* **The shelves live in the box now.** They were a section of their
              own under it — a heading, a caption and twenty-six chips — which
              asked the same question the box asks and pushed the covers a
              third of a page down. Why they exist has not changed: a writer
              who does not know what their book sits beside is exactly the
              writer this screen is for, and the useful move for them is to
              walk a shelf rather than phrase a better query. See `SearchBox`
              for how the two fit in one control. */}
          <label
            htmlFor={queryId}
            /* **What the screen is for, then what to do about it** — and it
               has to be both, because in the dashboard's Research area this is
               the only heading the card has. `ToolHeader` carries the page's
               question when the tool owns the window; embedded it is
               suppressed, so a line reading only "Type a few words about your
               book" left a first-time writer with an instruction and no idea
               why they were following it.

               The need first and the action second. "Agents and shops ask for
               books like yours" is the reason anybody is on this screen — it
               is a field on a form they are already staring at — and "find
               them" is the one thing to do next. An em dash rather than a
               comma: they are two complete clauses, and a comma between them
               is a splice.

               Still the field's `<label>`, so the box below keeps a proper
               accessible name; the sentence under it says what to type. */
            className="block text-lg font-semibold tracking-tight text-fg"
          >
            Agents and shops ask for books like yours &mdash; find them.
          </label>

          {/* **Says what to type, not what the machine does with it.** The
              translation step is deliberately unadvertised: it needs a plan
              and a model key, so a line promising that your words become a
              proper search would be false for anyone without either — and this
              screen's free half is the part that may never come with an
              asterisk. The query it lands on is visible in the box afterwards,
              which is a demonstration rather than a claim. */}
          <p className="mt-1.5 mb-3 max-w-prose text-sm leading-relaxed text-muted">
            Plain words are fine — the kind of story, who it is for, where it is
            set. Not the title, though: comps are books <em>like</em> yours.
          </p>

          <SearchBox
            id={queryId}
            value={query}
            onChange={(next) => {
              touched.current = true;
              setQuery(next);
            }}
            onSearch={(q) => ask(q, book.genre)}
            busy={state === "loading"}
          />

          {/* What is *on screen*, not what the book says it is. This read
              "Showing Mystery, from this book's genre" while the Fantasy shelf
              was open, because it was written from `book.genre` and the genre
              never changes. A caption that contradicts the covers under it is
              worse than no caption: the reader has to work out which of the two
              is lying. */}
          <p className="mt-2 text-sm text-muted">
            {shownShelf
              ? `Showing ${shownShelf}${
                  shownShelf === book.genre
                    ? `, from this book’s genre${book.publishing?.description ? " and blurb" : ""}`
                    : ""
                }.`
              : book.genre
                ? "Searching your own words."
                : "This book has no genre set, so nothing is chosen for you."}
          </p>

          {/* The count, and nothing while there is plenty left. */}
          <LeftPill allowance={comps} className="mt-2" />

          {/* True of the shelves too: they are searches, and they go with it. */}
          <LimitBanner allowance={comps} refused={gate.refused} className="mt-5" />

          {/* ---- What came back ---------------------------------------- */}
          <div className="mt-7 border-t border-line pt-7">
            {error && (
              <p className="rounded-lg border border-line bg-panel p-4 text-sm text-fg">
                {error}
              </p>
            )}

            {/* The shelf loads on arrival, so the wait is the first thing anybody
                sees — and an empty page for two seconds reads as broken on a screen
                most writers have never opened before. Shaped like the rows that
                replace them, so nothing jumps when they do. */}
            {state === "loading" && (
              /* The same class the answer will take, so nothing jumps when the
                 covers land — including in List, where a column of placeholder
                 jackets would be a wait shaped like the wrong answer. */
              <ul className={resultsGridClass(layout)} aria-hidden>
                {Array.from({ length: 10 }, (_, i) =>
                  isGrid(layout) ? (
                    <li key={i} className="animate-pulse">
                      <div className="aspect-[2/3] w-full rounded-lg bg-raised" />
                      <div className="mt-2 h-3.5 w-4/5 rounded bg-raised" />
                      <div className="mt-1.5 h-3 w-3/5 rounded bg-raised" />
                    </li>
                  ) : (
                    <li key={i} className="flex animate-pulse items-center gap-3 py-2">
                      <div className="h-12 w-8 shrink-0 rounded bg-raised" />
                      <div className="h-3.5 w-1/3 rounded bg-raised" />
                    </li>
                  ),
                )}
              </ul>
            )}

            {/* Only reachable when the book had nothing to seed a search with, now
                that arriving runs one. The shelves above are the way out of it, so
                this is a line rather than the essay that used to sit here. */}
            {state === "idle" && (
              <p className="text-muted">
                Pick a shelf above to see what is on it, or describe your story
                in the box.
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
              <p className="max-w-prose text-muted">
                {emptyReason(searched, book.title, sources, googleKeyed, why)}
              </p>
            )}

            {/* ---- The ranking card, and why it may not be here -------------

                `ResultsBar` is the whole model half of this screen: "Rank
                these", its disabled states, and the paragraph naming the prose
                that press would send. `/api/comps/rank` is still gated, so with
                the card drawn the only thing that button could do is fail —
                which is the dead UI the house rules refuse. One flag hides the
                card; nothing below it is touched, and `ResultsBar`, `rank()`,
                `picks` and `pattern` are all still here, finished and tested,
                for the day `COMPS_RANKING_LIVE` goes true.

                What is left is the search, which is the free half and the
                larger one: the shelf of covers, the median length, the subject
                counts and the two catalogues' own account of themselves. */}
            {COMPS_RANKING_LIVE && books.length > 0 && (
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

            {/* ---- How the wall is drawn --------------------------------

                Over the covers rather than up beside the search box: it acts
                on what came back, and a control for the answer belongs with
                the answer. Only once there is something to redraw — a View
                menu above an empty page is a setting for nothing. */}
            {books.length > 0 && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {plural(books.length, "book")}
                </p>
                <ViewMenu
                  value={layout}
                  onChange={(next) => setPref("researchLayout", next)}
                />
              </div>
            )}

            {picks && picks.length > 0 && (
              <CompGrid
                comps={picks.map((p) => p.book)}
                reasons={picks}
                layout={layout}
              />
            )}

            {books.length > 0 && (
              <>
                {picks && picks.length > 0 && (
                  <h2 className="mt-10 text-sm font-bold text-fg">
                    The rest of what came back
                  </h2>
                )}
                <CompGrid
                  comps={picks ? restOf(books, picks) : books}
                  layout={layout}
                />
              </>
            )}
          </div>
        </section>
        {/* ---- What the shelf added up to, and why it is gone -------------

            Three figure cards — median pages, median blurb characters, Filed
            under — and a length panel that read them back as a word range with
            a "Set my target" button under it.

            They were readings *of* the covers and they took up more of the
            screen than the covers did, on a page whose one question is what
            this book sits beside. The shelf is the answer to that; the
            arithmetic was a second screen underneath it, answering a question
            nobody had reached yet.

            `lib/comps/length.ts` is untouched, pure and still tested — it is
            what this would be rebuilt from, and TODO.md records the trade. The
            one loose end is `checkup.ts`'s "No length to aim at" finding, whose
            fix routes here for a button that is no longer on the page.
        ---------------------------------------------------------------- */}

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

      {gate.dialogOpen && (
        <LimitDialog action="comps" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

/**
 * The search box, with the shelves inside it.
 *
 * **They used to be a second section and that was one section too many.** A
 * heading, a caption and twenty-six chips sat under the box doing the same job
 * it does — starting a search — so the screen asked the same question twice,
 * and the covers, which are the answer, were pushed a third of a page further
 * down. One control, two ways to fill it: type your own words, or open it and
 * take a shelf.
 *
 * This is the shape every large site gives a search that has a known set
 * behind it. Four behaviours are what make it feel like one rather than a
 * novelty, and all four are here:
 *
 * - **Opening it shows the whole list**, not a filtered one, and shows it
 *   *all at once*. A writer who has already picked Fantasy and comes back to
 *   change it must see the other twenty-five; a box that filtered itself down
 *   to the current answer would be a dead end, so a value that *is* a shelf
 *   query filters nothing and marks itself instead. Twenty-six rows in one
 *   column is nine hundred pixels of scrolling, which is a list you read
 *   rather than a set you choose from — so they go in columns, the way a
 *   category menu on a large site does, and the whole set is on screen.
 * - **Typing filters, and never blocks.** Words that match no shelf leave the
 *   writer's own row as the only one, and Enter searches them. The suggestions
 *   help; they do not gate — the same rule the category box follows, and for
 *   the same reason: this box's whole job is the search nobody has a shelf for.
 * - **The keyboard works.** Down and up move, Enter takes the highlighted row
 *   or the writer's own words when none is highlighted, Escape closes.
 * - **A pick fills the box; it does not search.** Picking and searching are
 *   two decisions, and running one on a click means a writer who opened the
 *   list to *look* at the shelves has spent a search by browsing. It also
 *   makes the row and the button disagree about who is in charge. So a pick
 *   writes the query into the field, closes the list and leaves the caret
 *   there; Find comps is what runs it, in both directions.
 *
 * `onMouseDown` rather than `onClick` on the rows, because the input's blur
 * fires first and would close the list out from under the click.
 */
function SearchBox({
  id,
  value,
  onChange,
  onSearch,
  busy,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Runs a search. A shelf arrives here as its whole `subject:"…"` query. */
  onSearch: (query: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState(true);

  /** The shelf this query *is*, when it is one. */
  const chosen = BROWSE_SHELVES.find((g) => value === `subject:"${g}"`) ?? null;

  // A value that is already a shelf filters nothing — see the note above.
  const typed = chosen ? "" : value.trim();
  const shelves = typed
    ? BROWSE_SHELVES.filter((g) =>
        g.toLowerCase().includes(typed.toLowerCase()),
      )
    : BROWSE_SHELVES;

  /* The writer's own words first, whenever they are not already the name of a
     shelf — the row that keeps this a search box rather than a menu. */
  const own =
    typed &&
    !BROWSE_SHELVES.some((g) => g.toLowerCase() === typed.toLowerCase())
      ? typed
      : null;

  const rows: { query: string; label: string; shelf: boolean }[] = [
    ...(own ? [{ query: own, label: own, shelf: false }] : []),
    ...shelves.map((g) => ({ query: `subject:"${g}"`, label: g, shelf: true })),
  ];

  const showing = open && rows.length > 0;

  /** Fill the box with a row's query and close. Never searches — see above. */
  function take(query: string) {
    onChange(query);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (showing && active >= 0) take(rows[active].query);
          else onSearch(value);
        }}
      >
        <input
          id={id}
          /* **The shelf's name, not the query it stands for.** A writer who
             picks Self-help should see `Self-help`, not `subject:"Self-help"`
             — the second is our syntax leaking into their field, and it makes
             a plain box look like one that wants a language. The query is
             still what gets searched and still what the caption reports; only
             a value that *is* a known shelf is shown by its name, and the
             first keystroke replaces it with the writer's own words, exactly
             as before. */
          value={chosen ?? value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => {
            setHint(false);
            setOpen(true);
          }}
          // Deferred past the click on a row that would otherwise never land.
          onBlur={() => {
            setHint(true);
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!showing) {
                setOpen(true);
                return;
              }
              setActive((i) =>
                e.key === "ArrowDown"
                  ? (i + 1) % rows.length
                  : i <= 0
                    ? rows.length - 1
                    : i - 1,
              );
            }
          }}
          role="combobox"
          aria-expanded={showing}
          aria-controls="comp-shelves"
          aria-autocomplete="list"
          /* **Chosen by running the candidates, not by taste.** An example in a
             field is an instruction, so it has to be a search that actually
             works — measured against the live catalogues, three words beat a
             sentence and a *shape* beat a plot:

               second chance romance  → romance novels, every one
               witch academy          → YA fantasy novels
               haunted house horror   → a film study and a how-to build one
               small town murder      → The Dark Half, a comic, a computing book
               young adult fantasy    → books *about* the genre: criticism,
                                        "Language Arts & Disciplines"

             That last row is the trap worth knowing: a bare genre name matches
             the titles of academic books written *about* the genre. What
             survives is [hook] + [genre] — narrow enough to miss the criticism,
             plain enough that a writer recognises the form and can copy it.

             Cleared on focus rather than left to the browser: a native
             placeholder survives the click and only goes on the first
             keystroke, so it would sit under the caret while somebody is
             deciding what to write. */
          placeholder={
            hint ? "Eg : second chance romance — or pick a shelf" : ""
          }
          className="min-w-[16rem] flex-1 rounded-lg border border-line bg-raised px-4 py-2.5
                     text-fg outline-none placeholder:text-muted/70
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        />
        <button
          type="submit"
          // Never disabled by the limit: an eleventh press is the only
          // moment there is anything to say about it.
          disabled={busy || value.trim().length < 2}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "Looking…" : "Find comps"}
        </button>
      </form>

      {showing && (
        <div
          id="comp-shelves"
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-lg border border-line
                     bg-panel p-1.5 shadow-lg"
        >
          {/* The writer's own words, full width above the columns: it is a
              different kind of row and reads as one. */}
          {own && (
            <div role="option" aria-selected={active === 0}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  take(rows[0].query);
                }}
                onMouseEnter={() => setActive(0)}
                className={`mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2
                            text-left text-sm ${
                              active === 0 ? "bg-raised text-fg" : "text-fg"
                            }`}
              >
                <span className="min-w-0 truncate">
                  Search <span className="font-medium">{own}</span>
                </span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-1 @xl:grid-cols-3">
            {rows.map((row, i) =>
              row.shelf ? (
                <div key={row.query} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      take(row.query);
                    }}
                    onMouseEnter={() => setActive(i)}
                    /* Tighter rows than a one-column list would take: nine rows
                     of three have to fit under the field without the page
                     scrolling, or "all of them at once" is not true. */
                    className={`flex w-full items-center justify-between gap-2 rounded-md
                            px-2.5 py-1.5 text-left text-sm ${
                              i === active ? "bg-raised text-fg" : "text-fg"
                            }`}
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    {row.label === chosen && (
                      <span className="shrink-0 text-xs text-accent">
                        Showing
                      </span>
                    )}
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
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
    // No top margin: the section this sits in provides its own.
    <div>
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
  layout,
}: {
  comps: CompTitle[];
  reasons?: RankedComp[];
  layout: ShelfLayout;
}) {
  const reasonFor = new Map((reasons ?? []).map((r) => [r.book.key, r.reason]));

  return (
    <ul className={`mt-4 ${resultsGridClass(layout)}`}>
      {comps.map((comp) => (
        <CompCard
          key={comp.key}
          comp={comp}
          reason={reasonFor.get(comp.key)}
          layout={layout}
        />
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
function CompCard({
  comp,
  reason,
  layout,
}: {
  comp: CompTitle;
  reason?: string;
  layout: ShelfLayout;
}) {
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

  const inner = isGrid(layout) ? (
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
  ) : (
    /**
     * The same record lying down.
     *
     * **A branch, not a second component.** Both show the same five things —
     * jacket, shelf, title, author, year and length — and two components would
     * be two places to add the sixth. What differs is the arrangement; the
     * link, the drawn missing cover and the ranked reason are shared.
     *
     * The small print runs on one line rather than stacking, because a column
     * of three-line entries is a one-column grid. This mode exists to put more
     * titles on the screen at once, and the author and the shelf drop out as
     * the container narrows rather than wrapping the row to two lines.
     */
    <span className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised">
      <span className="w-8 shrink-0">
        <BookCover src={comp.coverUrl} />
      </span>
      <span className="min-w-0 flex-[2] truncate text-sm font-bold text-fg">
        {comp.title}
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-muted @sm:block">
        {comp.authors.join(", ")}
      </span>
      <span className="hidden shrink-0 truncate text-[0.625rem] tracking-[0.08em] text-muted uppercase @lg:block">
        {filed}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {[comp.year, comp.pageCount ? `${comp.pageCount}pp` : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
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

/*
 * **`LengthPanel` and `Figure` were here, and both went on 2026-09-02.**
 *
 * They drew the block below the covers — three figures with their
 * denominators, and a word range read off the median page count with a
 * "Set my target" button under it. See the note at their old call site for
 * why: they were a second screen of arithmetic under the one screen this
 * page is for.
 *
 * Deleted rather than left callerless, because the *reasoning* worth keeping
 * is in `lib/comps/length.ts` — pure, tested, and still here — rather than in
 * the markup that printed it. The rule they were built on is the one to
 * rebuild from: the folklore number is shown beside the counted one rather
 * than replaced by it, and "under" and "over" are positions, never verdicts.
 */
