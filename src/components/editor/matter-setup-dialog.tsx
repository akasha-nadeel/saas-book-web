"use client";

import { useEffect, useRef, useState } from "react";
import { MatterPartRows } from "@/components/editor/matter-rows";
import { defaultPicked, pagesLabel, picksFrom } from "@/lib/matter-picks";
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
 *
 * **This is now the second screen to ask, not the only one.** `/book/new` puts
 * the same question as two steps of its own, so a book made in the app has
 * answered before it is created and `shouldAskMatter` is already false by the
 * time the editor mounts. What is left for this dialog is every book that
 * arrived some other way — an import, or one made before the wizard existed —
 * which is why it stays rather than being folded into the wizard. The ticks,
 * the ordering and the rows themselves come from `matter-picks.ts` and
 * `matter-rows.tsx` so the two screens cannot come to different views about
 * what a first novel usually has.
 */

export function MatterSetupDialog({
  onCreate,
  onSkip,
}: {
  /** The chosen pages, in binding order. Never called with an empty list. */
  onCreate: (picks: MatterPick[]) => void;
  onSkip: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [picked, setPicked] = useState<Set<string>>(defaultPicked);

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

  const picks: MatterPick[] = picksFrom(picked);

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
                <div className="mt-2">
                  <MatterPartRows
                    part={part}
                    picked={picked}
                    onToggle={toggle}
                  />
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
              : `Add ${pagesLabel(picks.length)}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
