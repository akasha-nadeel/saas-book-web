"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { BookCover } from "@/components/ui/book-cover";
import { Spinner } from "@/components/ui/spinner";
import type { CompTitle } from "@/lib/comps/comps";
import { findClashes, type TitleClash } from "@/lib/comps/title-check";
import { ToolStepDone } from "@/components/ui/tool-save";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { findBook, setBookDetails } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

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
export function TitleCheckPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

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
   * Real titles from this book's own shelf, for when the box is empty.
   *
   * The screen used to answer a cleared box with a dashed panel and half a
   * page of nothing. This is a naming screen, and the most useful thing to
   * look at while deciding on a name is what the books beside yours are
   * actually called — so the space carries that instead of an apology. They
   * are **not** clashes and the heading says so; nothing here has been
   * compared to anything.
   */
  const [genreShelf, setGenreShelf] = useState<CompTitle[]>([]);
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
   * The genre shelf, fetched once and only when it is about to be needed.
   *
   * Not on mount: the box arrives holding this book's title, so this would be a
   * request for something nothing is showing. It loads the first time the writer
   * clears the box, which is the only way to reach the state that draws it.
   */
  const askedShelf = useRef(false);
  useEffect(() => {
    if (askedShelf.current || title.trim() !== "" || !book?.genre) return;
    askedShelf.current = true;
    void fetch(`/api/comps?q=${encodeURIComponent(`subject:"${book.genre}"`)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // The search returns fifty-odd; this takes most of them. It is a
        // shelf to browse rather than a figure to read, so the useful amount
        // is however many fit without the page becoming a scroll.
        if (data)
          setGenreShelf(((data.books ?? []) as CompTitle[]).slice(0, 32));
      })
      .catch(() => {
        // A shelf that will not load leaves the space as it was. Nothing on
        // this screen depends on it.
      });
  }, [title, book?.genre]);

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
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** So "Try another" can leave the caret where the next title goes. */
  const fieldRef = useRef<HTMLInputElement>(null);

  /**
   * Put this book's title in the box, and **do not search**.
   *
   * The screen used to arrive having already checked, on the reasoning that it
   * knows which title the writer most likely means and making them press for it
   * is asking them to prove they meant it. The cost of that is a verdict nobody
   * asked for: a green bar declaring the name clear is the loudest thing on the
   * page, delivered before the reader has decided they were asking, and a red
   * one lands harder still. A finding is an answer, and an answer to an unasked
   * question reads as a claim rather than a result.
   *
   * The field is still seeded, which is the half worth keeping: the title is one
   * press away rather than something to retype, and this is the same split the
   * comps screen already makes with its shelf chips — picking one fills the
   * field and does not spend a search.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setTitle(book.title);
  }, [book]);

  /*
   * Nothing to save: this screen stores no result and changes no field — a
   * checked title is a thing the writer now *knows*.
   *
   * That is exactly why "Check the title" carries no detector on the road.
   * Having read the shelf and decided, they say so here rather than going to
   * the roadmap to say it, which was the errand this control removes.
   */
  const save = useToolSave({ book, tool: "title-check" });

  async function check(candidate: string) {
    if (candidate.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      // Searched as the title itself, unlike every other screen here — the
      // comps query deliberately leaves the writer's title out, because comps
      // are books *like* yours. This is the one question where finding a book
      // with the same name is the whole point.
      const response = await fetch(
        `/api/comps?q=${encodeURIComponent(`intitle:"${candidate.trim()}"`)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setClashes(findClashes(candidate, (data.books ?? []) as CompTitle[]));
      setSources(
        data.sources && typeof data.sources === "object" ? data.sources : null,
      );
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

  /**
   * Whether what is on screen still answers what is in the box.
   *
   * Compared rather than cleared on every keystroke, so retyping the same
   * title brings the answer back instead of demanding another search — and so
   * a stray keypress does not throw away a result the writer is reading.
   */
  const answered =
    state === "done" && checked !== null && title.trim() === checked;

  /**
   * Whether the box is standing in for an answer with the genre's shelf.
   *
   * One flag because the heading, the note and the covers have to appear and
   * disappear together — they were two `&&` chains in two places before the
   * heading moved to the top of the box, which is one edit away from a box
   * titled after a shelf it is not showing.
   */
  /** Whether the checked title is the one the book already carries. */
  const isOwnTitle = (checked ?? "").trim() === book?.title.trim();

  const showShelf =
    !answered && !error && state !== "loading" && genreShelf.length > 0;

  return (
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Title check"
          title="Is this title taken?"
          width="7xl"
          /* Shortened to suit a deck that runs the header's full width — the
             same trade the comps deck makes. "Strictly" and the aside about
             trademarks were three lines in a narrow column beside an empty
             half-header; the point survives in one. */
          action={<ToolStepDone state={save} />}
        >
          No title is taken — titles cannot be copyrighted. The useful question
          is whether somebody else&rsquo;s book turns up first when a reader
          searches for yours.
        </ToolHeader>
      )}

      <div className="@container mx-auto max-w-7xl px-6 pt-6 pb-16">
        {heading}

        {/* `ToolHeader` is suppressed in the roadmap's panel and it was the
            only place this screen said what the question actually is — so the
            panel opened on "Check the title" and a text box, with the premise
            missing. */}
        {embedded && (
          <div className="-mt-2 mb-2 flex items-start justify-between gap-4">
            <p className="max-w-2xl text-sm text-muted">
              {/* Explicit space: the one after `</em>` is swallowed when the
                  line wraps, which set this as "taken— titles". */}
              No title is <em>taken</em> &mdash; titles cannot be copyrighted.
              The useful question is whether somebody else&rsquo;s book turns up
              first when a reader searches for yours.
            </p>
            <ToolStepDone state={save} />
          </div>
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
        <section className="mt-6 rounded-2xl border border-line bg-panel p-5 @2xl:p-6">
          {showShelf && (
            <>
              {/* The same two lines the shelf used to carry under it, now at
                  the top of the box it lives in. */}
              <h2 className="text-2xl font-bold tracking-tight text-fg">
                Titles on the {book.genre?.toLowerCase()} shelf
                <span className="ml-3 text-lg font-normal text-muted">
                  {genreShelf.length}
                </span>
              </h2>
              <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
                Not a check — just what the books beside yours are called, while
                you decide.
              </p>
            </>
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
              <VerdictBanner
                tone={verdictLine(clashes).tone}
                /* **Only on the amber one.** A finding of "nothing uses this
                   name" leaves nothing to decide — a pair of buttons under it
                   would be asking a question that has already been answered.
                   The decision belongs to the banner that raises a problem. */
                actions={
                  verdictLine(clashes).tone !== "note" ? null : (
                    <VerdictActions
                      tone={verdictLine(clashes).tone}
                      primary={isOwnTitle ? "Try another" : "Use this title"}
                      onPrimary={() => {
                        if (isOwnTitle) {
                          setTitle("");
                          fieldRef.current?.focus();
                          return;
                        }
                        setBookDetails(book.id, {
                          title: checked ?? "",
                          // Handed back unchanged: this setter clears any field
                          // it is not given, so renaming here would quietly drop
                          // the subtitle, the byline and the genre.
                          subtitle: book.subtitle ?? "",
                          author: book.author ?? "",
                          genre: book.genre,
                        });
                      }}
                      secondary={
                        isOwnTitle ? "Keep it" : `Keep “${book.title}”`
                      }
                      onSecondary={() => {
                        if (!isOwnTitle) setTitle(book.title);
                        setDismissed(checked);
                      }}
                    />
                  )
                }
              >
                {verdictLine(clashes).headline}
              </VerdictBanner>
            )}

          <LeftPill allowance={checks} className="mt-3" />
          <LimitBanner allowance={checks} className="mt-4" />

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
          {showShelf && <Shelf books={genreShelf} />}

          {/* **The blank page was the bug, not the missing spinner.**

              A control that says it is busy tells the reader their press landed.
              It does not tell them anything about the wait, and everything below
              the box vanished while the request was out — which on a screen that
              had just been full of covers reads as the results being *cleared*
              rather than replaced.

              So the space keeps the shape it is about to hold: a heading and a
              grid of cover-shaped blocks, at the same size and gap as the real
              ones, so nothing moves when they arrive. */}
          {state === "loading" && (
            <section className="mt-8" aria-hidden>
              <div className="animate-pulse rounded-xl border border-line bg-panel px-5 py-4">
                <div className="h-5 w-2/5 rounded bg-raised" />
                <div className="mt-3 h-3 w-4/5 rounded bg-raised" />
                <div className="mt-2 h-3 w-3/5 rounded bg-raised" />
              </div>

              <div className="mt-8 h-4 w-40 animate-pulse rounded bg-raised" />

              {/* The same track rule as the real shelf, or the page jumps
                  when the covers land. */}
              {/* The same track rule as the real shelf, or the page jumps
                  when the covers land. */}
              <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-6">
                {Array.from({ length: 16 }, (_, i) => (
                  <li key={i} className="animate-pulse">
                    <div className="aspect-[2/3] w-full rounded-lg bg-raised" />
                    <div className="mt-2 h-3.5 w-4/5 rounded bg-raised" />
                    <div className="mt-1.5 h-3 w-3/5 rounded bg-raised" />
                  </li>
                ))}
              </ul>
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
              <Result title={checked ?? ""} clashes={clashes} />
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
 * The two ways out of a finding, in the banner that made it.
 *
 * **A check ends in a decision, and the screen used to leave the writer to
 * make it somewhere else.** They read "at least eighteen books use this exact
 * title", agreed with it, and then had to go to the listing screen to change
 * the name — a trip that loses the shelf they were looking at. So the decision
 * is offered where it is made, and both answers do something real:
 *
 * - **The title in the box is not the book's.** Then the choice is whether to
 *   adopt it: *Use this title* renames the book, *Keep "…"* puts the field
 *   back to the book's own name and closes the finding.
 * - **The title in the box *is* the book's.** Adopting it is a no-op, so the
 *   pair becomes *Try another* — which empties the field and puts the caret in
 *   it — and *Keep it*, which closes the finding.
 *
 * Neither is styled as the recommended one. This screen reports and does not
 * advise: sharing a title with an obscure book from 1974 is nothing and
 * sharing one with a bestseller in the same genre is a real problem, and only
 * the writer can see which they are looking at.
 */
function VerdictActions({
  tone,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: {
  tone: "ok" | "note";
  primary: string;
  onPrimary: () => void;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPrimary}
        /* White fill, the banner's own colour as its ink — the same pairing
           the upgrade banner uses, and the reason `*-solid` is a token: it is
           dark enough to read on white as well as to carry white. */
        className={`rounded-lg bg-white px-3.5 py-1.5 font-sans text-xs
                    font-semibold outline-none transition-opacity
                    hover:opacity-90 focus-visible:ring-2
                    focus-visible:ring-white/70 ${
                      tone === "note" ? "text-note-solid" : "text-ok-solid"
                    }`}
      >
        {primary}
      </button>
      <button
        type="button"
        onClick={onSecondary}
        className="rounded-lg border border-white/40 px-3.5 py-1.5 font-sans
                   text-xs font-semibold text-white outline-none
                   transition-colors hover:bg-white/15 focus-visible:ring-2
                   focus-visible:ring-white/70"
      >
        {secondary}
      </button>
    </div>
  );
}

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

function Result({ title, clashes }: { title: string; clashes: TitleClash[] }) {
  const exact = clashes.filter((c) => c.match === "exact");
  const near = clashes.filter((c) => c.match !== "exact");

  return (
    <section className="mt-8">
      {exact.length > 0 && (
        <Shelf
          heading="Under this exact name"
          books={exact.map((c) => c.book)}
        />
      )}
      {near.length > 0 && (
        <Shelf heading="Close to it" books={near.map((c) => c.book)} />
      )}

      {clashes.length === 0 && (
        <p className="mt-4 text-sm text-muted">Searched “{title}”.</p>
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
        <h2 className="mt-10 text-2xl font-bold tracking-tight text-fg">
          {heading}
          <span className="ml-3 text-lg font-normal text-muted">
            {books.length}
          </span>
        </h2>
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
      {/* **`auto-fill` with a `1fr` ceiling, not `auto-fit` with a fixed one.**
          The tracks used to stop at 13rem, so on a wide page five covers ended
          a long way short of the right edge and the shelf sat in a box it did
          not fill — the imbalance was the cap, not the alignment. `1fr` lets
          the tracks share what is there, and `auto-fill` keeps the empty ones,
          which is what stops a four-book answer stretching each cover into a
          poster. That was the fixed cap's job and it is still done. */}
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-6">
        {books.map((other) => {
          const inner = (
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
