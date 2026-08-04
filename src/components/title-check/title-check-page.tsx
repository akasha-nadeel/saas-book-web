"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { BookCover } from "@/components/ui/book-cover";
import { Spinner } from "@/components/ui/spinner";
import type { CompTitle } from "@/lib/comps/comps";
import { findClashes, type TitleClash } from "@/lib/comps/title-check";
import { findBook } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
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
  const [fetched, setFetched] = useState(0);
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
  /**
   * How many the catalogue says exist under that name, against the handful it
   * handed over. Without it the count below reads as a count of the world.
   */
  const [reported, setReported] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * Seed the box with this book's title and check it, once.
   *
   * **Arriving on a blank result was the fault.** The screen asks one question
   * about one title, and it already knows which title the writer most likely
   * means — so making them press a button to be told about their own book is
   * asking them to prove they meant it. The comps screen made the same change
   * for the same reason.
   *
   * The seed stays editable and the caption says so: any title can be checked,
   * not just this one, and nothing is saved either way.
   */
  /**
   * Fetched once, and only when it is about to be needed.
   *
   * Not on mount: the screen opens on a checked title, so this would be a
   * second request nobody looks at. It loads the first time the writer clears
   * the box, which is the only way to reach the state that shows it.
   */
  const askedShelf = useRef(false);
  useEffect(() => {
    if (askedShelf.current || title.trim() !== "" || !book?.genre) return;
    askedShelf.current = true;
    void fetch(
      `/api/comps?q=${encodeURIComponent(`subject:"${book.genre}"`)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // The search returns fifty-odd; this takes most of them. It is a
        // shelf to browse rather than a figure to read, so the useful amount
        // is however many fit without the page becoming a scroll.
        if (data) setGenreShelf(((data.books ?? []) as CompTitle[]).slice(0, 32));
      })
      .catch(() => {
        // A shelf that will not load leaves the space as it was. Nothing on
        // this screen depends on it.
      });
  }, [title, book?.genre]);

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setTitle(book.title);
    void check(book.title);
  }, [book]);

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
      setFetched((data.books ?? []).length);
      setSources(
        data.sources && typeof data.sources === "object" ? data.sources : null,
      );
      setReported(typeof data.reported === "number" ? data.reported : null);
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

  /**
   * Whether what is on screen still answers what is in the box.
   *
   * Compared rather than cleared on every keystroke, so retyping the same
   * title brings the answer back instead of demanding another search — and so
   * a stray keypress does not throw away a result the writer is reading.
   */
  const answered = state === "done" && checked !== null && title.trim() === checked;

  return (
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Title check"
          title="Is this title taken?"
          width="7xl"
        >
          Strictly, no title is taken — titles are not trademarks and cannot be
          copyrighted. The useful question is whether somebody else&rsquo;s book
          turns up first when a reader searches for yours.
        </ToolHeader>
      )}

      <div className="@container mx-auto max-w-7xl px-6 pt-6 pb-16">
        {heading}

        {/* `ToolHeader` is suppressed in the roadmap's panel and it was the
            only place this screen said what the question actually is — so the
            panel opened on "Check the title" and a text box, with the premise
            missing. */}
        {embedded && (
          <p className="-mt-2 mb-2 max-w-2xl text-sm text-muted">
            {/* Explicit space: the one after `</em>` is swallowed when the
                line wraps, which set this as "taken— titles". */}
            No title is <em>taken</em>{" "}
            &mdash; titles cannot be copyrighted. The useful question is whether
            somebody else&rsquo;s book turns up first when a reader searches for
            yours.
          </p>
        )}
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
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
            disabled={state === "loading" || title.trim().length < 2}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5
                       font-semibold text-accent-ink disabled:opacity-50"
          >
            {state === "loading" && <Spinner className="h-4 w-4" />}
            {state === "loading" ? "Looking…" : "Check it"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Try any title, not just this book&rsquo;s — nothing here is saved.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* What pressing the button will show, before it has been pressed.
        
            The screen was a box, a caveat and half a page of nothing — and the
            caveat was written to be read *beside results*, so arriving at it
            cold explained a judgement the writer had not been given yet. */}
        {!answered && !error && state !== "loading" && (
          <>
            <p className="mt-6 max-w-prose text-sm text-muted">
              Type a title and press Check it. What comes back is every book
              already published under that name, from Google Books and Open
              Library, with the year and author so you can see who you would be
              standing next to.
            </p>

            {genreShelf.length > 0 && (
              <Shelf
                heading={`Titles on the ${book.genre?.toLowerCase()} shelf`}
                books={genreShelf}
                note="Not a check — just what the books beside yours are called, while you decide."
              />
            )}
          </>
        )}

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
            <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,13rem))] justify-start gap-x-4 gap-y-6">
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

        {answered && clashes && sources && (sources.google || sources.openLibrary) && (
          <Result
            title={checked ?? ""}
            clashes={clashes}
            fetched={fetched}
            reported={reported}
            sources={sources}
          />
        )}

        {/* Only alongside results. It is advice about *reading* a list, and
            it ran on an empty screen where there was no list to read — and
            then went on running beside a box the writer had emptied, which is
            the same fault one step further on. `answered` is the whole test:
            is what is on screen still about what is in the field. */}
        {answered && !error && (
          <div className="mt-10 border-t border-line pt-6">
            {/* The rule spans the page and the sentence does not.
                They were one element while a tool page was 3xl wide,
                where the two widths happened to agree; at 5xl a line of
                text run to the full container is about 160 characters,
                which is twice a readable measure. */}
            <p className="max-w-3xl text-xs text-muted">
              We do not tell you whether to change it. Sharing a title with an
              obscure book from 1974 is nothing; sharing one with a bestseller in
              your genre is a real problem — and you can tell which you are
              looking at faster than any rule we could write.
            </p>
          </div>
        )}
      </div>
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
function Result({
  title,
  clashes,
  fetched,
  reported,
  sources,
}: {
  title: string;
  clashes: TitleClash[];
  fetched: number;
  reported: number | null;
  sources: { google: boolean; openLibrary: boolean };
}) {
  const exact = clashes.filter((c) => c.match === "exact");
  const near = clashes.filter((c) => c.match !== "exact");

  /**
   * One catalogue answered and the other did not.
   *
   * Not a footnote. "Nothing published under this name" from half a search is
   * a materially weaker claim than the same words from a whole one, and the
   * reader cannot tell them apart unless the card says which they are holding.
   */
  const missing = !sources.google
    ? "Google Books"
    : !sources.openLibrary
      ? "Open Library"
      : null;

  return (
    <section className="mt-8">
      <div
        className={`rounded-xl border px-5 py-4 ${
          exact.length > 0
            ? "border-note-line bg-note-bg"
            : "border-ok-line bg-ok-bg"
        }`}
      >
        {/* **A floor we counted, not an estimate we were handed.**

            The question is "how many books actually have this name", and the
            honest answer is a **minimum**. Two attempts got there:

            First it read "15 of these use this exact title" — true of the
            records fetched, and a false impression of the world. Then Google's
            own `totalItems` led instead, and that is not a fact about books
            either: for `intitle:"The Rule of Four"` it reports **300** when
            asked for one result and **10** when asked for forty. It moves with
            our own request parameters. Stable for a *fixed* request — we always
            ask for forty — so it survives below as rough context, but it
            cannot carry a headline.

            What survives is what we counted ourselves, stated as the floor it
            is. "At least 4" is smaller than the truth and never larger, which
            is the right direction to be wrong in on a screen somebody is using
            to decide whether a name is crowded.

            **Three states here too, for the reason the deck below has them.**
            The headline used to branch on `exact` alone, so a search with no
            exact match but nineteen near ones read "Nothing published under
            this exact name" — a flat all-clear sitting directly above a shelf
            of nineteen books a reader could plainly mistake for yours. The
            deck said so and the headline did not, and on a screen answering a
            yes-or-no question the headline is what gets read. So the near
            shelf is named in the answer rather than only underneath it. */}
        <p
          className={`text-lg font-bold ${
            exact.length > 0 ? "text-note-fg" : "text-ok-fg"
          }`}
        >
          {exact.length > 0
            ? `At least ${exact.length} published book${
                exact.length === 1 ? "" : "s"
              } use${exact.length === 1 ? "s" : ""} this exact title`
            : near.length > 0
              ? `Nothing under this exact name — but check the ${
                  near.length === 1 ? "one" : near.length
                } close to it`
              : "Nothing published under this exact name"}
        </p>

        <p className="max-w-prose mt-1.5 text-sm text-fg/75">
          {/* Three states, not two.

              The middle one was missing and it contradicted the page: with no
              exact match but fourteen near ones, this read "nothing came back
              that a reader could mistake for yours" directly above a grid of
              fourteen books a reader could plainly mistake for yours. The
              branch was on `exact` while the sentence spoke for `clashes`.

              It is still a good sign — nobody has the name — but the near
              shelf is the whole reason this screen exists, so it gets said
              rather than contradicted.

              The *count* moved up into the headline once that learned the same
              three states; this carries why it matters, not how many. Putting
              the number back here says it twice in two sentences. */}
          {exact.length > 0 ? (
            <>
              Sharing a name is allowed and common — titles cannot be
              copyrighted. What matters is who you would be standing next to,
              which is what the years and authors below are for.
            </>
          ) : near.length > 0 ? (
            <>
              Nobody has the name itself, which is the good half. The close
              ones still matter: a reader searching for your title could land
              on one of those first, and that is what the years and authors
              below are for.
            </>
          ) : (
            <>
              A good sign: nothing came back that a reader could mistake for
              yours.
            </>
          )}
        </p>

        {/* Our own arithmetic, saying exactly what it is arithmetic over. */}
        <p className="mt-2.5 text-xs text-fg/60">
          {exact.length > 0 ? (
            <>
              Counted from the {fetched} closest records we could read
              {missing ? `, after ${missing} did not answer` : ""}
              {near.length > 0
                ? `, ${near.length} of them near rather than exact`
                : ""}
              .
              {reported !== null && reported > fetched
                ? ` Google suggests around ${reported.toLocaleString()} carry the phrase somewhere in the title.`
                : ""}{" "}
              Neither catalogue is complete, so this is a floor rather than a
              total.
            </>
          ) : (
            <>
              {/* The limit, where a limit belongs — under the answer rather
                  than in front of it. It also has to reconcile "nothing" with
                  a record count, or the two lines read as contradicting each
                  other: books did come back, none of them close enough to
                  matter. */}
              Checked against {fetched} record{fetched === 1 ? "" : "s"} from
              {missing ? " one catalogue" : " Google Books and Open Library"}
              {near.length > 0
                ? `, ${near.length} of them near the name but none matching it`
                : ", none close enough to clash"}
              .
              {missing
                ? ` ${missing} did not answer, so only one of the two was searched. `
                : " "}
              Neither catalogue is complete, so this is not proof.
            </>
          )}
        </p>
      </div>

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
        <p className="mt-4 text-sm text-muted">
          Searched “{title}”.
        </p>
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
  heading: string;
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
      <h2 className="mt-10 text-2xl font-bold tracking-tight text-fg">
        {heading}
        <span className="ml-3 text-lg font-normal text-muted">
          {books.length}
        </span>
      </h2>
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
      <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,13rem))] justify-start gap-x-4 gap-y-6">
        {books.map((other) => {
          const inner = (
            <>
              <BookCover src={other.coverUrl} />
              <span className="mt-2 block truncate text-sm font-medium text-fg">
                {other.title}
              </span>
              <span className="block truncate text-xs text-muted">
                {other.year ? <span className="text-fg">{other.year}</span> : null}
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
