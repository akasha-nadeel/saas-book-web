"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TOOL_GROUPS } from "@/lib/book-tools";

/**
 * The Tools entry in the landing bar, and the panel it opens.
 *
 * Four columns to the owner's reference: a small grey label over a column of
 * names set large and bold, with nothing else in them — no marks, no
 * descriptions, no rules between. The restraint is the design. Sixteen names
 * with a sentence each is the page this menu *links to*; a menu is a way of
 * getting somewhere, and the moment it starts explaining, it stops being one.
 *
 * **The columns are `TOOL_GROUPS`.** The same four groups, in the same order,
 * with the same names as the dashboard's Tools area and the guide at `/tools` —
 * so a reader meets one arrangement of sixteen things in three places rather
 * than three arrangements. A tool added to `book-tools.ts` appears here with no
 * edit, and one renamed cannot be renamed only here.
 *
 * **Every name goes to its own row on `/tools`**, not to the top of the page:
 * `/tools#comps` is the row for Comp titles, which is the whole point of a menu
 * this size. `tools-page.tsx` puts the id on each row and gives it the
 * scroll margin that keeps the heading clear of this bar.
 *
 * ---
 *
 * **Hover opens it. Hover is not the only thing that opens it.** A menu that
 * exists only under a pointer does not exist on a touchscreen, under a
 * keyboard, or for anybody driving the page by voice — and this one holds the
 * only links to two thirds of the product. So the trigger is a real `<button>`
 * with `aria-expanded`: pointer in opens it, a press toggles it, focus moving
 * into it opens it, and Escape closes it and returns the focus to the trigger.
 *
 * Four more things hold it together, each fixing a different way this shape
 * usually breaks:
 *
 * - **A grace period on the way out.** The panel hangs below the bar with a gap
 *   between it and the trigger, and a menu that closes the instant the pointer
 *   leaves the word closes while the pointer is travelling to the thing it was
 *   aimed at. `CLOSE_MS` is that grace; moving back into either half cancels it.
 * - **The bar must not slide away while it is open.** The header hides itself
 *   on a downward scroll, and it is this panel's ancestor — so it would take
 *   the open menu with it, off the top of the screen, while the pointer was
 *   inside. The menu reports its state upward (`onOpenChange`) and the header
 *   holds still until it closes.
 * - **A press outside closes it**, and that includes the rest of the bar. A
 *   panel this size sits over the page's first screenful; leaving it open
 *   behind a click somewhere else is a lid on the content.
 * - **Choosing closes it.** Every link here is either a navigation to another
 *   route or an in-page jump, and neither unmounts this component reliably —
 *   the same-route jump certainly does not. Left open, the panel would still be
 *   sitting over the section it just scrolled to.
 */

/**
 * How long the panel waits after the pointer leaves before it closes.
 *
 * Long enough to cross the gap between the trigger and the panel without
 * hurrying, short enough that a pointer that has genuinely moved on is not
 * followed by a menu. The usual figure for this pattern, and it is a delay
 * rather than a bridging element because an invisible box spanning the gap
 * would swallow clicks on whatever is under it.
 */
const CLOSE_MS = 180;

