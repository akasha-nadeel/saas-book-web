"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { BookCover } from "@/components/ui/book-cover";
import { Spinner } from "@/components/ui/spinner";
import { BROWSE_SHELVES, type CompTitle } from "@/lib/comps/comps";
import {
  findClashes,
  suggestSpelling,
  titleKey,
  type TitleClash,
} from "@/lib/comps/title-check";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, setPref } from "@/lib/library-store";
import { useHydrated, usePrefs, useShelf } from "@/lib/use-library";
import { ViewMenu } from "@/components/ui/view-menu";
import {
  isGrid,
  resultsGridClass,
  type ShelfLayout,
} from "@/lib/shelf-layout";
import { toolShell, type ToolPageProps, toolMeasure } from "@/lib/tool-page";

/**
 * Whether anything is already published under this title.
 *
 * **The answer is never yes or no, and the page says so.** Book titles are not
 * trademarks and cannot be copyrighted, so nothing here is about permission.
 * What a writer actually wants to know is whether they are publishing into a
 * shadow — whether searching their title brings back somebody else's book
 * first, and whether that book is big enough that theirs will never be found.
 *
 * So it shows what is out there and grades how close each one is. It does not
 * advise, because the same fact means different things: sharing a title with an
 * obscure book from 1974 is nothing, and sharing one with a bestseller in the
 * same genre is a real problem, and the writer can tell which of those they are
 * looking at faster than any rule we could write.
 */
/**
 * **`bookId` is optional here, where every other tool requires one**, and the
 * difference is the whole design of this screen since 2026-09-03: it checks
 * *any* title, not this writer's.
 *
 * It used to open holding `book.title`, fill its empty state with covers from
 * `book.genre`, and offer to rename the book from the result. All three are
 * gone. What is left needs nothing but the words in the box, so the dashboard
 * mounts it with no book at all.
 *
 * The book is still read when an id is given, for exactly one thing — the
 * breadcrumb and cover chip `ToolHeader` draws at `/book/<id>/title-check`.
 * That is frame, not feature, so the two ways in still show the same screen
 * below the header and `embedded` keeps meaning only what it has always meant.
 *
 * A component taking `bookId?: string` is assignable wherever `ToolPageProps`
 * is expected, so the roadmap's registry needs no change.
 */
/**
 * A shelf to browse while the box is empty.
 *
 * **A function rather than an expression in the effect**, so the effect body
 * contains no branch and no `setState`: an index into a constant is
 * `string | undefined` to the compiler, and guarding that inline meant clearing
 * the loading flag synchronously, which `react-hooks/set-state-in-effect`
 * rightly refuses. `BROWSE_SHELVES` is a non-empty literal, so the fallback is
 * unreachable and exists only to make the type definite.
 */
function randomShelf(): string {
  const i = Math.floor(Math.random() * BROWSE_SHELVES.length);
  return BROWSE_SHELVES[i] ?? BROWSE_SHELVES[0] ?? "Fiction";
}

