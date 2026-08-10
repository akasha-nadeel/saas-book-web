"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { Spinner } from "@/components/ui/spinner";
import { ToolSaveBar } from "@/components/ui/tool-save";
import { blurbReport } from "@/lib/blurb";
import { MIN_BLURB, type Question } from "@/lib/blurb-critique";
import { findBook, setPublishing } from "@/lib/library-store";
import { BLURB_MAX } from "@/lib/publishing";
import { useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * The blurb workshop: a place to write it, and a count of what was written.
 *
 * The blurb is the part writers say they are worst at, and what they reach for
 * is a chatbot — after which they report that the AI-written blurb hurt their
 * sales. So this writes nothing, and that refusal is the feature rather than a
 * gap in it.
 *
 * **The examples panel was removed on 2026-08-04, and it is worth knowing why
 * before anybody rebuilds it.** It fetched five published blurbs from the comps
 * search and printed the median length beside them. Both halves were measured
 * and both were wrong:
 *
 * - **The books were not comparable.** A `subject:"Mystery"` search returned
 *   *Crime and Punishment*, *Emil and the Detectives* (a children's book from
 *   1930) and *Trent's Last Case*. Of 56 records fetched, 3 were published
 *   since 2021 and **none of those carried a description** — so the fault could
 *   not be filtered out after the fetch either. Google surfaces public-domain
 *   editions for a bare subject search, and an agent wants comps from the last
 *   two or three years.
 * - **The median measured the wrong text.** Google's `description` is usually a
 *   one-line catalogue summary, not back-cover copy. The computed figures were
 *   155–315 characters against a real blurb's 900–1,500, so the screen told a
 *   writer with a perfectly ordinary blurb that theirs was several times too
 *   long — a confident, wrong verdict, which is the exact failure this app
 *   exists to avoid.
 *
 * Rebuilding it needs the *search* fixed first, not the panel: `filter=
 * paid-ebooks` and `orderBy=newest` on the Google request are the untested
 * levers, and a length benchmark should either be dropped or cited from
 * published guidance rather than computed from whatever came back.
 *
 * What is left is honest: two facts (an empty blurb, and one over the shops'
 * 4,000-character limit) and a handful of measurements that name what they
 * measured. See `blurb.ts` — it still accepts a `benchmark`, deliberately
 * unused here, so a future caller with trustworthy data can pass one.
 */
export function BlurbPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  /*
   * `null` means "the writer has not typed", which is not the same as an
   * empty blurb — and the box falls back to what is on the book.
   *
   * This used to be an empty string copied out of the store by an effect,
   * behind a `seeded` ref that said whether the copy had happened. Two things
   * were wrong with that and one of them is a real bug: the ref had to be read
   * *during render* to work out whether the box differed from the book, and an
   * effect that seeds state is a second render for something the first one
   * already knew. Falling back needs neither. There is no effect on this
   * screen at all now.
   */
  const stored = book?.publishing?.description ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? stored;

  const report = useMemo(
    () => blurbReport(text, { title: book?.title }),
    [text, book?.title],
  );

  /* Saved on a press now, not on blur.
     "Saved when you click away" was true and nobody believed it — this is the
     one screen where a writer redrafts the same two hundred words a dozen
     times, and a save they cannot see is a save they assume did not happen.
     The step it ticks is "Write the blurb", which is detected rather than
     stored: it ticks because the description is now on the book. */
  /*
   * **Spent on the save, not on the typing and not on arrival.** Drafting is
   * the whole of this screen — a writer redrafts the same two hundred words a
   * dozen times — so charging for a keystroke would be the meter this policy
   * exists to remove. Keeping the blurb is the thing worth counting, and a book
   * already counted is never asked again however often it is redrafted.
   */
  const gate = useLimitGate({ action: "blurb", bookId });

  const save = useToolSave({
    book,
    tool: "blurb",
    dirty: draft !== null && draft !== stored,
    commit: () => {
      if (!book || !gate.spend()) return;
      setPublishing(book.id, { description: text });
    },
    discard: () => setDraft(null),
  });

  /*
   * **The reader, and what it is allowed to be.**
   *
   * This is the one model call on this screen, and it answers "what is a reader
   * still asking" rather than "write me one". The reasoning lives in
   * `lib/blurb-critique.ts`; the part that matters here is that the answer is a
   * list of *questions* with no field to put a rewritten sentence in, so there
   * is nothing on this screen to paste into the box.
   *
   * `askedAbout` holds the exact words that were sent. It is what lets the box
   * say the answer is about an earlier draft rather than quietly describing a
   * blurb that no longer exists — the same rule the title check's toast follows
   * in remembering which title its verdict was about.
   */
  const [reading, setReading] = useState<Question[] | null>(null);
  const [askedAbout, setAskedAbout] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  async function askAReader() {
    if (asking) return;
    setAsking(true);
    setAskError(null);
    const sent = text;

    try {
      const response = await fetch("/api/blurb/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blurb: sent,
          title: book?.title,
          // On the book, not in `publishing`: the genre is what the book *is*,
          // and it is set at creation or in the listing details rather than
          // being one of the fields a shop's form asks for.
          genre: book?.genre,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        // The route's own words: 402 explains the plan, 501 explains the
        // missing key, and both are more use than "something went wrong".
        setAskError(
          typeof payload?.error === "string"
            ? payload.error
            : "That did not work. Your blurb is unaffected.",
        );
        return;
      }

      setReading(Array.isArray(payload?.questions) ? payload.questions : []);
      setAskedAbout(sent);
    } catch {
      setAskError("That did not work. Your blurb is unaffected.");
    } finally {
      setAsking(false);
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

  const over = report.stats.characters > BLURB_MAX;

  return (
    <div className={toolShell(embedded)}>
      {/* At the foot of the window, and only once there is something to lose.
          Outside the scrolling column on purpose: this screen scrolls, and a
          control that scrolls away is not there at the moment it matters. */}
      <ToolSaveBar state={save} />
      {gate.dialogOpen && (
        <LimitDialog action="blurb" onClose={gate.closeDialog} />
      )}
      {/* The trail keeps the trade word, the heading asks the writer's own
          question — the split comps and the title check already make. "Blurb"
          is what this is called in the launcher and on a shop's own form, so it
          stays where a writer goes looking for it; as the `h1` it names the
          artefact rather than saying what the screen is for. */}
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Blurb"
          title="What goes on the back cover?"
          /* The deck runs the page's width here rather than taking the default
             cap. Held at `2xl` it stacked into four short lines beside an acre
             of empty header, which on a screen whose whole content is one wide
             row read as a column that had failed to fill. Three sentences
             across the page is two lines. The rule the cap exists for still
             applies: lengthen this deck and the cap has to come back. */
          deckWidth="full"
        >
          {/* **The problem before the definition**, and the refusal before the
              feature. Every shop makes a writer supply this before it will
              list the book, and it is the only part of it most people ever
              read — that is the pressure they arrive under, so the deck opens
              there rather than on a word count.

              The second sentence is the one that cannot move. Writers in the
              research describe an AI-written blurb as the thing that hurt
              their sales, so "it will not write it for you" is the promise
              this screen is built on rather than a limitation to apologise
              for, and it is said before anything the screen *does* do. */}
          Every shop asks for a description before it will list your book, and
          it is the only part of it most people will ever read. This will not
          write it for you — it counts what you have written against the shops’
          limits and tells you where it is unusual.
        </ToolHeader>
      )}

      {/* `@container` + `@3xl:`, not `lg:`.

          This screen now opens in two frames of very different widths: the
          whole window, and the roadmap's panel at a little over half of it.
          A viewport breakpoint cannot tell those apart — the *window* is wide
          in both cases — so `lg:grid-cols-…` put a 320px sidebar next to a
          shrinking editor inside the panel and squeezed both into columns too
          narrow to use. A container query asks the only question that matters
          here: how much room does this actually have? */}
      <div className="@container mx-auto max-w-7xl px-6 pt-6 pb-16">
        {heading}

        {/* `ToolHeader` is suppressed in the roadmap's panel and it was the
            only place this screen said what it will and will not do — so the
            panel opened on a title and an empty box, which is the one thing a
            writer stuck on a blurb does not need more of.

            The Save control rides with it, because `embedded` may hide the
            *frame* and may never hide a feature — a panel whose draft cannot
            be saved is the lesser product `tool-page.ts` warns about. */}
        {embedded && (
          <p className="-mt-2 mb-5 max-w-2xl text-sm text-muted">
            The two hundred words that decide whether anybody opens the book.
            This will not write it for you — it counts what you have written
            against the shops’ limits and tells you where it is unusual.
          </p>
        )}
        {/* **The content runs the page's own width, and that is a correction.**

            An earlier arrangement capped this block at the composer plus the
            rail, which left a band of empty down the right-hand side while the
            left margin stayed at the page's own padding — two different margins
            on one screen, which reads as a layout that failed rather than as a
            measure being kept. The columns fill the container now: the rail is
            a fixed 20rem and the composer takes what is left.

            **`@xl:` / `@3xl:` off the container, not `lg:` off the viewport**:
            in the roadmap's panel the window is wide while this screen is not,
            and a viewport breakpoint would put a 20rem rail beside a composer
            squeezed to nothing. Below those widths everything stacks into one
            column, which is exactly the layout the panel had. */}
        <div>
          {/* **One number per box.**

              They were three figures in one panel with a heading over them, and
              at a glance that reads as one measurement with two footnotes — the
              reader has to work out which of the three the heading is about.
              Three boxes make three facts, each labelled, each the same size on
              the page, which is what they are: a blurb has a length, a word
              count and a paragraph count, and only the first has a limit
              behind it.

              That difference is carried by the bar rather than by the layout.
              The characters box is the only one with a ceiling, so it is the
              only one that draws its figure against a ceiling, and the only one
              that can go red. */}
          <div className="grid gap-4 @xl:grid-cols-3">
            <Stat
              label="Characters"
              value={report.stats.characters}
              /* The limit is named in the box rather than only in the bar, so
                 the figure means something before anybody reads the bar — and
                 to somebody who never sees it, since the bar is aria-hidden. */
              of={BLURB_MAX}
              danger={over}
            />
            <Stat label="Words" value={report.stats.words} />
            <Stat
              label={report.stats.paragraphs === 1 ? "Paragraph" : "Paragraphs"}
              value={report.stats.paragraphs}
            />
          </div>

          {/* No `items-start`: the two columns stretch to a shared height, so
              the rail ends on the same line as the composer instead of being a
              short card with a column of empty under it. */}
          <div className="mt-6 grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
            {/* The left column: what the writer types into, and the two notices
              that qualify the act of saving it. */}
            <div>
              {/* Standing above the composer, because what is refused here is the
                *save* — a writer may draft freely either way, and the thing they
                need to know before spending an evening on it is that keeping it
                is what costs. `LimitNote` in the roadmap's panel, which is a
                ~300px column the wide banner does not fit. */}
              {embedded ? (
                <LimitNote allowance={gate.allowance} className="mb-4" />
              ) : (
                <LimitBanner allowance={gate.allowance} className="mb-4" />
              )}
              <LeftPill allowance={gate.allowance} className="mb-4" />
              <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/50">
                <textarea
                  value={text}
                  onChange={(e) => setDraft(e.target.value)}
                  /* No `onBlur` commit. The shelf is one document and a write
                   per character is a write per character, but a write per
                   *click away* was the other extreme: a writer who tabbed to
                   the counter had saved, and one who redrafted for ten
                   minutes without leaving the box had not, and the screen
                   read the same either way. Save is a press now. */
                  /* Six in the panel, twelve on the page — the old flat six was
                   the panel's answer applied to both.

                   The constraint is real but local: in the roadmap's panel,
                   eight rows already push the counter — the thing this screen
                   is actually for — below the fold under a field that is
                   mostly empty. On the full page there is no such squeeze, and
                   six rows made a 4,000-character box that showed about four
                   hundred, so a finished blurb had to be written down a slot.
                   Twelve holds two or three paragraphs at once, which is the
                   shape of the thing being written.

                   `resize-y` stays either way: whatever we pick is a guess at
                   somebody else's paragraph. */
                  rows={embedded ? 6 : 14}
                  placeholder="What happens, who it happens to, and what is at stake."
                  aria-label="Your blurb"
                  /* Set like copy, because that is what it is. This is the only
                   screen in the app where the writer is composing *marketing*
                   prose rather than a form field, and it was set at the form
                   field's size: `text-base` in a padded box. A blurb is read
                   aloud, cut, and read aloud again, so it wants the measure and
                   the leading of something being read, not the density of
                   something being filled in. */
                  className="w-full resize-y bg-transparent px-5 py-4 text-[15px]
                           leading-7 text-fg outline-none
                           placeholder:text-muted/70"
                />
                {/* All that is left in the box's own frame is whether the words
                  in it are safe. The counts are in their own boxes above —
                  but this one cannot join them: it is a fact about *this box*,
                  it changes on the keystroke, and a writer looking at their own
                  paragraph should not have to look away to find out whether it
                  is stored. */}
                <div className="flex items-center justify-end border-t border-line bg-surface px-5 py-2.5 text-xs">
                  <span className={save.dirty ? "text-note-fg" : "text-muted"}>
                    {save.dirty ? "Not saved yet" : "Saved"}
                  </span>
                </div>
              </div>

              {/* **Under the box, not above it.** These are findings *about the
                  words in that box*, so they belong where a reader arrives
                  after reading them rather than in a panel passed on the way
                  in. Above the composer they also had to be read before there
                  was anything to say — on an empty blurb the only finding is
                  that it is empty, which is a poor first thing to meet on a
                  screen for writing one.

                  The heading is deliberately not "Issues" or "Problems": one of
                  the two things this screen can state as fact is that a blurb is
                  missing, and everything else in the list is a measurement that
                  may be perfectly fine on somebody's book.

                  The caption sits at the foot of this box rather than under the
                  page, which is where it was — a third grey paragraph in a
                  column of grey paragraphs, so the one rule on the screen read
                  as more commentary. Here it qualifies the list directly above
                  it and nothing else. */}
              <section className="mt-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
                <h2 className="font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                  What stands out
                </h2>

                {report.issues.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {report.issues.map((issue) => (
                      <li
                        key={issue.field + issue.message}
                        className={`flex gap-2.5 rounded-lg border px-3.5 py-3 ${
                          issue.level === "problem"
                            ? "border-note-line bg-note-bg"
                            : "border-line bg-surface"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 text-sm font-bold ${
                            issue.level === "problem"
                              ? "text-note-fg"
                              : "text-muted"
                          }`}
                        >
                          {issue.level === "problem" ? "!" : "·"}
                        </span>
                        <span className="min-w-0">
                          <span className="text-sm font-bold text-fg">
                            {issue.field}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">
                            {issue.message}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* Stated as a measurement, not as praise. Nothing here knows
                     whether a blurb is any good — only that none of the things
                     it can count came out unusual, which is what it says. */
                  <p className="mt-3 text-sm text-muted">
                    Nothing unusual in what can be counted.
                  </p>
                )}

                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  Only two things here are facts: an empty blurb, and one over{" "}
                  {BLURB_MAX.toLocaleString()} characters, which shops refuse.
                  Everything else is a measurement, not a rule.
                </p>
              </section>
            </div>

            {/* **The rail holds one thing, and that is what makes it a rail.**

              The measured boxes moved to the top of the screen, where they
              describe the whole blurb. What is left beside the composer is the
              one part that had to be asked for and takes a moment to arrive —
              so the column is a place a writer looks *after* pressing
              something, rather than a second list competing with the first.

              **It scrolls with the page.** Pinning it was tried, on the
              reasoning that an answer is read against the words that prompted
              it — but every other box on this screen moves, and one that stays
              put while they pass reads as a panel bolted to the window rather
              than as part of the page. It also followed the writer down past
              the findings below the composer, which it has nothing to do with.

              Below `@3xl` it is not beside anything at all: the grid is one
              column there and this falls under the box, which is the layout the
              roadmap's panel gets. */}
            <aside className="flex flex-col">
              {/* **The reader — and it reads, it does not write.**

                The heading is a question rather than a verdict, and that is the
                whole feature: the app refuses to generate a blurb, so what a
                model is asked here is what somebody in a bookshop would still
                be wondering after reading this one. There is nothing on this
                card to paste into the box, by design — the shape it parses into
                has no field for a rewritten sentence, and a note long enough to
                be one is dropped server-side.

                Kept in its own box beside the measured findings rather than
                mixed into them, because the two have different provenance and
                this screen's rule is that every finding says where it came
                from. Those are arithmetic and always true; this one is
                somebody's reading and had to be asked for.

                `flex-1` so the box fills the column and ends level with the
                composer. It is short until it has been pressed, and a card
                sized to its own contents left a tall band of empty beside a
                fourteen-row box — which reads as a column that failed to load
                rather than as one waiting to be used. */}
              <section className="flex flex-1 flex-col rounded-xl border border-line bg-panel p-5 shadow-sm">
                {/* **A mark, a name, and a line saying what it does** — the
                    header every panel of this kind carries. The mark is a tile
                    rather than a loose glyph so a 16px drawing has some weight
                    beside the type, and it is tinted with the accent, which is
                    the one place on this screen anything is: it marks the one
                    box that *does* something rather than reporting something.

                    The heading is set as a heading rather than as the small
                    uppercase eyebrow the measured boxes use. Those label a
                    figure; this one names a feature, and a feature announced in
                    footnote type reads as a footnote. */}
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                    <SparkIcon />
                  </span>
                  <h2 className="font-display text-base font-semibold tracking-tight text-fg">
                    A reader’s questions
                  </h2>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  What somebody in a bookshop would still be wondering after
                  reading your description.
                </p>

                {/* **Filled, and the only filled control on the screen.** It
                    was an outline in the panel's own grey, which beside a
                    greyed-out state read as a button that had already been
                    disabled — and this is the one thing on this screen a writer
                    is being invited to press. The accent is the app's reserved
                    "this is the way forward" hue and this is what it is for.
                    `accent-ink` rather than a literal white: the fill inverts
                    between themes and a fixed colour is invisible in one. */}
                <button
                  type="button"
                  onClick={askAReader}
                  disabled={asking || text.trim().length < MIN_BLURB}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2
                             rounded-lg bg-accent px-4 py-2.5 font-sans text-sm
                             font-semibold text-accent-ink transition-opacity
                             hover:opacity-90 focus-visible:ring-2
                             focus-visible:ring-accent/60 focus-visible:outline-none
                             disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {asking ? <Spinner className="h-4 w-4" /> : <SparkIcon />}
                  {asking
                    ? "Reading"
                    : reading
                      ? "Read it again"
                      : "Ask a reader"}
                </button>

                {/* Said plainly rather than left to a greyed button nobody can
                    explain to themselves. */}
                {text.trim().length < MIN_BLURB && (
                  <p className="mt-2 text-center text-xs text-muted">
                    Write a little more and this turns on.
                  </p>
                )}

                {askError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg border border-stop-line bg-stop-bg px-3.5 py-3 text-sm text-stop-fg"
                  >
                    {askError}
                  </p>
                )}

                {asking ? (
                  /* **Skeleton rows rather than a spinner alone.** The button
                     already says it heard you; what this says is *what is
                     coming*, at the size and shape it will arrive in, so the
                     panel does not jump when it does. Three because the answer
                     is usually three or four. */
                  <ul aria-hidden="true" className="mt-5 flex flex-col gap-2">
                    {[0, 1, 2].map((row) => (
                      <li
                        key={row}
                        className="animate-pulse rounded-lg border border-line bg-surface px-3.5 py-3"
                      >
                        <span className="block h-3 w-24 rounded bg-line" />
                        <span className="mt-2 block h-3 w-full rounded bg-line" />
                        <span className="mt-1.5 block h-3 w-2/3 rounded bg-line" />
                      </li>
                    ))}
                  </ul>
                ) : reading ? (
                  <div className="mt-5">
                    {/* An answer about words that have since changed is the one
                        failure this box can have without looking wrong, so it
                        says so rather than letting the list describe a draft
                        that no longer exists. */}
                    {askedAbout !== null && askedAbout !== text && (
                      <p className="mb-3 text-xs text-note-fg">
                        Your blurb has changed since this was read.
                      </p>
                    )}

                    {reading.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {reading.map((question) => (
                          <li
                            key={question.about}
                            className="rounded-lg border border-line bg-surface px-3.5 py-3"
                          >
                            <span className="text-sm font-bold text-fg">
                              {question.about}
                            </span>
                            <span className="mt-0.5 block text-sm text-muted">
                              {question.note}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      /* A real answer rather than a failure: the prompt says an
                         invented complaint is worse than a short one, so
                         nothing coming back has to be allowed to mean
                         nothing. */
                      <p className="rounded-lg border border-ok-line bg-ok-bg px-3.5 py-3 text-sm text-ok-fg">
                        Nothing a reader would still be asking.
                      </p>
                    )}
                  </div>
                ) : (
                  /* **The empty state teaches rather than waits.**

                     A blank half-column is not neutral — it reads as a panel
                     that failed to load, and it tells a writer nothing about
                     what pressing the button would get them. So the space
                     carries the four things a reader looks for, which are the
                     four things the prompt actually asks about. Nothing here is
                     invented or a placeholder for real content: it is the
                     feature, described before it runs.

                     Set as a quiet list rather than as sample findings on
                     purpose. Fake rows in a real row's clothing are the one
                     thing that would make a writer distrust the real ones when
                     they arrive. */
                  <div className="mt-5">
                    <p className="font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                      What it looks for
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                      {[
                        "Who the story is about, and what they want",
                        "What stands in the way, and what it costs them",
                        "Where and when it happens",
                        "Anything so general it would fit any book in the genre",
                      ].map((line) => (
                        <li
                          key={line}
                          className="flex gap-2.5 text-sm leading-snug text-muted"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted"
                          />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* **The fine print, on the floor of the box.** Both lines are
                    obligations rather than decoration: the first is what leaves
                    this machine, which this app states before the button on
                    every screen that sends anything, and the second is where
                    the answer came from, which is the rule the measured boxes
                    are held to as well. `mt-auto` puts them at the bottom
                    whatever is above, so they read as the panel's terms rather
                    than as another finding. */}
                <div className="mt-auto space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                  <p>
                    Sends the words in the box, your title and your genre. Your
                    manuscript is never sent.
                  </p>
                  <p>Read by a model, not measured. It writes nothing.</p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The four-point star, which is what this decade uses to mean "a model did
 * this".
 *
 * Drawn here rather than imported: it is nine points of path, and it is the
 * only glyph on this screen. `currentColor` so it takes the accent in the tile
 * and the button's own ink inside the button — one drawing, two grounds.
 */
function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M12 2c.3 3.9 1.4 5.6 3.4 6.9 1.2.8 2.8 1.2 4.6 1.4-1.8.2-3.4.6-4.6 1.4-2 1.3-3.1 3-3.4 6.9-.3-3.9-1.4-5.6-3.4-6.9-1.2-.8-2.8-1.2-4.6-1.4 1.8-.2 3.4-.6 4.6-1.4C10.6 7.6 11.7 5.9 12 2Z" />
      <path d="M18.5 15c.15 1.9.7 2.8 1.7 3.4.6.4 1.4.6 2.3.7-.9.1-1.7.3-2.3.7-1 .6-1.55 1.5-1.7 3.4-.15-1.9-.7-2.8-1.7-3.4-.6-.4-1.4-.6-2.3-.7.9-.1 1.7-.3 2.3-.7 1-.6 1.55-1.5 1.7-3.4Z" />
    </svg>
  );
}

/**
 * One counted thing, in its own box.
 *
 * Three of these rather than three figures under one heading. A panel headed
 * "Length" holding a character count, a word count and a paragraph count asks
 * the reader to work out which of the three the heading is about, and sets two
 * of them as footnotes to the first — but they are three separate facts about
 * the same words, and only one of them has a limit behind it.
 *
 * **The bar is what carries that difference**, and it is drawn only for the box
 * that has a ceiling to draw against. It is a ratio of two real numbers, not a
 * score, and it is `aria-hidden` because the figures above it already state
 * both — a bar repeating them is one fact announced twice.
 */
function Stat({
  label,
  value,
  /** The limit this figure is measured against, for the one figure that has one. */
  of,
  /** Over that limit. Only ever true where `of` is set. */
  danger = false,
}: {
  label: string;
  value: number;
  of?: number;
  danger?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">
        {label}
      </h2>
      <p className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <span
          className={`font-display text-3xl font-bold ${
            danger ? "text-danger" : "text-fg"
          }`}
        >
          {value.toLocaleString()}
        </span>
        {of !== undefined && (
          <span className="text-sm text-muted">of {of.toLocaleString()}</span>
        )}
      </p>
      {of !== undefined && (
        // `mt-auto` on the wrapper, so the bar sits on the floor of the box:
        // these three are a row and stretch to a shared height, and the two
        // without a bar are shorter. The padding is on the wrapper rather than
        // the track, which is a 6px-tall coloured box with no room for any.
        <div className="mt-auto pt-4">
          <div
            aria-hidden="true"
            className="h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className={`h-full rounded-full ${danger ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${Math.min(100, (value / of) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
