"use client";

/**
 * Paper and theme — the rows, and the button in the top bar that opens them.
 *
 * **It used to be three presses down.** The rail's Tools tab, then the paper
 * tool in the floating strip, then the panel beside it — for the one thing in
 * that strip that does not touch the manuscript. Type, a picture, dictation,
 * typewriter scrolling and the paragraph marks all act on the book being
 * written; paper colour, appearance and tint are how the *app* looks, which is
 * the top bar's own stated job: "a view control, so it stands with the two that
 * leave the app rather than beside the File menu."
 *
 * **A settings popover, not a menu**, which is why `ui/menu.tsx` is not reused
 * here despite solving the placement. It renders `role="menu"` over
 * `menuitem`/`menuitemradio` children, and this is a paper list, a segmented
 * appearance control and a row of tint swatches. Fitting it to menu semantics
 * would mean either lying about the roles or unpacking three compact controls
 * into twenty rows, and the compactness is the point of the panel.
 *
 * **Escape is allowed to be ordinary here, and that was checked rather than
 * assumed.** `tools-popover.tsx` needs a capture-phase listener and an
 * open-menu test because the Type panel's pickers each portal a menu with its
 * own `document` handler, so a bubble-phase test always answered "no menu
 * open" and one press shut both. Nothing in this panel opens anything:
 * `ThemeToggle` and `TintSwatches` are plain buttons. If a picker is ever
 * added here, that rule comes with it.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle, TintSwatches } from "@/components/theme/theme-toggle";
import { RailMark, useMarkHandle } from "@/components/editor/rail-mark";
import { setPref, type PaperColor } from "@/lib/library-store";

/**
 * The papers, in one place.
 *
 * **There were two lists**, one here and one in `format-controls.tsx` for the
 * phone, and they had already drifted: different labels, and the phone's was
 * missing "Match the theme" entirely — so the same setting offered a different
 * set depending on the width of the window. Moving the control is the moment to
 * pay that off.
 */
export const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  /* First, because it is what a theme sets and what most writers will be on:
     the sheet follows the app until they say otherwise. Its swatch is the
     paper the theme is actually painting, read from the same custom property
     the page uses, so the row shows the colour rather than describing it. */
  { value: "theme", label: "Match the theme", swatch: "var(--paper-bg)" },
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

/** The rows themselves, so the popover and the phone's sheet cannot disagree. */
export function PaperThemeRows({ paper }: { paper: PaperColor }) {
  return (
    <>
      <SectionHeader className="mb-2">Paper</SectionHeader>
      {/* Rows rather than a row of swatches: the panel has the width for the
          name, and colours with their names read faster than colours you have
          to hover to identify. */}
      <ListGroup tone="lifted" as="ul">
        {PAPERS.map((option) => (
          <ListRow
            key={option.value}
            title={option.label}
            onClick={() => setPref("paper", option.value)}
            leading={
              <span
                aria-hidden="true"
                /* `block`, or the height and width have nothing to apply to:
                   the row wraps `leading` in a plain span, so this is an inline
                   box unless it is told otherwise, and it came out a sliver. */
                className={`block h-5 w-5 shrink-0 rounded-full border ${
                  paper === option.value
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-line"
                }`}
                style={{ background: option.swatch }}
              />
            }
            trailing={
              paper === option.value ? (
                <span className="text-accent">✓</span>
              ) : null
            }
          />
        ))}
      </ListGroup>

      {/* **The theme is here and not a control of its own**, because it is the
          same question the paper asks — how bright is this going to be — and
          the writer asking it is in front of the manuscript at midnight. Two
          glyphs for one decision is two places to look for it. */}
      <SectionHeader className="mt-4 mb-2">Theme</SectionHeader>
      <ListGroup tone="lifted">
        <ListRow title="Appearance" trailing={<ThemeToggle />} />
        {/* Under the three schemes, because they are one setting with nine
            answers — and in the same panel as the paper, so how the app looks
            and how the page looks are settled in one place. The paper stays its
            own choice: a white sheet under a dark app is the commonest pairing
            there is.

            The swatches take the row's whole width rather than its trailing
            slot: circles beside a label squeezed the word "Colour" to a single
            letter in a 16rem panel. */}
        <ListRow>
          <span className="mb-2 block text-[13px] text-fg">Colour</span>
          <TintSwatches />
        </ListRow>
      </ListGroup>
    </>
  );
}

/** Clear of the window's edges, the same margin the tools popover keeps. */
const MARGIN = 12;
/** Below the trigger, not touching it. */
const GAP = 8;

export function PaperThemeButton({ paper }: { paper: PaperColor }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number; maxHeight: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const mark = useMarkHandle();

  const close = useCallback(() => setOpen(false), []);

  /*
   * Placed before paint, or the panel is seen at the top left of the window for
   * a frame before it jumps under its button — the reason `ui/menu.tsx` uses a
   * layout effect for the same job.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const button = triggerRef.current?.getBoundingClientRect();
      const card = cardRef.current;
      if (!button || !card) return;

      const floor = window.innerHeight - MARGIN;
      const top = button.bottom + GAP;
      /* Right-aligned to the trigger, then pulled back inside the window. The
         button sits in the bar's right-hand group, so a left-aligned panel
         would hang off the edge of the screen. */
      const width = card.offsetWidth;
      const left = Math.max(MARGIN, Math.min(button.right - width, window.innerWidth - width - MARGIN));

      setAt((now) =>
        now && now.left === left && now.top === top && now.maxHeight === floor - top
          ? now
          : { left, top, maxHeight: floor - top },
      );
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  /** Escape, and a press anywhere that is neither the panel nor the button. */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      // Back where it came from, so the next Tab carries on down the bar.
      triggerRef.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((now) => !now)}
        onPointerEnter={mark.onEnter}
        onPointerLeave={mark.onLeave}
        aria-label="Paper and theme"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center
                    rounded-lg transition-colors hover:bg-raised ${
                      open ? "bg-raised text-fg" : "text-muted"
                    }`}
      >
        <RailMark markRef={mark.ref} mark="paper" size={18} />
        {!open && <Tooltip label="Paper and theme" side="bottom" align="end" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={cardRef}
            role="dialog"
            aria-label="Paper and theme"
            /* Above the bar and the rail, below a portalled menu at 50 — the
               same ladder `tools-popover.tsx` reads, one rung up from the rail
               it no longer has to clear. */
            className="oc-tools-card scroll-slim fixed z-[46] w-64 overflow-y-auto
                       rounded-2xl border border-line bg-float p-3 shadow-2xl"
            style={{
              left: at?.left ?? -9999,
              top: at?.top ?? -9999,
              maxHeight: at?.maxHeight,
              /* Measured on the first pass, so it must be laid out before it is
                 placed — and invisible until it has been, or it flashes in the
                 corner. */
              visibility: at ? "visible" : "hidden",
            }}
          >
            <PaperThemeRows paper={paper} />
          </div>,
          document.body,
        )}
    </>
  );
}