export function TitleCheckPage({
  bookId,
  embedded,
  heading,
}: Omit<ToolPageProps, "bookId"> & { bookId?: string }) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = bookId ? findBook(shelf, bookId) : null;

  /* Shared with the comps screen — see the note on `researchLayout`. The two
     are switched between by one control, so one setting between them. */
  const layout = usePrefs().researchLayout;

  const [title, setTitle] = useState("");
  const [clashes, setClashes] = useState<TitleClash[] | null>(null);
  /** How many records the two catalogues actually handed over. */
  /**
   * Which catalogues answered.
   *
   * Load-bearing rather than decorative. A failed search returns no records,
   * and no records rendered as **"Nothing published under this name — a good
   * sign"**: a confident all-clear produced by a search that never ran. Open
   * Library answering 503 for a few minutes was enough to tell a writer their
   * title was free when it is on the shelf directly below.
   */
  const [sources, setSources] = useState<{
    google: boolean;
    openLibrary: boolean;
  } | null>(null);

  /**
   * What the sweep actually read, and what the catalogue says is there.
   *
   * **Kept because the honest sentence needs both numbers.** The sweep reads
   * 500 Open Library records of a reported 4,072 for a name like "spiderman" —
   * more than enough to be useful and nowhere near the shelf. Printing "12
   * books share your title" off that is a count of a sample presented as a
   * count of the world, which is the invented number this app refuses
   * everywhere else. So the screen says how many it read and how many exist,
   * and lets the writer put the two together.
   */
  const [depth, setDepth] = useState<{
    scanned: number;
    reported: number | null;
  } | null>(null);

  /** Set when a catalogue refused our API key, which is nobody's weather. */
  const [keyRefused, setKeyRefused] = useState(false);

  /**
   * A published title the writer may have been reaching for, or null.
   *
   * Only ever set when a check found **nothing at all**, and only ever a title
   * a catalogue handed back. See `suggestSpelling`.
   */
  const [suggestion, setSuggestion] = useState<string | null>(null);

  /**
   * Real published titles to look at while the box is still empty.
   *
   * **The screen used to answer an empty box with half a page of nothing.**
   * This is a naming screen, and the most useful thing to look at while
   * deciding on a name is what real books are actually called — so the space
   * carries that instead of an apology. They are **not** clashes, and the line
   * above them says so; nothing here has been compared to anything.
   *
   * **The shelf is picked at random, and it used to be the book's own genre.**
   * With no book there is no genre to ask for. A fixed shelf would be this
   * app choosing somebody's neighbourhood for them, and would show every
   * writer the same thirty covers for ever; a random one is plainly a sample,
   * changes on every visit, and is named on screen so nobody mistakes it for
   * a search they ran.
   */
  const [genreShelf, setGenreShelf] = useState<CompTitle[]>([]);
  const [shelfName, setShelfName] = useState<string | null>(null);
  /**
   * The title the result on screen belongs to.
   *
   * Without it the answer outlives its question: check a title, clear the box,
   * and "Nothing came back under that name" sits under an empty field, naming
   * a title that is no longer anywhere on screen. The result is not wrong —
   * it is unattached, which is worse, because there is nothing to tell the
   * reader it is stale.
   */
  const [checked, setChecked] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * The free plan's five tooled books.
   *
   * **Checking is unlimited; what is limited is books.** Naming is the most
   * iterative thing this app does — type a title, read the shelf, change one
   * word, try again — and the per-search meter this replaced ran out in the
   * middle of exactly that. The gate now refuses nothing on a book already
   * being worked on, so a writer is only ever stopped when they open the tools
   * on a *sixth* manuscript.
   */
  const gate = useLimitGate({ action: "titleCheck" });
  const checks = gate.allowance;
  /**
   * The title whose finding has been closed.
   *
   * The title rather than a boolean, so closing one does not silence the next:
   * a new check writes a new `checked`, which no longer matches this, and the
   * banner comes back on its own.
   */
  const [dismissed] = useState<string | null>(null);

  /**
   * The browsing shelf, fetched once on arrival.
   *
   * **The random pick happens in the effect, not in a `useState` initialiser**,
   * and that is not a style choice: this screen is server-rendered at
   * `/book/<id>/title-check`, so a `Math.random()` read during the first render
   * would give the server one shelf and the browser another, and React would
   * report a hydration mismatch. An effect runs on the client only, after the
   * markup has settled.
   *
   * A shelf that will not load leaves the space as it was. Nothing on this
   * screen depends on it.
   */
  const askedShelf = useRef(false);
  const [shelfLoading, setShelfLoading] = useState(true);
  useEffect(() => {
    if (askedShelf.current) return;
    askedShelf.current = true;

    const shelf = randomShelf();

    /* **`sweep=1`, the same five-page fetch a check runs.** One page is 40 per
       source and about 55 once merged and de-duplicated, which is not a
       hundred. The sweep is cached per URL for a day and there are only two
       dozen shelves, so the second writer onto a given one pays nothing.
       Measured: a subject sweep returns 500 Open Library records, every one
       with an author and a cover, before Google is merged in. */
    void fetch(`/api/comps?sweep=1&q=${encodeURIComponent(`subject:"${shelf}"`)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        /* **A hundred, out of the several hundred the sweep returns.** This is
           a shelf to browse rather than a figure to read, so the number is
           chosen for the eye: enough that it reads as a wall of what is out
           there rather than a sample, and short of the point where nobody
           reaches the end. The View menu is there for anybody who wants them
           denser, and the caption says how many there are. */
        if (!data) return;
        const books = ((data.books ?? []) as CompTitle[]).slice(0, 100);
        if (books.length === 0) return;
        setGenreShelf(books);
        setShelfName(shelf);
      })
      .catch(() => {
        // Nothing to say: the box is still there and still works.
      })
      /* Cleared either way. A shelf that will not load leaves the space as it
         was — which means the placeholders have to stop, or a failed fetch
         would pulse under the box for ever. */
      .finally(() => setShelfLoading(false));
  }, []);

  /*
   * **The box opens empty, and nothing is searched on arrival.**
   *
   * It used to arrive holding `book.title`. The older rule it replaced is the
   * one still worth keeping: the screen must not arrive having already
   * *checked*. A verdict nobody asked for is the loudest thing on the page —
   * a green bar declaring a name clear, or a red one, delivered before the
   * reader has decided they were asking — and an answer to an unasked question
   * reads as a claim rather than a result.
   *
   * Seeding the field survived that as the harmless half. It does not survive
   * a checker with no book: there is no one title it could mean. A placeholder
   * says what to type instead, which is the honest version of the same help.
   */

  /*
   * **No "Mark step done", and no `useToolSave` behind it.**
   *
   * It ticked "Check the title" on the publishing roadmap, and the reasoning
   * for that step having no detector still stands — this screen stores no
   * result and changes no field, because a checked title is a thing the writer
   * now *knows*. What changed is that the roadmap is in
   * `HIDDEN_BOOK_TOOL_PATHS`: the button ticked a step on a screen nobody can
   * open, and its own tooltip pointed at that screen.
   *
   * It comes back with the road. See the same note in `comps-page.tsx`.
   */

  async function check(candidate: string) {
    if (candidate.trim().length < 2) return;
    setState("loading");
    setError(null);
    // Belongs to the search that produced it, like `clashes`.
    setSuggestion(null);
    try {
      // Searched as the title itself, unlike every other screen here — the
      // comps query deliberately leaves the writer's title out, because comps
      // are books *like* yours. This is the one question where finding a book
      // with the same name is the whole point.
      /* **`sweep=1`, and this screen is the only one that sends it** — twice,
         here and for the browsing shelf above, and for different reasons.
         Here it is correctness: one page of forty is an arbitrary sample,
         because neither catalogue orders by title match, so the records that
         come back first are not the ones sharing the name. Measured on Open
         Library for "spiderman" — 4,072 records reported — forty found 2 exact
         matches and five hundred found 12. Comps stays shallow on purpose; see
         `SWEEP_PAGES` in the route for why the two screens want opposite
         things. */
      const asked = candidate.trim();
      const response = await fetch(
        `/api/comps?sweep=1&q=${encodeURIComponent(`intitle:"${asked}"`)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }

      let books = (data.books ?? []) as CompTitle[];
      let scanned = typeof data.scanned === "number" ? data.scanned : 0;

      /* ---- The same name, spelled without the gaps ----------------------

         **A phrase query does not find a title that is written as one word.**
         `titleKey` makes "grand father" and "Grandfather" compare equal, and
         that alone changes nothing here, because the one-word records are
         never fetched: `title:"grand father"` returns 58 records and Open
         Library holds 3,383 under `title:"grandfather"`, three of them titled
         exactly that. Measured 2026-09-03. So the comparison needs the records
         as much as the records need the comparison.

         **Only when it can change the answer.** A title with no space has no
         joined form to try, and a search that already found an exact match has
         nothing to gain — "salt and pepper" comes back with sixteen and this
         never fires. That keeps the ordinary check at one sweep.

         **It works one way, and that is a limit rather than an oversight.**
         Given "Grandfather" there is no way to guess where a split belongs, so
         a writer who types the joined spelling is not shown the spaced one.
         Splitting would need a dictionary and would invent boundaries the
         writer did not.

         A second sweep that fails costs nothing: the first result stands. */
      const joined = asked.replace(/\s+/g, "");
      const noneExact = !books.some((b) => titleKey(b.title) === titleKey(asked));

      if (joined !== asked && joined.length >= 2 && noneExact) {
        try {
          const alt = await fetch(
            `/api/comps?sweep=1&q=${encodeURIComponent(`intitle:"${joined}"`)}`,
          );
          if (alt.ok) {
            const more = await alt.json();
            const extra = (more.books ?? []) as CompTitle[];
            if (extra.length > 0) {
              /* Keyed on the catalogue's own id, which is what `mergeComps`
                 does across pages and sources — the two searches overlap by
                 design and a book found twice is one book. */
              const seen = new Set(books.map((b) => b.key));
              books = [...books, ...extra.filter((b) => !seen.has(b.key))];
              scanned += typeof more.scanned === "number" ? more.scanned : 0;
            }
          }
        } catch {
          // The first answer is a real answer. Nothing to say.
        }
      }

      const found = findClashes(candidate, books);
      setClashes(found);

      /* ---- "Did you mean …?" ---------------------------------------------

         **Only when the check found nothing at all.** A writer looking at
         twenty near-matches has plenty to read; this is for the screen that
         has just gone quiet, where a clean answer might be a clean name or
         might be a typo — and the difference decides whether they keep the
         title.

         **A plain keyword search, not `intitle:` and not a phrase.** That is
         the query Google spell-corrects: measured on 2026-09-03,
         `intitle:"spidrmn"` returns nothing from either catalogue while a bare
         `spidrmn` returns Spider-Man books. So the correction is the
         catalogue's, never ours — `suggestSpelling` only picks from what came
         back, and hands the title over verbatim.

         No `sweep`: one page is plenty to find a title two keystrokes away,
         and this fires on the searches that found nothing rather than on every
         check. */
      if (found.length === 0) {
        try {
          const near = await fetch(`/api/comps?q=${encodeURIComponent(asked)}`);
          if (near.ok) {
            const data = await near.json();
            const titles = ((data.books ?? []) as CompTitle[]).map(
              (b) => b.title,
            );
            setSuggestion(suggestSpelling(asked, titles));
          }
        } catch {
          // A suggestion is a courtesy. Its absence is not a failure.
        }
      }
      setSources(
        data.sources && typeof data.sources === "object" ? data.sources : null,
      );
      /* Narrowed on the way in like everything else read off a response: this
         is JSON from a route, and a missing field must render as "not said"
         rather than as `NaN` in a sentence about somebody's title.

         `scanned` counts both sweeps where there were two, so the "checked
         against N records" line stays true. `reported` is the first search's:
         it is the catalogue's count for the name as the writer wrote it, which
         is the number that sentence is about. */
      setDepth({
        scanned,
        reported:
          typeof data.reportedOpenLibrary === "number"
            ? data.reportedOpenLibrary
            : typeof data.reported === "number"
              ? data.reported
              : null,
      });
      setKeyRefused(data?.why?.google === "key");
      setChecked(candidate.trim());
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }

  // The app's splash is for the app. In the roadmap's panel it would take
  // over half the window with a logo, so an embedded tool waits silently —
  // see `Pending` in `roadmap/step-panel.tsx`.
  if (!hydrated)
    return embedded ? (
      <div className={toolShell(embedded)} />
    ) : (
      <LoadingScreen />
    );

  /* No "that book is not here" any more. Nothing below needs a book, so a
     missing one is not a failure — it is the ordinary case in the dashboard.
     A bad id in the URL costs the header's chip and nothing else. */

  /**
   * Whether what is on screen still answers what is in the box.
   *
   * Compared rather than cleared on every keystroke, so retyping the same
   * title brings the answer back instead of demanding another search — and so
   * a stray keypress does not throw away a result the writer is reading.
   */
  /**
   * Whether what is on screen still answers something the writer asked.
   *
   * **It used to require the box to match the finding exactly**, so a single
   * backspace threw away thirteen covers and a verdict — and the browsing
   * shelf flooded back under a half-typed name. Editing the box is how
   * somebody tries the next candidate; it should not cost them the answer they
   * are still reading.
   *
   * What the old rule was protecting is real and is kept: *a result must not
   * sit under an empty field, naming a title that is no longer anywhere on
   * screen.* Emptying the box still clears everything. Nothing short of empty
   * does — and where the box has drifted, `stale` says which title the finding
   * belongs to, which is what makes the looser rule honest rather than merely
   * convenient.
   */
  const answered =
    state === "done" && checked !== null && title.trim() !== "";

  /** The box no longer says what the finding below it is about. */
  const stale = answered && title.trim() !== checked;

  /** Nothing has been asked yet, so the box is the whole screen. */
  const asking = !answered && !error && state !== "loading";

  /**
   * Whether the browsing shelf is standing in for an answer.
   *
   * One flag because the line and the covers have to appear and disappear
   * together — as two `&&` chains in two places it is one edit away from a
   * caption describing a shelf that is not on screen.
   */
  const showShelf = asking && genreShelf.length > 0;

  return (
    <div className={toolShell(embedded)}>
      {/* `book &&` as well as `!embedded`: the header is the one thing on
          this screen that still needs one, and an id that matches nothing now
          costs the chip rather than the page. */}
      {!embedded && book && (
        <ToolHeader
          book={book}
          tool="Title check"
          title="Is this title taken?"
          width="7xl"
          /* Shortened to suit a deck that runs the header's full width — the
             same trade the comps deck makes. "Strictly" and the aside about
             trademarks were three lines in a narrow column beside an empty
             half-header; the point survives in one. */
        >
          No title is taken — titles cannot be copyrighted. The useful question
          is whether somebody else&rsquo;s book turns up first when a reader
          searches for yours.
        </ToolHeader>
      )}

      <div
        className={`@container ${toolMeasure(embedded)} pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6`}
      >
        {/* `ToolHeader` is suppressed in the roadmap's panel and in the
            dashboard, and it was the only place this screen said what the
            question actually is — so the panel opened on "Check the title" and
            a text box, with the premise missing. */}
        {embedded && (
          <p className="-mt-2 mb-2 max-w-2xl text-sm text-muted">
            {/* Explicit space: the one after `</em>` is swallowed when the
                line wraps, which set this as "taken— titles". */}
            No title is <em>taken</em>
            {" "}&mdash; titles cannot be copyrighted. The useful question is
            whether somebody else&rsquo;s book turns up first when a reader
            searches for yours.
          </p>
        )}
        {/* ---- One box: the shelf's name, the search, and what it finds ---

            The three were loose on the band — a field, a caption, a paragraph
            explaining what the field would do, then a heading and a shelf —
            so nothing said where the control ended and the answer began. In a
            box they read as one instrument, which is what the comps screen
            does with its own search.

            **The shelf's heading sits above the search rather than under it.**
            While nothing has been checked, the covers below *are* the page,
            and the field is the thing you use on them; naming them first and
            putting the control under that name is the order the eye wants.
            Once there is an answer the heading is gone and the box opens on
            the field, which is then the only thing above the finding. */}
        {/* `mt-6` only when nothing is above it. With a heading the card is
            the first thing in the column and the area's own title is already
            three lines up; the gap read as a dropped element. */}
        <section
          className={`rounded-2xl border border-line bg-panel p-5 @2xl:p-6 ${
            heading ? "" : "mt-6"
          }`}
        >
          {/* ---- Whose book, and which search ---------------------------

              The caller's chrome, inside the instrument. See the same block in
              `comps-page.tsx` — the two screens are switched between by one
              control, so the control has to sit in the same place on both or
              it appears to move when you use it. */}
          {heading && (
            <div className="mb-5 border-b border-line pb-5">{heading}</div>
          )}

          {/* ---- What this box is for ------------------------------------

              **What the screen does, not a label for what is under it.** It
              read "Titles on the fantasy shelf" with a count beside it, which
              names the covers below and says nothing about the tool — and in
              the dashboard this is the card's only heading, because
              `ToolHeader` is suppressed there.

              *Commit* rather than *publish* or *print*: the moment this is
              useful is the one where a writer stops trying names and settles
              on one, which happens long before anything is printed and is not
              a step in any shop's process. `asking` is the whole condition —
              once there is a finding, `Result` names itself. */}
          {asking && (
            <h2 className="text-2xl font-bold tracking-tight text-fg">
              Check a title before you commit to it
            </h2>
          )}

          {/* Names the shelf, so a wall of covers nobody asked for cannot read
              as a result. "Not a check *yet*" — a stage rather than a denial —
              and the count is here rather than beside the heading, because it
              counts what is below it. */}
          {showShelf ? (
            <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
              Not a check yet &mdash; just {genreShelf.length} titles from the{" "}
              {shelfName?.toLowerCase()} shelf, while you decide.
            </p>
          ) : (
            asking && <div className="mb-4" />
          )}

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Refused rather than disabled — the eleventh press is what
              // puts the banner and the dialog on screen.
              if (!gate.spend()) return;
              void check(title);
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A title you are considering"
              aria-label="Title to check"
              className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                         text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
            <button
              type="submit"
              // Never disabled by the limit: an eleventh press is the only
              // moment there is anything to say about it.
              disabled={state === "loading" || title.trim().length < 2}
              className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5
                         font-semibold text-accent-ink disabled:opacity-50"
            >
              {state === "loading" && <Spinner className="h-4 w-4" />}
              {state === "loading" ? "Looking…" : "Check it"}
            </button>
          </form>

          {/* **Which title the finding is about, when the box no longer says.**
              The result now survives an edit, so the box and the answer can
              disagree — and "Under this exact name 13" over a field reading
              "spider ma" would read as a claim about "spider ma". Naming it is
              what keeps the looser rule honest. Same shape as the comps
              screen's "Showing Fantasy, from this book's genre". */}
          {stale && (
            <p className="mt-3 text-sm text-muted">
              Showing the check for &ldquo;{checked}&rdquo;. Press Check it for
              what is in the box.
            </p>
          )}

          {answered &&
            clashes &&
            sources &&
            (sources.google || sources.openLibrary) &&
            dismissed !== checked &&
            /* **Shown even when the plan is spent, and it did not used to be.**
               The argument for hiding it was that the upgrade banner stands in
               this space and two filled bars read as one thing said twice —
               fair while the limit was ten for the lifetime of the account,
               where being blocked was a rare terminal state. At two a day it is
               the *second* search that spends the last one, so hiding it meant
               the writer paid for a check and never saw the answer, every day,
               on the press they were entitled to. The banner beside it says
               "everything you have already found stays where it is", which that
               made a lie. */
            (
              /* ---- The two buttons that were here -----------------------

                 The amber banner carried a pair: *Use this title*, which
                 renamed the book to the one just checked through
                 `setBookDetails`, and *Keep "<the book's name>"*, which put the
                 field back and closed the finding. When the checked title was
                 already the book's own, they became *Try another* and *Keep
                 it*.

                 They went on 2026-09-03 with the book. A checker that takes any
                 title has nothing to rename, and a rename button that acts on a
                 book the writer never chose is worse than no button.

                 What a restoration needs, if the tool is ever made book-aware
                 again: `isOwnTitle`, a `setBookDetails` call that hands back
                 `subtitle`, `author` and `genre` unchanged — that setter clears
                 any field it is not given, so renaming quietly dropped all
                 three — and the rule that the pair appears on the amber tone
                 only. A finding of "nothing uses this name" leaves nothing to
                 decide, and buttons under it ask a question already answered.

                 `dismissed` stays: the writer can still wave a finding away,
                 which is now what closing it means. */
              <VerdictBanner tone={verdictLine(clashes).tone}>
                {verdictLine(clashes).headline}
              </VerdictBanner>
            )}

          <LeftPill allowance={checks} className="mt-3" />
          <LimitBanner allowance={checks} refused={gate.refused} className="mt-4" />

          {error && (
            <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
              {error}
            </p>
          )}

          {/* **The paragraph explaining the button is gone.** It described what
              pressing Check it would produce, to a reader looking straight at
              the button — and now at a shelf of the very covers it was
              describing. A control that needs a paragraph about what it does is
              usually a control in the wrong place; this one is in the right
              place, so the paragraph was just words. */}

          {/* No View control on this one: it is what is on screen *before* a
              check, and the menu belongs on the answer. It follows the same
              stored setting. */}
          {showShelf && <Shelf books={genreShelf} layout={layout} />}

          {/* **The browsing shelf is a five-page sweep, so its wait is real.**
              It arrives on mount and used to leave the whole space under the
              box blank until a hundred covers appeared at once — which reads
              as a screen that has finished and has nothing on it, rather than
              as one still working. Same placeholders as a check, without the
              finding-shaped block above them: nothing is being *answered*
              here, so nothing should be shaped like an answer. */}
          {asking && shelfLoading && (
            <CoverSkeleton layout={layout} className="mt-4" />
          )}

          {/* **The blank page was the bug, not the missing spinner.**

              A control that says it is busy tells the reader their press landed.
              It does not tell them anything about the wait, and everything below
              the box vanished while the request was out — which on a screen that
              had just been full of covers reads as the results being *cleared*
              rather than replaced.

              So the space keeps the shape it is about to hold: a finding, a
              heading, and a grid of cover-shaped blocks at the same size and
              gap as the real ones, so nothing moves when they arrive. */}
          {state === "loading" && (
            <section className="mt-8" aria-hidden>
              <div className="animate-pulse rounded-xl border border-line bg-panel px-5 py-4">
                <div className="h-5 w-2/5 rounded bg-raised" />
                <div className="mt-3 h-3 w-4/5 rounded bg-raised" />
                <div className="mt-2 h-3 w-3/5 rounded bg-raised" />
              </div>

              <div className="mt-8 h-4 w-40 animate-pulse rounded bg-raised" />

              <CoverSkeleton layout={layout} className="mt-4" />
            </section>
          )}

          {/* A search where neither catalogue answered is not a finding, so it
              never reaches `Result`. Saying nothing here is the only honest
              option: we did not look. */}
          {answered && sources && !sources.google && !sources.openLibrary && (
            <p className="mt-8 rounded-xl border border-line bg-panel p-4 text-fg">
              Neither catalogue answered just now, so this is not a result — the
              search did not run. Press Check it again in a moment.
            </p>
          )}

          {answered &&
            clashes &&
            sources &&
            (sources.google || sources.openLibrary) && (
              <>
                <Result
                  title={checked ?? ""}
                  clashes={clashes}
                  layout={layout}
                  onLayout={(next) => setPref("researchLayout", next)}
                  suggestion={suggestion}
                  onTrySuggestion={(next) => {
                    setTitle(next);
                    // A press is a press: this runs a check and spends one of
                    // the day's, like the button beside the box. A free search
                    // reachable by mistyping is not a limit.
                    if (!gate.spend()) return;
                    void check(next);
                  }}
                />

                {/* ---- What this was checked against -----------------------

                    **The denominator, under the finding rather than beside
                    it.** Everything above is counted from the records the
                    sweep read, and the sweep is deep rather than exhaustive —
                    so a writer reading "nothing under this exact name" is
                    owed the size of the thing that nothing was found in. It
                    is the same rule the rest of the app follows for a figure:
                    say how many records carried it.

                    Only when the catalogue gave a total. A sentence with a
                    blank in it where the number should be is worse than the
                    shorter sentence. */}
                {depth && depth.scanned > 0 && (
                  <p className="mt-6 border-t border-line pt-5 text-xs text-muted">
                    {/* **The catalogues are named here now.** The banner used
                        to carry them and no longer does, and a figure without
                        its provenance is the thing this app refuses
                        everywhere else — so the sentence that reports the
                        count is the sentence that says whose records were
                        counted. */}
                    Checked against {depth.scanned.toLocaleString()} records
                    from Google Books and Open Library
                    {depth.reported && depth.reported > depth.scanned
                      ? `, of about ${depth.reported.toLocaleString()} they report under this name — a deep look, not the whole shelf.`
                      : "."}
                  </p>
                )}

                {/* Not weather, and the only failure here somebody has to go
                    and fix. An invalid key answers 400 for good, so "try again
                    shortly" would be a promise that cannot come true — and
                    without this line the screen simply showed half a search as
                    though it were a whole one. */}
                {keyRefused && (
                  <p className="mt-3 text-xs text-muted">
                    Google Books refused the API key, so only Open Library
                    answered. The results are real; there are fewer of them.
                  </p>
                )}
              </>
            )}

          {/* Only alongside results. It is advice about *reading* a list, and
              it ran on an empty screen where there was no list to read — and
              then went on running beside a box the writer had emptied, which is
              the same fault one step further on. `answered` is the whole test:
              is what is on screen still about what is in the field. */}
        </section>
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="titleCheck" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

/**
 * What the search found: the finding first, then the shelf.
 *
 * **Every good availability check answers before it argues.** A domain search,
 * a username lookup, a trademark check — each states the result in one line
 * and puts the working underneath, because the reader arrived with a
 * yes-or-no shaped question. This screen used to answer in a paragraph of body
 * prose, which is the same information arranged so nobody can take it at a
 * glance.
 *
 * **The count says what it counted.** "4 books use this title" reads as a fact
 * about the world; it is a fact about the seventeen records two catalogues
 * handed over, while Google reports about three hundred exist under that name.
 * Printing the first without the second is the invented-number problem
 * arriving by accident rather than by choice, so the provenance sits directly
 * under the count and never in a footnote.
 *
 * **Colour from the status family, stopping short of a verdict.** Green for
 * nothing found, because "it is a good sign" is what this screen already said
 * in words; amber for a shared name, because it is worth knowing. Never red —
 * red means blocked here, and the whole position is that no title is taken and
 * the writer decides.
 */
/**
 * The finding, as a filled bar inside the box.
 *
 * **One line, in the colour of the answer, where the question was asked.** It
 * was a card with a deck and a provenance footnote, then a toast in the
 * corner; it is a banner again because the box is where the writer is looking
 * and a result that has to be chased across the screen is a result they read
 * twice. Green means nobody has the name, amber means somebody does — the
 * two-colour ladder the rest of the app already teaches, spent on the one
 * thing this screen exists to say.
 *
 * **Minimal, and that is a rule rather than a mood.** The headline is the
 * whole message: no explanation of why it matters, no count of the records it
 * came from. What those said is now said by the covers underneath, which are
 * the evidence rather than a description of it.
 *
 * `*-solid` rather than `*-fg`, and that distinction is why those tokens
 * exist: `ok-fg` is a bright mint at night because its job is *ink on a
 * near-black ground*, and white on it is unreadable. The solids are stated
 * once for both themes and are deep enough to carry white. White is written
 * literally here, not through `accent-ink`, because these two do not invert —
 * the note beside the tokens says so.
 */
function VerdictBanner({
  tone,
  actions,
  children,
}: {
  /** `note` when something already uses the name, `ok` when nothing does. */
  tone: "ok" | "note";
  /** The two decisions the finding leaves open. See `VerdictActions`. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl
                  px-4 py-3 text-white ${
                    tone === "note" ? "bg-note-solid" : "bg-ok-solid"
                  }`}
    >
      {/* A ring with a mark in it, as every filled status bar draws: the shape
          says which of the two this is before the colour has been read, which
          is the half of the signal that survives colour blindness. */}
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                   border border-white/60"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          {tone === "note" ? (
            <path d="M10 5.5v5.5M10 14.2v.3" />
          ) : (
            <path d="m5.5 10.5 3 3 6-6.5" />
          )}
        </svg>
      </span>

      <p className="min-w-0 flex-1 font-sans text-sm leading-snug font-semibold">
        {children}
      </p>

      {actions}
    </div>
  );
}

