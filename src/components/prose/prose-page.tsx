"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, getBody, orderedChapters } from "@/lib/library-store";
import {
  combinedRates,
  isNotable,
  LONG_SENTENCE,
  proseReport,
  type Finding,
  type Passage,
  type ProseReport,
} from "@/lib/prose";
import { plural } from "@/lib/plural";
import { chapterText } from "@/lib/search";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";

/**
 * A report on a chapter's prose, and never an edit of it.
 *
 * The craft complaint in the research is real — *"grammar, punctuation,
 * dialogue tags/action beats"* — and so is the exhaustion beside it: *"every
 * YouTube ad is Grammarly"*, and Word's AI making a hundred and fifty
 * corrections that *"caused the writing to be more bland"*.
 *
 * So this counts and stops. It is `storeReadiness()` aimed at prose: here is
 * what is in the chapter, and the decision is yours. No score, no grade, no
 * suggested rewrite, and no button that changes a word — which is also the only
 * shape this feature can take without contradicting the assistant having no
 * write access.
 *
 * ---
 *
 * **It counts and it shows.** For a long time it only counted: "sentences over
 * 45 words" arrived with an empty example list, so the screen said three
 * existed and showed none of them, and the longest sentence was a number with
 * no sentence attached. That is the gap against every tool this one is measured
 * against — Hemingway exists to show you the sentence, and the audit reports
 * outside writing software all pair a count with the thing counted. A count a
 * writer cannot act on is trivia, and trivia is what a screen that refuses to
 * grade has instead of a grade.
 *
 * Read straight from storage rather than through a hook: this walks every
 * chapter on demand, the way `search.ts` does, and subscribing to forty bodies
 * to run a report the writer asked for once would cost more than it saves.
 */
