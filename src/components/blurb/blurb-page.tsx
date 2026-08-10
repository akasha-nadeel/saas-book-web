"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { ToolSaveBar } from "@/components/ui/tool-save";
import { blurbReport } from "@/lib/blurb";
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
        {/* **A composer at a writing measure, and a rail beside it — not one
            column with half a window of nothing to its right.**

            The measure is the fixed part: a blurb is read as a paragraph, and a
            field run to the full width of a 7xl page is about 150 characters a
            line — twice a readable measure and roughly six times the line
            length the same words will have on a shop's page. So the left column
            is capped at `48rem` (the `3xl` it was) rather than given `1fr`, and
            the rail takes a fixed `20rem` beside it. Widening the window now
            widens the margin, which is the correct thing for it to widen.

            A rail was here before and was removed with good reason: it held
            *examples*, fetched from a comps search that returned Dostoevsky for
            "Mystery" and measured catalogue summaries as if they were blurbs.
            What goes back into it is only what this screen already knew — the
            count of what is in the box, and the findings computed from it.
            Nothing here is fetched and nothing is invented.

            **`@3xl:` off the container, not `lg:` off the viewport**, for the
            reason the block above gives: in the roadmap's panel the window is
            wide while this screen is not, and a viewport breakpoint would put a
            20rem rail beside a composer squeezed to nothing. Below that width
            the grid is one column and the rail falls underneath, which is
            exactly the layout the panel had. */}
        <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,48rem)_minmax(0,20rem)]">
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
                  in it are safe. The counts moved to the rail — see there —
                  but this one cannot: it is a fact about *this box*, it changes
                  on the keystroke, and a writer looking at their own paragraph
                  should not have to look away to find out whether it is
                  stored. */}
              <div className="flex items-center justify-end border-t border-line bg-surface px-5 py-2.5 text-xs">
                <span className={save.dirty ? "text-note-fg" : "text-muted"}>
                  {save.dirty ? "Not saved yet" : "Saved"}
                </span>
              </div>
            </div>
          </div>

          {/* **The rail, and it is sticky on purpose.**

              The counts used to sit in a strip under the textarea, which was
              itself a fix for their having been fourteen rows down the page —
              a character count nobody can see while typing does its job after
              the fact. Moving them sideways only keeps that fix if they stay
              on screen while the writer works, and this box is 14 rows tall,
              so the rail is pinned. Below `@3xl` it is not pinned and not
              beside anything: the grid is one column there and this falls under
              the composer, which is the layout the roadmap's panel gets.

              Two boxes rather than one, because they answer different
              questions. The first is *how much have I written*, which is true
              of any blurb and changes every keystroke. The second is *what
              about it is unusual*, which is a reading of those numbers and is
              often empty. Stacked in one panel, an empty second half would read
              as a broken first. */}
          <aside className="flex flex-col gap-4 @3xl:sticky @3xl:top-6">
            {/* Length. The character count leads at display size because it is
                the only figure here with a limit behind it and the only one
                that can be wrong; words and paragraphs are context and are set
                as a quiet pair beneath. Three numbers at one weight — which is
                what the old strip was — made a reader work out which of them
                they were being warned about. */}
            <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <h2 className="font-sans text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                Length
              </h2>
              <p className="mt-3 flex items-baseline gap-1.5 tabular-nums">
                <span
                  className={`font-display text-3xl font-bold ${
                    over ? "text-danger" : "text-fg"
                  }`}
                >
                  {report.stats.characters.toLocaleString()}
                </span>
                <span className="text-sm text-muted">
                  / {BLURB_MAX.toLocaleString()} characters
                </span>
              </p>
              {/* A ratio of two real numbers rather than a score: what is drawn
                  is the count against the shops' own limit, which is the one
                  hard edge on this screen. It is `aria-hidden` because the line
                  above states both numbers — a bar repeating them is a second
                  announcement of one fact. */}
              <div
                aria-hidden="true"
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div
                  className={`h-full rounded-full ${over ? "bg-danger" : "bg-accent"}`}
                  style={{
                    width: `${Math.min(100, (report.stats.characters / BLURB_MAX) * 100)}%`,
                  }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
                <div>
                  <dt className="text-xs text-muted">Words</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-fg">
                    {report.stats.words.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">
                    Paragraph{report.stats.paragraphs === 1 ? "" : "s"}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-fg">
                    {report.stats.paragraphs.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </section>

            {/* What the report found. The heading is deliberately not "Issues"
                or "Problems": one of the two things this screen can state as
                fact is that a blurb is missing, and everything else in the list
                is a measurement that may be perfectly fine on somebody's book.

                The caption sits at the foot of *this* box rather than under the
                page, which is where it was — a third grey paragraph in a column
                of grey paragraphs, so the one rule on the screen read as more
                commentary. Here it qualifies the list directly above it and
                nothing else. */}
            <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
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
                   whether a blurb is any good — only that none of the things it
                   can count came out unusual, which is what it says. */
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
          </aside>
        </div>
      </div>
    </div>
  );
}
