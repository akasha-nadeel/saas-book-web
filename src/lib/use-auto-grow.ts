"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A textarea that opens a line at a time and stops at a height.
 *
 * **A fixed `rows` is wrong at both ends.** The assistant's composer was
 * `rows={3}`: three lines of empty box at the foot of a 240px rail for a
 * question most writers type in one, and still only three lines for the writer
 * who types eight — which scrolls a box they are looking at rather than opening
 * it. This gives the box back the room while it is empty and lets it take what
 * it needs while it is not.
 *
 * **The scrollbar is the signal that growing has stopped**, which is the whole
 * of the interaction: below `max` there is never a scrollbar, because there is
 * nothing to scroll; at `max` one appears in the same frame the height stops
 * changing. `overflow-y` is therefore set here rather than in a class — a
 * standing `overflow-y-auto` would show a bar during the grow on the browsers
 * that round `scrollHeight` up.
 *
 * **Keyed on the value rather than driven from an input event.** A handler
 * alone would never see the caller setting the field back to `""` after a
 * question is sent, so the box would stand open at the height of a question
 * that is no longer in it. Anything that changes the value re-measures.
 *
 * **`useLayoutEffect`**, so the height is corrected before the browser paints.
 * In `useEffect` the wrong height is shown for a frame, which on a fast typist
 * is a box that shivers.
 *
 * **Deliberately not `field-sizing: content`.** Tailwind v4 has the utility and
 * it would delete this file, but the property is Chromium-only today: Firefox
 * and Safari would give a writer a one-line box that never grows, which is
 * worse than the fixed three lines this replaces. Worth revisiting when they
 * ship it — this is a dozen lines and its removal is a one-line swap.
 */
export function useAutoGrow(value: string, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;

    /* `auto` first, and it is not redundant: `scrollHeight` is the content's
       height *or the box's*, whichever is larger, so measuring without
       collapsing first would let the box grow and never shrink. */
    field.style.height = "auto";
    const wanted = field.scrollHeight;
    field.style.height = `${Math.min(wanted, max)}px`;
    field.style.overflowY = wanted > max ? "auto" : "hidden";
  }, [value, max]);

  return ref;
}
