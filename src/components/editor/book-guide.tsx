"use client";

import { SharedBadge } from "@/components/collab/shared-badge";
import type { Book } from "@/lib/library-store";

/**
 * What fills the workspace when no chapter is open — the book's overview.
 *
 * Rather than dropping the writer straight into a chapter, the book opens on a
 * short guide: pick a chapter to write, and how the three parts of a book work.
 * It reads on the page's own surface, centred like a title page.
 */
export function BookGuide({
  title,
  book,
  entering = false,
}: {
  title: string;
  /**
   * The book itself, only so this screen can say when it is somebody else's.
   * Optional because the guide is also drawn where no book is in hand.
   */
  book?: Book;
  /** Play the entrance from the right, as the manuscript does. */
  entering?: boolean;
}) {
  return (
    /* page-enter: the same arrival the manuscript makes, because this is the
       manuscript's place. Book View's panel comes together vertically and its
       page comes in from the side, which is the same movement the Chapters view
       makes — the two faces differ in what they show, not in how they land. */
    <div
      className={`scroll-slim h-full overflow-y-auto px-4 py-8 md:py-10 ${
        entering ? "page-enter" : ""
      }`}
    >
      {/* On a sheet with the accent's edge, because that is what the page in
          this position always is. Book View selects no part of the book, so the
          manuscript's edge is the accent there; the overview stands in the
          manuscript's place and takes the same rectangle and the same colour,
          rather than being the one thing in the middle of the window that is
          not a page.

          The accent token rather than --paper-edge-book: that one is a paper
          variable, and this is not on paper — it is the app's own surface, so
          it takes the app's own blue and follows the theme with it. */}
      <div
        className="mx-auto max-w-3xl rounded-sm border-2 border-accent bg-panel
                   shadow-sm"
      >
        <div className="mx-auto max-w-xl px-6 py-16">
          {/* Above the title rather than beside it, the place GitHub puts the
              owner: whose book this is has to be read *before* the name, or a
              writer with two manuscripts open reads the name and assumes the
              rest. It sits on the same line as the kicker so it costs no
              vertical space on an ordinary book, where it draws nothing. */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-sans text-xs tracking-wide text-muted uppercase">
              Book overview
            </p>
            {book && <SharedBadge book={book} />}
          </div>
          <h1 className="mt-2 font-serif text-3xl text-fg">{title}</h1>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
            Choose a chapter from the panel on the left to start writing. Here
            is how the panel is laid out.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <section>
              <h2 className="font-sans text-sm font-semibold text-fg">
                The three parts
              </h2>
              <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                {/* **The shades are gone and so is the sentence about them.**
                    The three cards used to carry a three-step border — the
                    palest of which was invisible — and the page's edge matched
                    it. There is one edge now, and what it says is *which card
                    is open*, so that is what this says. A guide describing a
                    mechanism the app has stopped using is worse than no guide. */}
                The panel holds a card for each part of a book, in the order
                they are bound: <span className="text-fg">Front matter</span>,{" "}
                <span className="text-fg">Body matter</span>,{" "}
                <span className="text-fg">Back matter</span>. Open one and its
                edge goes dark — and so does the edge of the page you are
                writing on, so the two are plainly the same thing.
              </p>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-fg">
                Chapters
              </h2>
              <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                <span className="text-fg">Chapters</span> on the body card opens
                the list; click a chapter to open it, and{" "}
                <span className="text-fg">New chapter</span> beside it adds one.
                The upload button above brings a{" "}
                <code className="rounded bg-raised px-1">.docx</code>,{" "}
                <code className="rounded bg-raised px-1">.epub</code>,{" "}
                <code className="rounded bg-raised px-1">.md</code>,{" "}
                <code className="rounded bg-raised px-1">.txt</code>, or{" "}
                <code className="rounded bg-raised px-1">.html</code> file in.
              </p>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-fg">
                Read the whole book
              </h2>
              <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                The open-book button on the rail opens a reading view — every
                chapter on one page, top to bottom, the way the book reads.
                Scroll it end to end, and click any chapter’s title to jump back
                into editing it.
              </p>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-fg">
                Front &amp; back matter
              </h2>
              <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                A book is more than its chapters. The cards above and below the
                body hold the pages that open and close it.
              </p>
              {/* **They are lists of pages, and this said they were one page
                  each.** That was true of an earlier design — Start made a
                  single sheet with every division on it as a heading — and it
                  has not been true since each division became a page of its
                  own. See `src/lib/matter.ts`. */}
              <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
                Press <span className="text-fg">Start</span> on either and it
                makes the standard pages for that part — a title page, a
                copyright page, a dedication, and so on. Each is a page you can
                open, rename or delete, listed inside the card.
              </p>
              <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
                <span className="text-fg">Add page</span> puts in one more, from
                a list that says what each division is for. Every page arrives
                with its example text in{" "}
                <code className="rounded bg-raised px-1">[square brackets]</code>{" "}
                and is marked <span className="text-fg">Draft</span> until you
                replace it — a page still holding its brackets is left out of
                the export rather than shipped as scaffolding.
              </p>
              <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
                Delete the ones your book does not need. None of them is
                required by any shop. These pages are named, never numbered — a
                title page is not “Chapter 1”.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
