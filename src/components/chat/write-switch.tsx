"use client";

import Link from "next/link";
import { TIER_NAMES } from "@/lib/billing/tiers";
import { SwitchTrack } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * The switch that lets the assistant offer to put a passage into the chapter.
 *
 * **Off by default, and it is a switch rather than a hidden capability**
 * because the difference it makes is one a writer should be able to see and
 * turn off. With it off the assistant is exactly what it always was: it reads
 * the chapter and offers text. With it on, the prose it offers grows an Apply
 * control — and still nothing moves until that is pressed.
 *
 * **On a free account the switch stays live and refuses.** That is the house
 * rule for every metered control in this app: a disabled control has no press
 * to explain itself on, so a writer is left guessing what it would have done.
 * This one is pressable, says `Pro` beside itself, and the press is what opens
 * the explanation — never an effect on mount.
 */
export function WriteSwitch({
  on,
  locked,
  onToggle,
}: {
  on: boolean;
  /** Free plan: the switch may be pressed, but it may not be moved. */
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={locked ? false : on}
        onClick={onToggle}
        /* **`fg/70` rather than `muted`.** At the foot of a rail, beside a
           bordered Clear and a filled Send, `muted` read as a control that had
           been disabled rather than as one that is simply off — and this is the
           switch a writer has to find to turn the feature on at all. Off is
           still quieter than on; it is no longer indistinguishable from dead.

           `relative` and `group` are the tooltip's: it is placed against this
           button and revealed by this button's own hover and focus. */
        className="group relative flex items-center gap-2 rounded-md font-sans
                   text-xs text-fg/70 outline-none transition-colors
                   hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <SwitchTrack on={!locked && on} />
        {/* **The words stand down on the narrowest panel**, and the threshold
            moved down with the switch on 2026-09-04.

            It was `@[15rem]` against the composer *box*, back when this sat in
            that box's foot beside the microphone and Send: five controls on one
            line at `--sidebar-width: 15rem`, and a wrapped control row is worse
            than a shorter one. The switch is on the row above now, sharing it
            with nothing but Clear — about 164px of 216px — so it has room at a
            width where it used to have none, and hiding the label there would
            be standing down from a fight that is over.

            **The container is the composer's `<form>`**, which is what both
            rows are inside; the box below carries none of its own. Its content
            box is ~216px at the narrowest rail, so a threshold above that never
            matches there — which is the whole mechanism, and the reason the
            model pill's cost uses `@[15rem]` while this uses `@[13rem]`. The
            track, the chip and the tooltip all survive either way, so the
            control still says what it is. */}
        <span className="hidden @[13rem]:inline">Let it write</span>
        {/* **The app's own card, where a `title` used to be.** The browser's
            tooltip is an OS rectangle in the wrong font that takes a second to
            arrive, and this control is the one a writer has to understand
            before they can use the feature at all — so it gets the card the
            rails already use. It says which of the three states the switch is
            in, which the switch alone cannot. */}
        <Tooltip
          /* Left edge of the composer's control row: the card grows inwards
             from the switch rather than half of it hanging off the panel. */
          align="start"
          label={
            locked
              ? `Letting the assistant write into your chapter starts at ${TIER_NAMES.draft}.`
              : on
                ? "The assistant may offer to put a passage into this chapter."
                : "The assistant will only offer you text to copy."
          }
        />
      </button>

      {locked && (
        /* The way out sits beside the refusal rather than only inside the
           dialog it opens: a writer who already knows what Pro is should not
           have to be told again to get to it.

           **The app's one sanctioned gradient, and no new colour with it** —
           `upgrade-to` (indigo) into `upgrade-from` (purple), the pair the
           upgrade card and the pricing columns already wear. Both are stated
           identically in all three theme blocks, so the chip is the same by day
           and by night.

           **A literal `text-white` is right here and `text-accent-ink` would be
           wrong.** That token exists because the accent fill flips — white at
           night, near-black by day — and its ink has to flip with it. This
           ground does not flip, so its ink must not either. */
        <Link
          href="/upgrade"
          className="rounded-md bg-linear-to-r from-upgrade-to to-upgrade-from
                     px-1.5 py-[0.1875rem] font-sans text-[0.5625rem] font-bold
                     tracking-wide text-white uppercase outline-none
                     transition-opacity hover:opacity-90
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {TIER_NAMES.draft}
        </Link>
      )}
    </div>
  );
}