/**
 * Cover-shaped placeholders, in whatever mode the writer is reading in.
 *
 * **The grid class is `resultsGridClass`, the same call the real shelf makes.**
 * It was a hard-coded `auto-fill,minmax(11rem,1fr)` track — right when it was
 * written, and wrong the moment the View menu arrived, because the covers then
 * landed in five fixed columns under a placeholder grid that had drawn as many
 * as would fit. Its own comment already said what it needed: *the same track
 * rule as the real shelf, or the page jumps when the covers land.*
 *
 * Sixteen, not a hundred. It stands for the wait; it is not a preview of the
 * count, and a hundred pulsing rectangles is a page that looks broken rather
 * than busy.
 *
 * In List mode the rows are short and horizontal, because a column of tall
 * jacket-shaped blocks would be a wait shaped like the wrong answer.
 */
function CoverSkeleton({
  layout,
  className = "",
}: {
  layout: ShelfLayout;
  className?: string;
}) {
  return (
    <ul className={`${resultsGridClass(layout)} ${className}`} aria-hidden>
      {Array.from({ length: 16 }, (_, i) =>
        isGrid(layout) ? (
          <li key={i} className="animate-pulse">
            <div className="aspect-[2/3] w-full rounded-lg bg-raised" />
            <div className="mt-2 h-3.5 w-4/5 rounded bg-raised" />
            <div className="mt-1.5 h-3 w-3/5 rounded bg-raised" />
          </li>
        ) : (
          <li key={i} className="flex animate-pulse items-center gap-3 py-1.5">
            <div className="h-12 w-8 shrink-0 rounded bg-raised" />
            <div className="h-3.5 w-1/3 rounded bg-raised" />
          </li>
        ),
      )}
    </ul>
  );
}