export function ProsePage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const [chapterId, setChapterId] = useState<string | null>(null);
  /*
   * **The report is run on a press, and that is why the button exists.**
   * Counting books needs a moment to count at, and this screen had none: it
   * drew the report the instant it mounted. Marking on arrival would have made
   * the limit a limit on *visiting* — walk through six prose screens and the
   * allowance is gone without a report being read — and it would have had to
   * open `LimitDialog` from an effect, which that component's own note forbids
   * for the reason an effect fires again on every remount.
   *
   * So the press is the use. A book already counted is never asked again, so
   * this reads as a one-time button on the six books that matter and never
   * appears at all on Pro.
   */
  const [ran, setRan] = useState(false);
  /** The word being hunted, and the one control that overrides the findings. */
  const [query, setQuery] = useState("");
  /** Whether the findings this chapter is unremarkable for are shown too. */
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLElement>(null);
  const gate = useLimitGate({ action: "prose", bookId });

  /**
   * Search for a word, and go to where the answer will be.
   *
   * The search sits above the findings, so a chip pressed further down the page
   * fills a box the writer cannot see — the press looks like it did nothing.
   * `nearest` rather than `center`: if the panel is already on screen, nothing
   * should move at all.
   */
  function search(word: string) {
    setQuery(word);
    searchRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const chapters = useMemo(
    () => (book ? orderedChapters(book).filter((c) => c.words > 0) : []),
    [book],
  );

  /*
   * **Opens on the story, not on the half-title.** `chapters[0]` is whatever
   * comes first in binding order, which for any book with front matter is a
   * three-word title page — so the report opened on five words and a strip
   * with one bar in it. `createBookFromImport` already makes this exact
   * choice for the same reason when it decides where a new book lands.
   */
  const chosen =
    chapterId ??
    chapters.find((c) => !c.matter)?.id ??
    chapters[0]?.id ??
    null;

  /**
   * Whether the report may be drawn.
   *
   * Three ways in, and the second is the one that matters: a book **already**
   * among the six draws straight away, so a writer returning to a chapter is
   * never asked to press again for something they have already spent. On Pro
   * there is no limit and so no button at all.
   */
  const counted = (usePrefs().usedOn.prose ?? []).includes(bookId);
  const showing = ran || counted || gate.allowance.limit === null;

  const report = useMemo(() => {
    if (!chosen) return null;
    const chapter = chapters.find((c) => c.id === chosen);
    if (!chapter) return null;
    /* The empty title is the load-bearing argument. `chapterText` prepends
       whatever it is given, because it was written for *search*, where a
       chapter has to be findable by its name. Here the answer is a
       measurement, so a title counted as prose is simply a wrong number: a
       74-word chapter reported 76, and the average sentence length carried
       the error with it — while the picker directly above said 74. The other
       two callers that want prose rather than a search index pass "" for the
       same reason (`resume-card.tsx`, `bible-panel.tsx`). */
    return proseReport(chapterText("", getBody(chosen)));
  }, [chosen, chapters]);

  /*
   * The same counts across every chapter, so each one can be read against the
   * book it is in. Computed once for the book rather than per chapter — the
   * dependency is the chapter *list*, not the choice — and only once the report
   * is being shown at all, so a writer looking at a gated screen does not pay
   * to parse forty chapters they are not being shown.
   */
  const bookRates = useMemo(() => {
    if (!showing || chapters.length < 2) return {};
    return combinedRates(
      // "" for the title, as above: these are measurements, not a search index.
      chapters.map((c) => proseReport(chapterText("", getBody(c.id)))),
    );
  }, [showing, chapters]);

  if (!hydrated) return <LoadingScreen />;

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
    <div className="h-[var(--oc-layout-height)] overflow-y-auto bg-surface">
      {/* **The pain, not the mechanism.** "What is in the chapter, counted"
          describes what the code does, and the thing a writer arrives with is
          that they cannot read their own draft cold — the complaint every
          self-editing guide opens on, ahead of any question about adverbs.
          Counting is how this answers it; being unable to see your own chapter
          is why anybody would want it answered. */}
      <ToolHeader book={book} tool="Prose report">
        Nobody can read their own chapter cold, which is most of what makes a
        draft hard to revise. This counts what is measurably in it and sets that
        beside the rest of your book — no score, and nothing here changes a word.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {chapters.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-5 text-muted">
            Nothing written yet. There is nothing to count.
          </p>
        ) : (
          <>
            {/* **One filter row, and it used to be a wall.** The picker ran the
                full width of a 7xl page under a bold heading — eighteen hundred
                pixels of dropdown, the loudest thing on a screen where it is
                the least important. A control that scopes the page belongs on a
                row above it, at the size of the longest chapter name. */}
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="prose-chapter"
                className="text-sm font-semibold text-muted"
              >
                Chapter
              </label>
              <select
                id="prose-chapter"
                value={chosen ?? ""}
                onChange={(e) => {
                  setChapterId(e.target.value);
                  setQuery("");
                }}
                className="w-full max-w-xs rounded-lg border border-line bg-panel
                           px-3 py-2 text-sm text-fg"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {plural(c.words, "word")}
                  </option>
                ))}
              </select>

            </div>

            {!showing && (
              <section className="mt-6 rounded-xl border border-line bg-panel p-5">
                <LimitBanner allowance={gate.allowance} className="mb-4" />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!gate.spend()) return;
                      setRan(true);
                    }}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold
                               text-accent-ink hover:opacity-90"
                  >
                    Run the report
                  </button>
                  <LeftPill allowance={gate.allowance} />
                </div>
              </section>
            )}

            {showing && report && (
              <>
                <section className="mt-6 grid gap-3 sm:grid-cols-4">
                  <Stat value={report.words.toLocaleString()} label="words" />
                  <Stat
                    value={report.sentences.toLocaleString()}
                    label="sentences"
                  />
                  <Stat
                    value={String(report.averageSentence)}
                    label="words a sentence"
                  />
                  <Stat
                    value={String(report.longestSentence)}
                    label="longest sentence"
                  />
                </section>

                <Rhythm report={report} />

                <WordSearch
                  report={report}
                  query={query}
                  onQuery={setQuery}
                  panelRef={searchRef}
                />

                <Findings
                  report={report}
                  bookRates={bookRates}
                  showAll={showAll}
                  onShowAll={() => setShowAll(true)}
                  onSearch={search}
                />
              </>
            )}
          </>
        )}

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            There is no score here, and there will not be one. A number out of a
            hundred for prose is invented to look like an answer. Adverbs are not
            a fault, filter words are not a fault, and a long sentence is a style
            — these are things writers are widely advised about, and the advice
            is argued about by people who write for a living. So the count is
            not the point: the comparison with the rest of your book is, because
            it is the one thing here you cannot work out from inside the
            chapter, and so is the sentence itself, because that is the only
            level at which any of these is a decision.
          </p>
        </div>
      </div>
      {gate.dialogOpen && (
        <LimitDialog action="prose" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

/** Below this a chapter has no shape to draw — see the note in `Rhythm`. */
const MIN_FOR_RHYTHM = 5;

/**
 * Every sentence in the chapter, in the order they are read.
 *
 * **Order rather than distribution, and that is the whole choice.** A histogram
 * would say how long this chapter's sentences are; it could not say that three
 * of the long ones sit together on page four, which is the thing a writer
 * cannot see from inside the draft and the reason the shape is worth drawing at
 * all. An average of 18.9 says nothing about whether the chapter breathes.
 *
 * **Emphasis, not a ramp.** Every sentence is drawn in the de-emphasis grey and
 * only the ones over the line take the accent, which is the form for "one part
 * of this is the story and the rest is context". It ties the strip to the
 * finding below it — the same sentences, counted there and placed here — and it
 * is deliberately *not* the `stop` red: the page says in as many words that a
 * long sentence is a style rather than a mistake, and a red bar would say
 * otherwise louder than the paragraph could take back.
 */
function Rhythm({ report }: { report: ProseReport }) {
  /** Which sentence the read-out is showing, by index. */
  const [cursor, setCursor] = useState<number | null>(null);
  const { rhythm, longestSentence } = report;

  /*
   * **A shape needs enough of a chapter to have one.** Four sentences drawn as
   * four bars is not a rhythm, it is four numbers arranged awkwardly — and one
   * sentence is a single block the width of the card, which is the same
   * "one-bar chart" the writing month used to be. Below this the counts above
   * say everything there is to say, so the card stays away rather than filling
   * the space with a picture of nothing.
   */
  if (rhythm.length < MIN_FOR_RHYTHM) return null;

  const at = cursor !== null ? rhythm[cursor] : null;

  /*
   * **One tab stop, and the arrows walk it.** Making every bar focusable was
   * the obvious thing and is wrong at this length: a long chapter is three
   * hundred sentences, so it would be three hundred tab stops between the
   * picker and the findings — a keyboard user would have to hold Tab through
   * the whole chart to get past it. One stop with arrow keys is what a chart
   * this dense is supposed to do, and it means focus reaches exactly what
   * hover reaches rather than a subset of it.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    const last = rhythm.length - 1;
    const here = cursor ?? 0;
    const to =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? Math.min(last, here + 1)
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? Math.max(0, here - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (to === null) return;
    event.preventDefault();
    setCursor(to);
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-fg">Sentence rhythm</h2>
        <p className="text-xs text-muted">
          in the order they are read · left to right
        </p>
      </div>

      {/* **The bars run the width of the card**, so the axis under them
          labels the span the data actually occupies. Capping the bar width was
          tried and is worse: it drew four hundred pixels of columns inside a
          full-width row with "first" and "last" pinned to the card's edges, an
          axis labelling ground the chart did not stand on. Filling the row is
          also what makes the shape readable — the point of drawing a chapter
          in order is the silhouette, and a silhouette needs room.

          What stops a two-sentence chapter becoming one slab is
          `MIN_FOR_RHYTHM` above, which is the honest fix: too few sentences to
          have a shape means no chart, not a small chart. */}
      <div
        role="img"
        tabIndex={0}
        aria-label={`${rhythm.length} sentences in reading order, from ${Math.min(
          ...rhythm.map((s) => s.words),
        )} to ${longestSentence} words. Use the arrow keys to read each one.`}
        onKeyDown={onKeyDown}
        onFocus={() => setCursor((c) => c ?? 0)}
        onBlur={() => setCursor(null)}
        onMouseLeave={() => setCursor(null)}
        className="mt-4 flex h-24 items-end gap-px overflow-x-auto rounded-md
                   outline-none focus-visible:ring-2 focus-visible:ring-fg"
      >
        {rhythm.map((sentence, i) => (
          <span
            key={i}
            onMouseEnter={() => setCursor(i)}
            style={{
              height: `${Math.max(2, (sentence.words / longestSentence) * 96)}px`,
            }}
            /* Square at the baseline, rounded at the data end — the house spec
               for a column. `min-w` keeps a six-hundred-sentence chapter from
               collapsing into a solid block; `max-w` is the other end of the
               same problem, and the one that actually bit: bars left free to
               grow made a short chapter one slab the width of the card. A
               column has a width of its own, and a chapter with twelve
               sentences is allowed to look like twelve sentences. */
            className={`min-w-[2px] flex-1 rounded-t-[2px] ${
              i === cursor
                ? "bg-fg"
                : sentence.words > LONG_SENTENCE
                  ? "bg-accent"
                  : "bg-muted/30"
            }`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted">
        <span>first</span>
        <span>last</span>
      </div>

      {/* The read-out, which is never empty — the same pattern the writing
          calendar uses, and for the same reasons: a panel that follows the
          pointer would cover the bars either side, which are the ones being
          compared against, and a line that only appears on hover leaves a
          reader who never hovers with nothing. */}
      <p className="mt-4 min-h-[3.25rem] text-sm" aria-live="polite">
        {at ? (
          <>
            <span className="font-semibold text-fg">
              {plural(at.words, "word")}
            </span>
            <span className="text-muted"> · sentence {cursor! + 1}</span>
            <br />
            <span className="text-muted">{at.text}</span>
          </>
        ) : (
          <span className="text-muted">
            {plural(report.sentences, "sentence")}, averaging{" "}
            {report.averageSentence} words. The longest is {longestSentence}.
            {report.rhythm.some((s) => s.words > LONG_SENTENCE)
              ? " The ones over " + LONG_SENTENCE + " are picked out."
              : ""}
          </span>
        )}
      </p>
    </section>
  );
}

/**
 * What was found, loudest first — and most of it is usually not loud.
 *
 * **Everything used to be a card.** Five findings, five identical rows, one of
 * them reporting a single adverb in six hundred words at exactly the volume of
 * the one reporting a wall of forty-word sentences. A screen where everything
 * is raised has raised nothing, and it costs the writer the work of deciding
 * which row was worth their attention — which is the work the report was
 * supposed to do for them.
 *
 * So a card means *this chapter is unlike the rest of your book*, and the rest
 * become one line. Not hidden: a writer who wants the number can open it, and
 * the line names every finding it covers. Quiet is not the same as absent, and
 * the difference is what makes the cards mean something.
 */
function Findings({
  report,
  bookRates,
  showAll,
  onShowAll,
  onSearch,
}: {
  report: ProseReport;
  bookRates: Record<string, number>;
  showAll: boolean;
  onShowAll: () => void;
  onSearch: (word: string) => void;
}) {
  const notable = showAll
    ? report.findings
    : report.findings.filter((f) => isNotable(f, bookRates[f.id]));
  const quiet = report.findings.length - notable.length;

  /* Furthest from the writer's own average first — the one thing on the page
     that ranks anything, and it ranks by distance from their own habit rather
     than against a standard nobody agreed to. */
  const ranked = [...notable].sort((a, b) => {
    const gap = (f: Finding) =>
      f.per1000 !== undefined && bookRates[f.id] !== undefined
        ? f.per1000 - bookRates[f.id]
        : Infinity;
    return gap(b) - gap(a);
  });

  /* **What is not notable is not shown.** A quiet summary was tried — one line
     naming the ordinary findings with the cards folded behind it — and it was a
     fold inside a fold on a screen that already has two, which is more chrome
     than the thing it was hiding. Either a finding is worth the writer's
     attention or it is not; there is no third state that earns a row. The
     counts have not gone anywhere and come straight back the moment a chapter
     runs above its book's own rate. */
  if (ranked.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-panel p-5">
        <p className="max-w-prose text-muted">
          {report.findings.length === 0
            ? "Nothing to point at in this chapter. That is not praise — there are only six things this looks for."
            : "Nothing in this chapter stands out against the rest of your book. What was counted here, you do about as often everywhere else."}
        </p>
        {quiet > 0 && <ShowAll count={quiet} onShowAll={onShowAll} />}
      </div>
    );
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-3">
        {ranked.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            onSearch={onSearch}
            {...(bookRates[finding.id] !== undefined
              ? { bookRate: bookRates[finding.id] }
              : {})}
          />
        ))}
      </ul>
      {/* **A control, not a fold.** The findings this chapter is unremarkable
          for were hidden behind a summary line with the cards nested inside it
          — a fold inside a fold, more chrome than the thing it hid. As a button
          it is one press, it says exactly what it will show, and it disappears
          once pressed rather than becoming a permanent shut door. */}
      {quiet > 0 && (
        <div className="mt-3">
          <ShowAll count={quiet} onShowAll={onShowAll} />
        </div>
      )}
    </>
  );
}

function ShowAll({
  count,
  onShowAll,
}: {
  count: number;
  onShowAll: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onShowAll}
      className="mt-3 rounded-lg border border-line px-3.5 py-2 text-xs font-semibold
                 text-muted hover:bg-raised hover:text-fg"
    >
      Show the {count}{" "}
      {count === 1 ? "finding" : "findings"} that match the rest of your book
    </button>
  );
}

