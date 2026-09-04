"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToolsPanel } from "@/components/editor/tools-panel";
import type { Editor } from "@tiptap/react";
import type { Book, PaperColor } from "@/lib/library-store";
import type { Dictation } from "@/lib/editor/use-dictation";

/**
 * Page & type, as a card beside the rail rather than as the side panel.
 *
 * **The tools are not a panel, because they are not about the book.** Every
 * other tab in that column answers a question about the manuscript — where is
 * this word, what did this chapter say last week, who is this character — and
 * the answer is a list long enough to read down, so it gets the full-height
 * sheet next to the page. These are settings. They are a dozen short rows a
 * writer opens, changes one of, and closes, and giving them a 25rem column
 * meant the panel opened three-quarters empty and pushed the manuscript
 * sideways to do it.
 *
 * So it opens as a card at the rail's edge: as wide as its widest row, as tall
 * as its rows need, over the page rather than beside it — because unlike a
 * search result there is nothing here to read *against* the manuscript, and
 * the writer is looking at the control they came for.
 *
 * **It stays until it is dismissed**, by the round button above it, by Escape,
 * or by pressing Page again. Nothing else closes it — the same rule the side
 * panel follows, and here it is also what keeps it alive while a picker's own
 * menu (portalled, and therefore "outside" this card by any DOM test) is open.
 */

/** The card's width, and how far its left edge sits from the rail. */
const WIDTH = 320;
const GAP = 10;
/** Never nearer the top or bottom of the window than this. */
const MARGIN = 12;
/** Room for the close button, which sits above the card. */
const HEADROOM = 44;

export function ToolsPopover({
  open,
  onClose,
  book,
  editor,
  paper,
  typewriter,
  dictation,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  book: Book;
  editor?: Editor | null;
  paper: PaperColor;
  typewriter: boolean;
  dictation: Dictation;
  canWrite: boolean;
}) {
  const [at, setAt] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);

  /* **Measured, not positioned in the flow.** The rail scrolls, so a card
     rendered inside it would be clipped at its edge; portalled and `fixed`,
     nothing between the button and the card can cut it off. Placement is read
     from the rail's own right edge and the button's own top — laid out before
     paint, so the card never appears in one place and jumps to another. */
  useLayoutEffect(() => {
    if (!open) return;
    const rail = document.querySelector<HTMLElement>('[data-rail="left"]');
    if (!rail) return;

    const place = () => {
      const bar = rail.getBoundingClientRect();
      const button = document
        .querySelector<HTMLElement>('[data-panel-tab="page"]')
        ?.firstElementChild?.getBoundingClientRect();
      /* **Bounded by the rail, not by the window.** The card belongs to the
         column it comes out of, and the bar above that column is somebody
         else’s: clamped to the viewport, the close button rode up over the
         undo controls. So the top of the rail is the ceiling and the foot of
         the window is the floor. */
      const ceiling = bar.top + MARGIN;
      const floor = window.innerHeight - MARGIN;
      const height = Math.min(560, floor - ceiling - HEADROOM);
      const wanted = (button?.top ?? bar.top + 80) - HEADROOM;
      setAt({
        left: bar.right + GAP,
        top: Math.max(ceiling, Math.min(wanted, floor - height - HEADROOM)),
        height,
      });
    };

    place();
    window.addEventListener("resize", place);
    rail.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      rail.removeEventListener("scroll", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* **Escape belongs to the innermost thing that is open.** Every picker
         in here opens a portalled menu with its own Escape handler, and
         neither stops the event, so one press was closing the menu and the
         card behind it at once — the writer asked to back out of a font list
         and lost the whole card. Nothing can be nested inside the menu to
         catch that, since the menu is portalled to the body, so what is tested
         is simply whether one is open.

         **And that has to be asked on the way down.** The menu listens on
         `document`, which in the bubble phase is *before* `window`; React
         flushes a discrete event’s update at the end of that handler, so by
         the time a bubble-phase listener here ran the menu was already out of
         the DOM and the test always answered no. In capture the order is the
         other way about, and the question is asked while the answer is still
         true. */
      if (document.querySelector('[role="menu"], [role="listbox"], dialog[open]'))
        return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !at || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-tools-popover
      /* Below the portalled menus at 50, so a picker opened from a row in here
         lands over the card rather than under it; above the rail at 45, which
         is what it comes out from behind. */
      className="oc-tools-card fixed z-[46] flex flex-col items-start gap-2"
      style={{ left: at.left, top: at.top, width: WIDTH }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close page and type"
        /* The card's own ground, because it floats beside it and the two read
           as one thing lifted off the page. Its hover goes a step further up
           the same ladder rather than sideways into another colour. */
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   border border-line bg-float text-fg/80 shadow-lg outline-none
                   transition-colors hover:bg-lifted hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M6 6l8 8M14 6l-8 8" />
        </svg>
      </button>

      <div
        /* **Lighter than the page it stands on, not darker.**

           It wore `nav-chrome` — the rail's ground, the darkest surface in the
           set — on the reasoning that a control surface belongs to the app
           rather than to the manuscript. That is true of a rail, which is cut
           into the window's edge, and wrong for a sheet floating over the
           middle of it: drawn that way it read as a hole punched in the page.
           `float` is one step above the desk and the groups inside take
           `lifted`, one above that. See the note beside `--color-lifted`. */
        className="flex w-full flex-col overflow-hidden rounded-2xl border
                   border-line bg-float text-fg shadow-2xl"
        style={{ maxHeight: at.height }}
      >
        <h2 className="shrink-0 border-b border-lifted-line px-4 py-3 font-sans text-sm font-semibold text-fg">
          Page &amp; type
        </h2>
        <ToolsPanel
          book={book}
          editor={editor}
          paper={paper}
          typewriter={typewriter}
          dictation={dictation}
          canWrite={canWrite}
        />
      </div>
    </div>,
    document.body,
  );
}
