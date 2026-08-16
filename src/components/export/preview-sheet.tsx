"use client";

import { useEffect } from "react";
import { ReviewPane } from "@/components/export/review-pane";
import type { Format } from "@/lib/export";
import type { TypesetOptions } from "@/lib/export/typeset";
import type { Book } from "@/lib/library-store";

/**
 * The book as the file will have it, over the whole window.
 *
 * **This was the fourth of five steps until 2026-08-17, and the shape was the
 * problem rather than the contents.** A review is *one thing* — the finished
 * file — and a step in a flow carries the flow around it: a stepper band, a
 * heading, a sentence under it, a reading measure and an action bar, all
 * competing with a page of a novel for the same laptop screen. The heading and
 * the deck were cut first and bought back a fifth of it; the rest could not be
 * bought, because the rest is the wizard. Opened over everything, the page gets
 * the window.
 *
 * It is a *layer* rather than a `<dialog>` for the same reason the roadmap's
 * tool sheet and the keyword guide are: this is something a writer looks at and
 * dismisses, not a decision that has to be made before anything else can
 * happen. `KeywordGuide` is the shape it copies, and two of its decisions come
 * with it — `z-40` so the app's own dialogs at 50 still open over it (a pane
 * can raise one), and Escape.
 *
 * Three things it does differently, all because this covers the window rather
 * than sitting beside a page. It is `inset-0` with no width cap and no inset:
 * the room is the point. It has no backdrop, since one under a full-bleed
 * panel would be a dismiss target with no pressable pixel — see below. And it
 * enters with `oc-step-in`, a rise, rather than `oc-panel-in`, a slide in from
 * the right — a layer that covers everything is not arriving from a side.
 *
 * **Mounted only while open**, which the caller handles: the PDF pane fetches a
 * server render on mount, so keeping this alive would spend one on every writer
 * who walked past.
 */
export function PreviewSheet({
  book,
  output,
  label,
  typeset,
  manuscript,
  cover,
  onClose,
}: {
  book: Book;
  output: Format;
  /** The format's own name, as the export button says it. */
  label: string;
  typeset: TypesetOptions;
  /** Word's manuscript furniture — the same flag the export takes. */
  manuscript: boolean;
  /** The cover as a data URL — the EPUB pane packages a real file with it. */
  cover: string | null;
  onClose: () => void;
}) {
  // Escape, which is the first thing anybody tries on a layer over a page. Not
  // captured, so a control inside that handles its own keys gets there first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      {/* **No backdrop, which is a departure from every other layer here.**
          `KeywordGuide` and the roadmap's tool sheet both put one behind a
          panel that leaves the page showing at the edges, where it is the
          largest dismiss target on the screen and the one most people reach
          for. This panel is `inset-0`: a backdrop under it would be a control
          with not one pressable pixel, which is the dead UI the house rules
          forbid — and a scrim over a page nobody can see says nothing about
          the page. The two ways out are Escape and the Close in the corner,
          and both are on the bar the writer is already looking at. */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title} as ${label}`}
        className="oc-step-in absolute inset-0 flex flex-col overflow-hidden bg-surface"
      >
        {/* **One line, and as short as a bar can be.** Every pixel here is a
            pixel of book: the whole reason this is a layer rather than a step
            is the room, so a second line explaining what a preview is would be
            spending the thing it was built to win — and it would be explaining
            it to somebody looking straight at the file. The format still has
            to be named, since a writer arrives from a wizard set to any of
            four and the panes look alike at a glance, so it rides beside the
            title as a chip rather than under it as a sentence. */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-4 py-1.5">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h2 className="truncate text-sm font-bold tracking-tight text-fg">
              {book.title}
            </h2>
            <span className="shrink-0 rounded-md border border-line bg-raised px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-muted uppercase">
              {label}
            </span>
          </div>
          {/* A quiet outline rather than a fill: closing throws nothing away,
              and the one control on a bar of its own does not need a fill to
              be found. */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-3 py-1 text-sm
                       font-semibold text-fg outline-none transition-colors
                       hover:border-accent/60 hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Close ✕
          </button>
        </header>

        {/* `min-h-0` so this may shrink below its contents — the pane inside is
            a flex column whose stage takes whatever is left, and without it a
            long book pushes the header off the top of the window. */}
        <div className="flex min-h-0 flex-1 flex-col p-2">
          <ReviewPane
            book={book}
            output={output}
            typeset={typeset}
            manuscript={manuscript}
            cover={cover}
          />
        </div>
      </section>
    </div>
  );
}