/**
 * Every sentence with one word in it.
 *
 * **The thing writers are told to do, that this screen used to send them away
 * to do.** "Targeted word searches reveal personal writing weaknesses" is the
 * standard advice for hunting your own tics — you learn that you overuse
 * "just", and then you go and look for "just". Every finding here ended at a
 * word and left the looking to the editor's search, in a different screen, in a
 * different frame of mind.
 *
 * It is also what makes the echo chips worth pressing: a repeated word is a
 * question about all of its uses at once, and this is the view of all of them.
 */
function WordSearch({
  report,
  query,
  onQuery,
  panelRef,
}: {
  report: ProseReport;
  query: string;
  onQuery: (word: string) => void;
  panelRef: React.RefObject<HTMLElement | null>;
}) {
  const term = query.trim();

  /* Whole-word, like every count on this screen: searching "her" should not
     answer with "there", or the number found would disagree with the numbers
     above it. */
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits = term
    ? report.rhythm.filter((s) => new RegExp(`\\b${safe}\\b`, "i").test(s.text))
    : [];

  return (
    /* **The box lives with its answer.** It was up in the toolbar with the
       chapter picker, which is where a *filter* belongs — but this is not a
       filter, it is a question, and the results are the reply. Sat at the top
       of the page it scrolled out of view the moment there was anything to
       read, so refining a search meant scrolling back to a control you could
       no longer see. */
    <section
      ref={panelRef}
      className="mt-6 rounded-xl border border-line bg-panel p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="prose-search" className="sr-only">
          Find a word in this chapter
        </label>
        <input
          id="prose-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find a word in this chapter…"
          className="w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2
                     text-sm text-fg placeholder:text-muted"
        />
        {term && (
          <>
            <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold text-fg">
              {hits.length}
            </span>
            <span className="text-xs text-muted">
              {hits.length === 1 ? "sentence" : "sentences"}
            </span>
            <button
              type="button"
              onClick={() => onQuery("")}
              className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs
                         font-semibold text-muted hover:bg-raised hover:text-fg"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* **Says what it is for before it is used.** An empty box with no line
          under it is a box; the reason to press it is the thing writers are
          told to do and would not guess this screen could. */}
      {!term ? (
        <p className="mt-3 max-w-prose text-sm text-muted">
          Every writer has words they lean on without knowing it. Type one and
          every sentence it appears in comes back — or press any word above.
        </p>
      ) : hits.length === 0 ? (
        <p className="mt-3 max-w-prose text-sm text-muted">
          Not in this chapter. The search covers the chapter you are looking at,
          so it may still be in another one.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {hits.map((passage, i) => (
            <PassageBlock key={i} passage={{ ...passage, mark: term }} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One finding.
 *
 * **The count sits with its label**, which sounds too obvious to write down
 * until you have seen it stranded at the far edge of an eighteen-hundred-pixel
 * card, seventeen hundred pixels from the words it belongs to. The count is the
 * finding; the label only says what was counted.
 *
 * Two columns from `lg`, because the alternative is a card the width of the
 * page holding a paragraph the width of a column and nothing else.
 */
function FindingCard({
  finding,
  bookRate,
  onSearch,
}: {
  finding: Finding;
  bookRate?: number;
  onSearch: (word: string) => void;
}) {
  const passages = finding.passages ?? [];

  return (
    <li className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="font-bold text-fg">{finding.label}</h3>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold text-fg">
          {finding.count.toLocaleString()}
        </span>
        {finding.per1000 !== undefined && (
          <span className="text-xs text-muted">
            {finding.per1000} per 1,000 words
            {/* **Against the writer's own book, which is the only honest
                comparison available.** A rate on its own is a number nobody can
                place — which is why the note under it had to spend three lines
                admitting the count means nothing by itself. Their own average
                answers the question they actually have: is this chapter unusual
                *for me*? */}
            {bookRate !== undefined && (
              <> · {bookRate} across the book</>
            )}
          </span>
        )}
      </div>

      {finding.examples.length > 0 && (
        /* Chips, not a mono run-on. These are words out of somebody's book;
           set as `font-code` in a single grey line they read as a stack
           trace. */
        /* **Pressable, because a word is a question about all of its uses.**
           A chip that only sat there left the writer to go and find the word
           themselves — which is the errand the search box now saves. */
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {finding.examples.map((example, i) => {
            const term = finding.terms?.[i] ?? example;
            return (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => onSearch(term)}
                  title={`Find every sentence with “${term}” in it`}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs
                             text-fg hover:border-fg/25 hover:bg-raised"
                >
                  {example}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* **The evidence and the reasoning are both one press away, and neither
          is in the way.** The note was three lines of standing explanation on
          every card of every chapter — read once and then furniture, taking
          more of the card than the finding it explained. Folded, the row
          becomes scannable and the writer opens the one they are actually
          weighing up. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {passages.length > 0 && (
          <Disclosure
            label={`Show ${passages.length === 1 ? "the sentence" : `the ${passages.length} sentences`}`}
            closeLabel="Hide the sentences"
          >
            <ul className="mt-3 flex flex-col gap-2">
              {passages.map((passage, i) => (
                <PassageBlock key={i} passage={passage} />
              ))}
            </ul>
          </Disclosure>
        )}
        <Disclosure label="Why this is here" closeLabel="Close">
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            {finding.note}
          </p>
        </Disclosure>
      </div>
    </li>
  );
}

/** A fold, in the one style this screen uses for both of its folds. */
function Disclosure({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group w-full">
      <summary className="w-fit cursor-pointer list-none text-xs font-semibold text-muted hover:text-fg">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">{closeLabel}</span>
      </summary>
      {children}
    </details>
  );
}

/**
 * A sentence out of the chapter, with the word it was pulled out for marked.
 *
 * The mark is the difference between evidence and a quotation: a writer
 * scanning six sentences for the filter word in each is doing the work again
 * by eye.
 */
function PassageBlock({ passage }: { passage: Passage }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-semibold text-muted">
        {plural(passage.words, "word")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-fg">
        {passage.mark ? marked(passage.text, passage.mark) : passage.text}
      </p>
    </li>
  );
}

/**
 * The sentence with every occurrence of one word picked out.
 *
 * Split rather than `dangerouslySetInnerHTML`: this is the writer's own prose
 * and it goes on screen as text, never as markup. `mark` comes from our own
 * word lists, but the sentence around it does not.
 */
function marked(text: string, word: string): React.ReactNode {
  const parts = text.split(new RegExp(`\\b(${word})\\b`, "gi"));
  return parts.map((part, i) =>
    part.toLocaleLowerCase() === word.toLocaleLowerCase() ? (
      <strong key={i} className="font-semibold text-fg underline decoration-accent decoration-2 underline-offset-2">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xl font-extrabold text-fg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
