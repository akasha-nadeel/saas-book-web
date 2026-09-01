"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The app's tooltip card.
 *
 * **On this shelf because there were eight of it.** `role="tooltip"` was
 * hand-rolled in `icon-rail.tsx`, `editor-toolbar.tsx`, `chapter-editor.tsx`
 * (twice), `bookshelf.tsx` (twice), `account-menu.tsx` and `tool-cloud.tsx` —
 * each with its own classes and its own guess at the shadow. The design here is
 * `RailButton`'s, lifted rather than redrawn, so adopting it changed nothing on
 * screen for the rails.
 *
 * **It is portalled and `fixed`, and that is the whole reason this file has
 * state.** It was `absolute` inside its trigger, which works until the trigger
 * sits in a box with `overflow` — and in this app it usually does: the left
 * panel's inner box is `overflow-hidden`, the chapter list scrolls, the matter
 * cards clip their own content, and a card's tooltip was simply invisible.
 * `row-menu.tsx` and `PageConnector` reached the same conclusion for the same
 * reason; the note on the connector puts it best — the panel sits between two
 * scroll containers and an animating rail, and any one of them can clip a box
 * that leaves it.
 *
 * **The trigger is found rather than declared.** This renders a zero-size probe
 * in the caller's markup and reads `parentElement`, so every existing call site
 * kept working when it moved to a portal — none of them had to be restructured
 * into a wrapper. The trigger still needs `relative`; it no longer needs to be
 * the tooltip's containing block, but it is what the position is measured from.
 */
export function Tooltip({
  label,
  side = "top",
  align = "center",
  nowrap = false,
  className = "",
}: {
  label: string;
  /** Which way the card sits from its trigger. */
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Which of the card's edges lines up with the trigger's, above and below.
   *
   * **Centred is wrong for a control near the edge of a panel.** A 13rem card
   * centred over a 2rem button sticks out about 5.5rem each side, and on a
   * control near the edge of a 15rem rail that half lands outside the window.
   * `end` anchors the card's far edge and lets it grow inwards; `start` does
   * the same from the near one.
   */
  align?: "center" | "start" | "end";
  /**
   * Hold the label on one line.
   *
   * **Off by default, which reverses the rail's setting on purpose.** The rails
   * label buttons with a word or two and have the whole window to spill into. A
   * tooltip beside a 240px panel does not: *"Letting the assistant write into
   * your chapter is part of Pro"* on one line is a card wider than the panel it
   * belongs to.
   */
  nowrap?: boolean;
  className?: string;
}) {
  const probe = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    const trigger = probe.current?.parentElement;
    if (!trigger) return;

    /* Measured on the way in rather than held and kept fresh: a tooltip is
       shown for a second at a time, and a rect read at that moment is right
       even though the rail behind it animates and the panel scrolls. */
    const show = () => setBox(trigger.getBoundingClientRect());
    const hide = () => setBox(null);

    trigger.addEventListener("pointerenter", show);
    trigger.addEventListener("pointerleave", hide);
    trigger.addEventListener("focus", show);
    trigger.addEventListener("blur", hide);
    // A press is a decision made; the label for it has done its job.
    trigger.addEventListener("pointerdown", hide);

    return () => {
      trigger.removeEventListener("pointerenter", show);
      trigger.removeEventListener("pointerleave", hide);
      trigger.removeEventListener("focus", show);
      trigger.removeEventListener("blur", hide);
      trigger.removeEventListener("pointerdown", hide);
    };
  }, []);

  const card = box ? (
    <span
      role="tooltip"
      /* `pointer-events-none` is load-bearing rather than tidy: the card is
         laid over whatever is next to the trigger, and without it the press it
         is describing would land on the label instead. */
      className={`pointer-events-none fixed z-[60] ${
        nowrap
          ? "whitespace-nowrap"
          : `w-max max-w-52 whitespace-normal ${
              align === "center" ? "text-center" : "text-left"
            }`
      } rounded-xl border border-line bg-white px-3 py-1.5 text-xs leading-snug
         font-semibold text-balance text-neutral-900
         shadow-[0_4px_20px_rgba(0,0,0,0.12)]
         dark:border-white/10 dark:bg-[#212121] dark:text-white
         dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)] ${className}`}
      style={placement(box, side, align)}
    >
      {label}
    </span>
  ) : null;

  return (
    <>
      {/* The probe. Zero-size and hidden from the tree, so it changes no
          layout and is announced to nobody — its only job is to point at the
          element this tooltip belongs to. */}
      <span ref={probe} aria-hidden="true" className="hidden" />
      {card && typeof document !== "undefined"
        ? createPortal(card, document.body)
        : null}
    </>
  );
}

/** Where the card goes, in viewport coordinates. */
function placement(
  box: DOMRect,
  side: "top" | "bottom" | "left" | "right",
  align: "center" | "start" | "end",
): React.CSSProperties {
  const GAP = 8;

  if (side === "left") {
    return {
      right: window.innerWidth - box.left + GAP,
      top: box.top + box.height / 2,
      transform: "translateY(-50%)",
    };
  }
  if (side === "right") {
    return {
      left: box.right + GAP,
      top: box.top + box.height / 2,
      transform: "translateY(-50%)",
    };
  }

  /* Above and below take the alignment. `right` is measured from the window's
     own right edge, which is what lets an `end`-aligned card grow leftwards
     without knowing its own width. */
  const across =
    align === "start"
      ? { left: box.left }
      : align === "end"
        ? { right: window.innerWidth - box.right }
        : { left: box.left + box.width / 2, transform: "translateX(-50%)" };

  return side === "top"
    ? { bottom: window.innerHeight - box.top + GAP, ...across }
    : { top: box.bottom + GAP, ...across };
}
