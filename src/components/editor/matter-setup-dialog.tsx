"use client";

import { useEffect, useRef, useState } from "react";
import {
  MATTER_SECTIONS,
  type MatterPart,
  type MatterSection,
} from "@/lib/matter";
import type { MatterPick } from "@/lib/library-store";

/**
 * Asked once per book: which pages go before and after the story.
 *
 * **The panel could not ask this question, and that was the problem.** Front
 * matter and back matter are two cards with a Start button, and Start makes all
 * sixteen standard pages — which is the right default for somebody who does not
 * yet know what any of them are, and the wrong one for everybody else, who then
 * deletes eleven pages one at a time. Meanwhile a writer who has never
 * published has no reason to look inside those cards at all: they are printer's
 * terms sitting either side of the thing they came here to write.
 *
 * So the question is put once, on the way in, with every option named *and
 * explained* — which is the part the cards have nowhere to put. Tick what the
 * book needs and those pages appear in the two cards, in the order a book is
 * bound.
 *
 * Three rules hold it:
 *
 * - **Skip is a real answer and is never asked again.** It is a button, not a
 *   cross in the corner, and it says what it does. A writer three books in
 *   knows exactly what they want and should be able to say "not now" without
 *   the app deciding they misclicked.
 * - **Nothing is created until they press.** Skipping leaves the book exactly
 *   as it was, and Start on either card still makes the whole set later.
 * - **Nothing here is required.** Every page is addable and deletable
 *   afterwards from the cards themselves, and the dialog says so, because a
 *   list of sixteen unfamiliar terms with an OK button under it reads like a
 *   decision you are stuck with.
 *
 * The three pages the *export* can generate — title, copyright, contents — are
 * offered here too, unticked, with the hint saying the export builds one. They
 * are on the list because a writer may want to set their own, and unticked
 * because most will not; the export leaves its generated page out when a
 * written one exists, so ticking them is a choice rather than a duplicate.
 */

/** Ticked when the dialog opens. */
const SUGGESTED: Record<MatterPart, readonly string[]> = {
  /*
   * A dedication and nothing else.
   *
   * The temptation is to pre-tick everything that looks standard, which is how
   * a setup dialog turns into the Start button it was written to replace. What
   * is ticked here is what a first novel almost always has *and* what nothing
   * else in the app will make for you: the title, copyright and contents pages
   * are generated at export, the epigraph and the preface are genuine choices,
   * and a prologue is a decision about the story rather than about the book.
   */
  front: ["Dedication"],
  back: ["Acknowledgements", "About the author"],
};

