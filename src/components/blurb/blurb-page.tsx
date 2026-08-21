"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { ToolSaveBar } from "@/components/ui/tool-save";
import { blurbReport } from "@/lib/blurb";
import { BlurbWorkshop } from "@/components/blurb/blurb-workshop";
import { MAX_WORKSHOP_OPENING } from "@/lib/blurb-workshop";
import { openingFrom, proseFrom } from "@/lib/comps/rank";
import { toBlocks } from "@/lib/export/blocks";
import {
  chapterMatterOf,
  findBook,
  getBody,
  orderedChapters,
  setPublishing,
} from "@/lib/library-store";
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
/**
 * How tall the composer is, and therefore how tall the conversation is.
 *
 * **One number, written once**, because the two columns have to agree: the
 * grid stretches the chat to whatever the left column comes to, so this is the
 * only place a height is stated and there is nothing for the other side to
 * drift from.
 *
 * Shorter in the roadmap's panel, where the whole screen is a sheet over the
 * road and a box this tall would be most of it. Tailwind reads class names as
 * literals, so both are written out rather than built from a variable — a name
 * assembled at runtime ships no rule at all.
 */
const COMPOSER_HEIGHT_PAGE = "h-[36rem]";
const COMPOSER_HEIGHT_PANEL = "h-[22rem]";

export function BlurbPage({ bookId, embedded, heading }: ToolPageProps) {
  const COMPOSER_HEIGHT = embedded ? COMPOSER_HEIGHT_PANEL : COMPOSER_HEIGHT_PAGE;
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

  /**
   * The opening of the manuscript, for the workshop.
   *
   * The first *body* chapter with prose in it — front matter is a title page
   * and a dedication, which say nothing about the book — walked through the
   * export path and cut at a paragraph. The same `useMemo` the comps screen
   * uses, and deliberately the same helpers: two ways of deciding what "the
   * opening" means would eventually disagree.
   *
   * **Cut short of `rank.ts`'s length on purpose.** Everything past the
   * opening is where the ending lives, and this is the one feature where a
   * model that has read too far writes the ending onto the back cover. It is
   * cut again on the server, because a browser is not where that promise is
   * kept.
   */
  const opening = useMemo(() => {
    if (!book) return "";
    for (const chapter of orderedChapters(book)) {
      if (chapterMatterOf(chapter) !== "body") continue;
      const raw = getBody(chapter.id);
      if (!raw) continue;
      try {
        const prose = openingFrom(
          proseFrom(toBlocks(JSON.parse(raw))),
          MAX_WORKSHOP_OPENING,
        );
        if (prose) return prose;
      } catch {
        // A corrupt body contributes nothing, as it does to search.
      }
    }
    return "";
  }, [book]);

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
          /* Three sentences, which is two lines across the header's own width.
             Stacked into a narrow column it was four short lines beside an
             acre of empty header, and on a screen whose whole content is one
             wide row that read as a column which had failed to fill. Keep it
             to this length: nothing wraps a deck that runs the page. */
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
          {/* `24rem`, up from `20rem`: the rail now holds a conversation as
              well as the findings, and at the old width a chat bubble wrapped
              every four or five words. Below `@3xl` it is one column and both
              cards fall under the composer, which is the layout the roadmap's
              panel gets. */}
          <div className="mt-6 grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_24rem]">
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
              {/* **A fixed height, shared with the conversation beside it.**
                  Both boxes used to size themselves — the composer by its row
                  count, the chat by its contents — so the two columns were
                  different heights on arrival and the right-hand one grew as
                  the conversation did, walking the page down under a writer
                  who was mid-sentence in the left. A screen where one column
                  moves because the other is busy is a screen that cannot be
                  written in.

                  So the box is the height, and the text scrolls inside it.
                  `COMPOSER_HEIGHT` is the one place that number lives; the
                  chat is stretched to it by the grid rather than repeating it,
                  which is what stops the two drifting when either is edited.

                  `flex` here so the textarea can take the space the footer
                  leaves rather than being told a row count. */}
              <div
                className={`flex ${COMPOSER_HEIGHT} flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-sm focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/50`}
              >
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
                  /* **No row count and no `resize-y` any more.** The box's
                     height is set above and shared with the conversation, so a
                     handle that let a writer drag one column taller than the
                     other would undo the thing that fix was for. What the
                     writer gets instead is a thin scrollbar and a box that
                     never moves. */
                  placeholder="What happens, who it happens to, and what is at stake."
                  aria-label="Your blurb"
                  /* Set like copy, because that is what it is. This is the only
                   screen in the app where the writer is composing *marketing*
                   prose rather than a form field, and it was set at the form
                   field's size: `text-base` in a padded box. A blurb is read
                   aloud, cut, and read aloud again, so it wants the measure and
                   the leading of something being read, not the density of
                   something being filled in. */
                  className="scroll-slim min-h-0 w-full flex-1 resize-none bg-transparent
                           px-5 py-4 text-[15px] leading-7 text-fg outline-none
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
            {/* `items-start`, so this column is its content's height rather
                than being stretched to the row's. Both boxes state the same
                height themselves; a stretched aside would add whatever else
                the left column carries — the upgrade banner, the count pill —
                onto the chat's box and put the two out of step again. */}
            <aside className="flex flex-col items-stretch gap-6 self-start">
              {/* **The workshop first, the reader second, and the order is the
                  argument.** Both cards involve a model and they answer
                  opposite moments: this one is for an empty box, which is
                  where writers say they are stuck, and the reader below needs
                  a blurb to already exist. A screen that put the critic on top
                  would be offering to mark work nobody has written.

                  `min-h` rather than a fixed height: the chat scrolls inside
                  itself, so it needs a floor to be worth scrolling in, and a
                  ceiling would waste the column on a screen with room.

                  `embedded` is the narrow flag — in the roadmap's panel this
                  column is ~300px, where the wide upgrade banner does not fit
                  and `LimitNote` is the stacked version of the same fill. */}
              {/* **The same fixed height as the composer, stated the same
                  way — not `flex-1`.**

                  `flex-1` inside a stretched grid cell looks like it should
                  match the other column, and does not: a grid row is `auto`,
                  so it grows to fit its *tallest* item. The chat was that
                  item, the row grew with the conversation, and the composer
                  sat at 32rem beside a column twice its height with no
                  scrollbar in sight — because nothing was ever overflowing.

                  A height, shared from one constant, is what actually pins
                  them. It is also what makes the scroll real: the messages can
                  only overflow a box that has a size. */}
              <div className={`flex ${COMPOSER_HEIGHT} flex-col`}>
                <BlurbWorkshop
                  bookId={book.id}
                  title={book.title}
                  genre={book.genre}
                  draft={text}
                  getOpening={() => opening}
                  onUseDraft={setDraft}
                  narrow={embedded}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
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
