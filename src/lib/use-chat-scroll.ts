"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a chat pinned to its newest message **without moving the page it sits
 * on**. Returns the ref to put on the scrolling list itself.
 *
 * The obvious version was a sentinel `<div>` at the foot of the list and
 * `scrollIntoView({ block: "end" })` on it, and it is wrong here for a reason
 * that is invisible in a full-window chat: `scrollIntoView` scrolls **every**
 * scrollable ancestor, not the nearest one. These panels sit inside tool
 * screens which are themselves a scrolling column, so each send hauled the
 * whole page upwards to bring that sentinel into the viewport — the writer
 * pressed Enter and the form they were working in left the screen. Setting
 * `scrollTop` touches one element and nothing above it.
 *
 * **It measures rather than lists what changed.** The effect has no dependency
 * array on purpose: a chat's height moves for a new turn, for the spinner
 * arriving, for an error, and — in the assistant's case — for every token of a
 * streamed reply, and a dependency list is a second copy of that set which
 * goes stale the moment a panel grows a fifth thing to draw. Comparing the
 * measured height is the one condition that covers all of them, and the body
 * is a property read on the renders where nothing moved.
 */
export function useChatScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    if (list.scrollHeight === lastHeight.current) return;
    lastHeight.current = list.scrollHeight;
    list.scrollTop = list.scrollHeight;
  });

  return ref;
}