/*
 * **`VerdictActions` was here, and went on 2026-09-03 with the book.**
 *
 * It drew the pair under the amber banner — *Use this title* / *Keep "…"* —
 * and the note at its old call site says what a restoration has to put back.
 * Deleted rather than left callerless: an unused component is lint this repo
 * holds to a baseline, and the reasoning is the part worth keeping.
 *
 * The rule it was built on outlives it and belongs to the whole screen:
 * **neither action was styled as the recommended one.** This screen reports
 * and does not advise. Sharing a title with an obscure book from 1974 is
 * nothing; sharing one with a bestseller in the same genre is a real problem;
 * only the writer can see which they are looking at.
 */
/**
 * The one line the toast carries.
 *
 * **Three states, not two**, and the headline used to branch on `exact` alone
 * — so a search with no exact match but nineteen near ones read "Nothing
 * published under this exact name", a flat all-clear sitting directly above a
 * shelf of nineteen books a reader could plainly mistake for yours. On a
 * screen answering a yes-or-no question the headline is what gets read, so the
 * near shelf is named in the answer rather than only underneath it.
 *
 * **A floor we counted, not an estimate we were handed.** The question is "how
 * many books actually have this name", and the honest answer is a *minimum*.
 * Two earlier attempts got there: "15 of these use this exact title" was true
 * of the records fetched and a false impression of the world, and Google's own
 * `totalItems` is not a fact about books either — for one query it reports 300
 * when asked for one result and 10 when asked for forty. It moves with our own
 * request. What survives is what we counted ourselves, stated as the floor it
 * is: smaller than the truth and never larger, which is the right direction to
 * be wrong in on a screen somebody is using to decide whether a name is
 * crowded.
 */
