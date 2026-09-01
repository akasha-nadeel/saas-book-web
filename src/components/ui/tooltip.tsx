/**
 * The app's tooltip card.
 *
 * **On this shelf because there were eight of it.** `role="tooltip"` is
 * hand-rolled in `icon-rail.tsx`, `editor-toolbar.tsx`, `chapter-editor.tsx`
 * (twice), `bookshelf.tsx` (twice), `account-menu.tsx` and `tool-cloud.tsx` —
 * each with its own classes and its own guess at the shadow. This shelf takes
 * things on the third copy; the write switch would have been the ninth.
 *
 * **The design is `RailButton`'s, lifted rather than redrawn**, so adopting
 * this changes nothing on screen for the rails when they convert. The seven
 * others are not converted here: that is a refactor across the rails and the
 * shelf, and it belongs in its own change rather than riding along with a
 * switch in the assistant panel.
 *
 * **No `"use client"`, and that is not the same as being a Server Component.**
 * There is no state, no effect and no handler here — the reveal is CSS, driven
 * by the trigger's own `group` — so this renders wherever its caller does. The
 * same arrangement `assistant-reply.tsx` documents.
 *
 * **The trigger owns the positioning context**, which is the contract: it must
 * be `relative` and `group`, and it keeps its own accessible name. This draws
 * the card and nothing else.
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
   * centred over a 2rem button sticks out about 5.5rem each side; on the
   * microphone, which sits a short reach from the right edge of a 15rem rail,
   * that half is outside the panel — and `LeftPanel`'s box is `overflow-hidden`,
   * so it is not merely ugly, it is cut off. `end` anchors the card's right edge
   * and lets it grow inwards; `start` does the same from the left.
   */
  align?: "center" | "start" | "end";
  /**
   * Hold the label on one line.
   *
   * **Off by default, which reverses the rail's setting on purpose.** The rails
   * label buttons with a word or two and have the whole window to spill into.
   * A tooltip in a 240px panel does not: *"Letting the assistant write into
   * your chapter is part of Pro"* on one line is a card wider than the panel it
   * is in, and the panel clips it. So the default is a card that wraps inside a
   * measure, and the rails opt back in when they convert.
   */
  nowrap?: boolean;
  className?: string;
}) {
  /* Above and below take the alignment; left and right centre on the trigger's
     own axis, where there is no edge to run out of. */
  const across =
    align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";

  const placement = {
    top: `bottom-full mb-2 ${across}`,
    bottom: `top-full mt-2 ${across}`,
    left: "right-full top-1/2 mr-3.5 -translate-y-1/2",
    right: "left-full top-1/2 ml-3.5 -translate-y-1/2",
  }[side];

  return (
    <span
      role="tooltip"
      /* `pointer-events-none` is load-bearing rather than tidy: the card is
         always in the DOM and only faded out, so without it an invisible box
         would sit over whatever is next to the trigger and swallow presses.

         **`w-max` is the whole reason these cards were readable or not.** An
         absolutely-placed box is shrink-to-fit against its *containing block*,
         which here is the trigger — so on a 2rem microphone button the card was
         2rem wide and broke to one word a line, and `max-w-*` never came into
         it because the box was never near the cap. `w-max` sizes to the text's
         own width first; the cap then trims it back to a measure that fits the
         panel. */
      className={`pointer-events-none absolute ${placement} z-50 ${
        nowrap
          ? "whitespace-nowrap"
          : `w-max max-w-52 whitespace-normal ${
              align === "center" ? "text-center" : "text-left"
            }`
      } scale-95 rounded-xl border border-line bg-white px-3 py-1.5 text-xs
         leading-snug font-semibold text-balance text-neutral-900 opacity-0
         shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-150
         group-hover:scale-100 group-hover:opacity-100
         group-focus-visible:scale-100 group-focus-visible:opacity-100
         dark:border-white/10 dark:bg-[#212121] dark:text-white
         dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)] ${className}`}
    >
      {label}
    </span>
  );
}