export function ToolsMenu({
  /** The label in the bar. */
  label = "Tools",
  /** Told the header, which must not slide away while this is open. */
  onOpenChange,
}: {
  label?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* `number` rather than `NodeJS.Timeout`: this is the browser's timer, and the
     Node typing would be a lie that only shows up under a different tsconfig. */
  const timer = useRef<number | null>(null);
  const panelId = useId();

  /* One place that changes the state, so the report upward cannot be forgotten
     at one of the six call sites below.

     All four of these are `useCallback` for one reason: `closeNow` is used by
     the document listeners in the effect below, which must be added once per
     opening rather than rebuilt on every render. `onOpenChange` is the parent's
     own `setState`, so the chain is stable in practice as well as in form. */
  const set = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const cancelClose = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const closeSoon = useCallback(() => {
    cancelClose();
    timer.current = window.setTimeout(() => set(false), CLOSE_MS);
  }, [cancelClose, set]);

  const closeNow = useCallback(() => {
    cancelClose();
    set(false);
  }, [cancelClose, set]);

  /* A pending timer outliving the component would call `setState` on something
     unmounted — and, through `onOpenChange`, tell a header that no longer has a
     menu that its menu just closed. */
  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeNow();
      /* Back to the trigger, or the focus is left on a panel that has gone and
         the next Tab starts from the top of the document. */
      triggerRef.current?.focus();
    };

    /* `pointerdown` rather than `click`: a press that begins outside should
       dismiss straight away, and waiting for the release lets a drag started
       outside end up looking like an interaction with the panel. */
    const onDown = (event: PointerEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) closeNow();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, closeNow]);

  return (
    <div
      ref={hostRef}
      className="relative"
      onPointerEnter={() => {
        cancelClose();
        set(true);
      }}
      onPointerLeave={closeSoon}
      /* Focus entering by keyboard opens it; focus leaving the whole group
         closes it at once rather than on the grace period, since a keyboard
         has no pointer in transit to wait for. */
      onFocus={() => {
        cancelClose();
        set(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          closeNow();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? closeNow() : set(true))}
        className="flex cursor-pointer items-center gap-1.5 font-sans text-[0.9375rem] font-medium text-lp-body outline-none hover:text-lp-ink focus-visible:text-lp-ink"
      >
        {label}
        {/* Turns over while open, one glyph rather than two swapped, so the
            row does not flicker as the panel arrives. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? "-rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* The panel.

          **Centred on the trigger and clamped to the page's own measure.** Four
          columns of names is far wider than the word that opens it, so hanging
          it from the trigger's left edge would run it off the right of the
          window; centred, it opens symmetrically under the middle of the bar,
          which is where this nav sits.

          `top-full` plus a margin is the gap the grace period exists to cross.

          **It is always in the DOM and hidden by `invisible`, not unmounted.**
          Two reasons, and the second is the one that bites: a panel that
          unmounts cannot animate its exit, and — more importantly — the
          `onBlur` above needs the element that focus is leaving to still be
          there when the event fires. */}
      <div
        id={panelId}
        className={`absolute top-full left-1/2 z-50 mt-3 w-[min(64rem,calc(100vw-3rem))] -translate-x-1/2 transition-[opacity,transform] duration-150 ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0"
        }`}
      >
        {/* `bg-lp-ground` rather than a translucent ground: this lands over the
            hero's wall of cards, and four columns of names read over a
            photograph of an application is the one way to make a menu this size
            unusable. The shadow is the page's own long soft one — see
            `AppWindow` — so the panel reads as the same material as the windows
            below it. */}
        <div className="rounded-2xl border border-lp-edge bg-lp-ground p-8 shadow-[0_28px_70px_-28px_rgba(15,15,16,0.45),0_8px_24px_-12px_rgba(15,15,16,0.25)]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4">
            {TOOL_GROUPS.map((group) => (
              <div key={group.title}>
                {/* The reference's small grey label. It is a heading rather
                    than a styled `<p>`, so the panel reads as four lists with
                    names to somebody hearing it rather than as sixteen loose
                    links. */}
                <h2 className="font-sans text-[0.8125rem] font-medium text-lp-faint">
                  {group.title}
                </h2>
                <ul className="mt-3 space-y-2">
                  {group.tools.map((tool) => (
                    <li key={tool.path}>
                      <Link
                        href={`/tools#${tool.path}`}
                        onClick={closeNow}
                        /* Large and bold, which is the reference and is also
                           what a menu of destinations should be: these are the
                           only content in the panel, so they take the weight
                           the label above them gives up. */
                        className="block font-serif text-[1.0625rem] leading-tight font-bold text-lp-ink outline-none hover:text-lp-accent-text focus-visible:text-lp-accent-text"
                      >
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* The way to the whole guide, for a reader who does not yet know
              which of the sixteen they want — which is most of them, and is the
              question a list of names cannot answer. */}
          <div className="mt-8 border-t border-lp-line pt-5">
            <Link
              href="/tools"
              onClick={closeNow}
              className="font-sans text-[0.9375rem] font-semibold text-lp-accent-text hover:underline"
            >
              See what each tool does →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