function verdictLine(clashes: TitleClash[]): {
  tone: "ok" | "note";
  headline: string;
} {
  const exact = clashes.filter((c) => c.match === "exact").length;
  const near = clashes.length - exact;

  if (exact > 0) {
    return {
      tone: "note",
      headline: `At least ${exact} published book${exact === 1 ? "" : "s"} use${
        exact === 1 ? "s" : ""
      } this exact title`,
    };
  }
  if (near > 0) {
    return {
      tone: "ok",
      headline: `Nothing under this exact name — but check the ${
        near === 1 ? "one" : near
      } close to it`,
    };
  }
  return { tone: "ok", headline: "Nothing published under this exact name" };
}

function Result({
  title,
  clashes,
  layout,
  onLayout,
  suggestion,
  onTrySuggestion,
}: {
  title: string;
  clashes: TitleClash[];
  layout: ShelfLayout;
  onLayout: (next: ShelfLayout) => void;
  /** A published title this one may be a misspelling of. See `suggestSpelling`. */
  suggestion: string | null;
  onTrySuggestion: (title: string) => void;
}) {
  const exact = clashes.filter((c) => c.match === "exact");
  const near = clashes.filter((c) => c.match !== "exact");

  return (
    <section className="mt-8">
      {/* The control goes on whichever shelf is first, so it is always at the
          top of the answer and never drawn twice. */}
      {exact.length > 0 && (
        <Shelf
          heading="Under this exact name"
          books={exact.map((c) => c.book)}
          layout={layout}
          onLayout={onLayout}
        />
      )}
      {near.length > 0 && (
        <Shelf
          heading="Close to it"
          books={near.map((c) => c.book)}
          layout={layout}
          onLayout={exact.length > 0 ? undefined : onLayout}
        />
      )}

      {clashes.length === 0 && (
        <div className="mt-4">
          <p className="text-sm text-muted">Searched “{title}”.</p>

          {/* ---- The other thing worth knowing about a clean answer -------

              **Offered, never asserted, and the green bar above stays green.**
              Nothing *is* published under this name, which is what was asked
              and what was answered. This is a second fact beside it: a
              catalogue holds a title two keystrokes away, so a reader
              searching for this one may well be shown that one instead.

              It may equally be a name the writer chose precisely because it is
              uncrowded, which is why `suggestSpelling` stays quiet unless the
              neighbour is very close indeed — and why this is a question with
              a button rather than a correction applied for them. */}
          {suggestion && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg">
              <span>
                Did you mean “<strong className="font-semibold">{suggestion}</strong>
                ”?
              </span>
              <button
                type="button"
                onClick={() => onTrySuggestion(suggestion)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm
                           font-semibold text-fg outline-none transition-colors
                           hover:border-accent/60 hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Check that instead
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A shelf of what is already out there, rather than a stack of rows.
 *
 * The rows carried a cover each at 48px beside three lines of text, which is a
 * list wearing a picture. This question is answered by *looking* — a writer
 * deciding whether they mind standing next to these books reads the covers
 * first and the metadata second, the same way they would in a shop. So the
 * covers are the content and the words sit under them, at the size the covers
 * wall already uses.
 *
 * The year stays in the page's own ink while the author is held back: an
 * obscure book from 1974 and a bestseller from last year are the two cases
 * this screen exists to tell apart, and the year is how you tell at a glance.
 */
function Shelf({
  heading,
  books,
  note,
  layout,
  onLayout,
}: {
  /**
   * Absent when the section around it is already named — the genre shelf's
   * heading sits at the top of the box now, above the search rather than
   * under it, so printing it again here would be the same words twice.
   */
  heading?: string;
  books: CompTitle[];
  /** One line under the heading, where the shelf needs explaining. */
  note?: string;
  layout: ShelfLayout;
  /**
   * Draw the View control on this shelf's heading row.
   *
   * **One menu per screen, not one per shelf.** A result can show three walls
   * at once — under this exact name, close to it, and the genre shelf — and
   * they all read one setting, so three copies of the control would be three
   * ways to change one thing sitting inches apart. The first shelf carries it.
   */
  onLayout?: (next: ShelfLayout) => void;
}) {
  return (
    <>
      {/* Sized as the section heading it is. At `text-sm` it was the same size
          as the caption under the search box and smaller than the covers' own
          titles underneath it — so the one word telling a reader what this row
          of books *is* read as a label on the row rather than as its name.

          It stops at `2xl`, which is where the ladder runs out: `ToolHeader`
          draws the page's `h1` at `3xl` on a desktop, and a section heading
          that matched it would leave the screen with two things claiming to
          be its name. The count stays a step down and in the muted grey — it
          is a figure about the heading, not part of it. */}
      {heading && (
        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            {heading}
            <span className="ml-3 text-lg font-normal text-muted">
              {books.length}
            </span>
          </h2>
          {onLayout && <ViewMenu value={layout} onChange={onLayout} />}
        </div>
      )}
      {note && <p className="max-w-prose mt-1 text-sm text-muted">{note}</p>}

      {/* **The columns follow the content, rather than the content filling
          fixed columns.** At eight fixed tracks a four-book answer sat in the
          left half of the row with a void beside it, which reads as something
          having failed to load. `auto-fit` collapses the tracks nobody is
          using, so four books become four columns and thirty become eight.

          The `13rem` ceiling is the other half of it: without a maximum,
          collapsing tracks lets a single result stretch to the full page and a
          thumbnail becomes a poster.

          Left-aligned, not centred. Centring a short row was the first
          attempt and it broke the one alignment that matters: the covers no
          longer began where the heading above them began, so a four-book
          answer read as a floating island rather than as the contents of the
          section it sits in.

          No breakpoints and no container queries — the track size decides, so
          this needs no separate answer for the roadmap's half-width panel. */}
      {/* **The writer's chosen mode, out of `resultsGridClass`, replacing the
          `auto-fill` track this drew for itself.**

          The old note argued for `auto-fill,minmax(11rem,1fr)` on the grounds
          that the track size should decide and a four-book answer should not
          stretch each cover into a poster. Both halves still hold — and they
          are what a fixed column count gives you outright, at a width the
          writer picked rather than one the content bargained for. Sharing the
          map with the comps wall matters more: they are two answers to one
          question and are switched between by one control, so they may not
          disagree about how wide a jacket is. */}
      <ul className={`mt-4 ${resultsGridClass(layout)}`}>
        {books.map((other) => {
          /* Standing up or lying down, as one branch rather than two
             components — the same trade `CompCard` makes, and for the same
             reason: both show the title, the year and the author, so two
             copies would be two places to change what a match tells you. */
          const inner = isGrid(layout) ? (
            <>
              <BookCover src={other.coverUrl} />
              <span className="mt-2 block truncate text-sm font-medium text-fg">
                {other.title}
              </span>
              <span className="block truncate text-xs text-muted">
                {other.year ? (
                  <span className="text-fg">{other.year}</span>
                ) : null}
                {other.year && other.authors.length > 0 ? " · " : ""}
                {other.authors[0] ?? ""}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised">
              <span className="w-8 shrink-0">
                <BookCover src={other.coverUrl} />
              </span>
              <span className="min-w-0 flex-[2] truncate text-sm font-medium text-fg">
                {other.title}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-xs text-muted @sm:block">
                {other.authors[0] ?? ""}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {other.year ?? ""}
              </span>
            </span>
          );

          return (
            <li key={other.key} className="min-w-0">
              {other.infoUrl ? (
                <a
                  href={other.infoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {inner}
                </a>
              ) : (
                <div>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
