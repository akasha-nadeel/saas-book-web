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
  const save = useToolSave({
    book,
    tool: "blurb",
    dirty: draft !== null && draft !== stored,
    commit: () => book && setPublishing(book.id, { description: text }),
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
        {/* **One column at a writing measure, not a stretched leftover.**
            This was a two-column grid with a 320px rail; the rail is gone, and
            a `1fr` column with nothing beside it would have run the field the
            full width of a 5xl page — about 150 characters a line, which is
            twice a readable measure and about six times a blurb's own line
            length on a shop page.

            So the composer is capped at `3xl` and left-aligned, which keeps its
            left edge on the same rule as the breadcrumb and the heading above
            it. Centring it was the other option and it breaks that alignment
            the moment the window is wide. */}
        <div className="max-w-3xl">
          <div>
            {/* The counters live inside the box's frame rather than under it.
                They were fourteen rows down, which on this screen meant below
                the fold — and a character count nobody can see while typing is
                a character count that does its job after the fact. */}
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
              {/* The character count leads and is the only figure that can go
                  red, because it is the only one with a limit behind it. Words
                  and paragraphs are context, so they are set quieter — three
                  numbers at one weight made the reader work out which of them
                  they were being warned about. */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface px-5 py-2.5 text-xs">
                <span className="tabular-nums">
                  <span
                    className={
                      over ? "font-bold text-danger" : "font-medium text-fg"
                    }
                  >
                    {report.stats.characters.toLocaleString()} /{" "}
                    {BLURB_MAX.toLocaleString()}
                  </span>
                  <span className="text-muted">
                    {" "}
                    characters · {report.stats.words} words ·{" "}
                    {report.stats.paragraphs} paragraph
                    {report.stats.paragraphs === 1 ? "" : "s"}
                  </span>
                </span>
                <span className={save.dirty ? "text-note-fg" : "text-muted"}>
                  {save.dirty ? "Not saved yet" : "Saved"}
                </span>
              </div>
            </div>

            {report.issues.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2">
                {report.issues.map((issue) => (
                  <li
                    key={issue.field + issue.message}
                    className={`flex gap-3 rounded-lg border px-4 py-3 ${
                      issue.level === "problem"
                        ? "border-note-line bg-note-bg"
                        : "border-line bg-panel"
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
            )}

            {/* Attached to the counters it qualifies, not floating under
                them. It was a third grey paragraph in a column of grey
                paragraphs, so the one *rule* on the screen read as more
                commentary. */}
            <p className="mt-2 text-xs text-muted">
              Only two things here are facts: an empty blurb, and one over{" "}
              {BLURB_MAX.toLocaleString()} characters, which shops refuse.
              Everything else is a measurement, not a rule.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