export function MatterSetupDialog({
  onCreate,
  onSkip,
}: {
  /** The chosen pages, in binding order. Never called with an empty list. */
  onCreate: (picks: MatterPick[]) => void;
  onSkip: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keyed "part:title" so the two parts cannot collide — both could hold a page
  // called "Glossary", and a set of bare titles would tick both at once.
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set([
        ...SUGGESTED.front.map((t) => `front:${t}`),
        ...SUGGESTED.back.map((t) => `back:${t}`),
      ]),
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const toggle = (key: string) =>
    setPicked((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Built by walking MATTER_SECTIONS rather than the picked set, so the pages
  // are created in the order a book is bound whatever order they were ticked in.
  const picks: MatterPick[] = (["front", "back"] as const).flatMap((part) =>
    MATTER_SECTIONS[part]
      .filter((section) => picked.has(`${part}:${section.title}`))
      .map((section) => ({ part, title: section.title })),
  );

  return (
    <dialog
      ref={dialogRef}
      // Escape closes a <dialog> natively, and it has to mean something. It
      // means Skip: the writer has dismissed the question, which is the same
      // answer the button gives, and asking again on the next visit would make
      // Escape a way of postponing rather than answering.
      onClose={onSkip}
      onClick={(e) => {
        if (e.target === dialogRef.current) onSkip();
      }}
      className="m-auto w-[46rem] max-w-[calc(100vw-2rem)] rounded-xl bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      {/* `max-h` and the scrolling middle: sixteen rows is taller than a laptop
          window, and a dialog whose buttons are below the fold is a dialog
          nobody can answer. The heading and the actions stay put. */}
      <div className="flex max-h-[min(44rem,calc(100dvh-3rem))] flex-col">
        <div className="shrink-0 px-6 pt-6">
          <h2 className="font-serif text-xl">
            What goes before and after your story?
          </h2>
          {/* **Says the thing the old wording left out.**

              "Tick the ones this book needs" over sixteen identical rows reads
              as a list to complete, and a writer who completes it ships an
              empty epigraph and an invented also-by page — which is worse for
              them at a shop than having neither, since Kobo refuses listings
              that look unfinished. No shop requires any of these. What is
              worth saying, and what the app can say truthfully because
              `isUntouchedMatter` enforces it, is that a page left empty is
              simply left out. */}
          {/* Two lines, not five. The old paragraph said the same thing three
              ways and pushed the list it was introducing off the fold — which
              on a dialog is the worst place to spend height, because the rows
              are the reason the writer is here. The reassurance that nothing is
              permanent moved to the footer, beside the buttons that act on
              it. */}
          <p className="mt-1.5 max-w-prose font-sans text-sm leading-relaxed text-muted">
            No shop requires any of these, so tick only what you will actually
            write — a page left empty is left out of your exports.
          </p>
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 sm:grid-cols-2">
            {(["front", "back"] as const).map((part) => (
              <fieldset key={part} className="min-w-0">
                {/* `float-none` + a sibling span rather than a plain legend:
                    a legend cannot be made sticky (it is positioned by the
                    fieldset), and with sixteen rows scrolling past, the two
                    headings are what tell you which end of the book you are
                    looking at. */}
                <legend className="sr-only">
                  {part === "front" ? "Before the story" : "After the story"}
                </legend>
                <p
                  aria-hidden="true"
                  className="sticky top-0 z-10 -mx-1 bg-panel px-1 pb-1 font-sans
                             text-xs font-bold tracking-wide text-muted uppercase"
                >
                  {part === "front" ? "Before the story" : "After the story"}
                </p>
                {/* **No note box here, and that is deliberate.**

                    A panel reading "your export already builds a title page, a
                    copyright page and a contents list" sat at the top of this
                    column — true, useful, and *already written on the three
                    rows it describes*, whose hints each end "The export builds
                    one if you skip this." Saying it twice bought nothing and
                    cost the thing you see first: the box pushed the front
                    column a hundred and thirty pixels below the back one, so
                    two lists that should scan as a pair were visibly out of
                    step. Information belongs on the row it is about. */}
                <div className="mt-2 flex flex-col gap-0.5">
                  {MATTER_SECTIONS[part].map((section) => (
                    <SectionRow
                      key={section.title}
                      section={section}
                      on={picked.has(`${part}:${section.title}`)}
                      onToggle={() => toggle(`${part}:${section.title}`)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        {/* Skip first and quiet, the action filled: the way forward keeps the
            only fill on the row, as everywhere else in the chrome. Skip is a
            button rather than a cross, because "no thanks" is an answer and
            should look like one. */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-2.5 py-2 font-sans text-sm text-muted outline-none
                         transition-colors hover:bg-raised hover:text-fg
                         focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Skip for now
            </button>
            {/* **Where "nothing here is permanent" belongs.** It was the last
                line of the opening paragraph, where it spent a row of the
                dialog on reassurance nobody needs until they are about to
                commit — and it pushed the list down. Beside the buttons it is
                read at the moment it is worth anything. Hidden on a narrow
                dialog, where the two controls need the room more. */}
            <p className="hidden font-sans text-xs text-muted sm:block">
              You can add or delete any of these later.
            </p>
          </div>

          <button
            type="button"
            onClick={() => (picks.length === 0 ? onSkip() : onCreate(picks))}
            className="rounded-lg bg-accent px-4 py-2 font-sans text-sm font-semibold
                       text-accent-ink outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            {/* Says what will happen, and counts it. Everything unticked makes
                this the same as Skip, which is what it then says — a button
                reading "Add 0 pages" is a button that looks broken. */}
            {picks.length === 0
              ? "No pages, thanks"
              : `Add ${picks.length} ${picks.length === 1 ? "page" : "pages"}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * One offered page.
 *
 * **The "Usually" marker rather than two groups behind a disclosure.** The
 * problem with the flat list was never its length — eight rows a column is
 * nothing to scan — it was that sixteen identical rows read as a checklist to
 * complete. Splitting them into "Usually included" and an "Optional" section
 * folded away would have fixed that by *hiding* thirteen real choices behind a
 * click, which is the wrong trade: a writer who wants a prologue should not
 * have to go looking for it, and progressive disclosure earns its keep on long
 * lists rather than on short ones with an uneven distribution.
 *
 * So the rows stay where they are and three of them are marked. The eye lands
 * on the few most books have, everything else is one glance away, and nothing
 * is hidden.
 */
function SectionRow({
  section,
  on,
  onToggle,
}: {
  section: MatterSection;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    /* Tighter than it was: `py-2` and a `text-xs` hint on relaxed leading made
       each row about 70px, so sixteen of them ran to 1,100px and the list was
       mostly scrollbar on a laptop. The hint is the same size on tighter
       leading and the padding is down a step, which fits four more rows in the
       same window without making anything harder to read or to hit — the row
       is still a comfortable target because the whole label is one. */
    <label
      className={`flex cursor-pointer gap-2.5 rounded-lg border px-2.5 py-1.5
                  transition-colors ${
                    on
                      ? "border-accent/60 bg-raised"
                      : "border-transparent hover:bg-raised"
                  }`}
    >
      {/* A real checkbox, not a styled div: it is what a keyboard and a screen
          reader already know how to work, and there are sixteen of them. */}
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        className="mt-[3px] h-4 w-4 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-sans text-sm font-medium text-fg">
            {section.title}
          </span>
          {/* Quiet on purpose. It is a note about convention, not a
              recommendation the app is making — and it sits beside the title
              rather than replacing the hint, because "what is this page" is
              still the question a first novelist is asking. */}
          {section.usual && (
            <span className="font-sans text-[10px] tracking-wide text-muted uppercase">
              Usually
            </span>
          )}
        </span>
        {/* The whole reason this is a dialog and not two buttons: "Epigraph"
            means nothing to a first novelist, and a list of sixteen of those
            is sixteen guesses. */}
        <span className="block font-sans text-xs leading-tight text-muted">
          {section.hint}
        </span>
      </span>
    </label>
  );
}
