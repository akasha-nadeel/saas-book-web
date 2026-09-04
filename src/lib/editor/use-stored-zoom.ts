"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setPref } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";
import { clampZoom } from "@/lib/editor/zoom";

/**
 * The page zoom: state at the speed of a gesture, storage at the speed of a
 * setting.
 *
 * **The two are not the same thing, and treating them as one made the gesture
 * sluggish.** Zoom was moved into `prefs` so it would survive a reload, and the
 * pinch handler then called `setPref` once per animation frame. That is not a
 * cheap call: it parses the stored prefs twice, stringifies the whole object,
 * writes `localStorage` *synchronously*, notifies every `usePrefs` listener in
 * the app — re-rendering the editor, the panels and the shelf — and queues a
 * push to Supabase. Sixty times a second, that is the lag.
 *
 * So the value a writer is dragging lives in React state, and the *setting* is
 * written once they stop.
 *
 * **`live ?? stored` is the same shape the chat panel uses** for a transcript
 * being streamed into: the local copy wins while it exists, and is dropped the
 * moment the store has caught up, so there is one value rather than two that
 * can disagree. It also solves the hydration problem a plain `useState(stored)`
 * would have — `usePrefs` answers with server defaults on the first render, and
 * seeding from that would lock in 100% and never pick the writer's own zoom up.
 */

/** How long after the last change the setting is written. */
const SETTLE_MS = 400;

export function useStoredZoom(): [number, (next: number) => void] {
  const stored = clampZoom(usePrefs().zoom);
  const [live, setLive] = useState<number | null>(null);

  /* What is waiting to be written, so the unmount flush below has something to
     write. Cleared by the write itself. */
  const pending = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const commit = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const value = pending.current;
    pending.current = null;
    if (value === null) return;

    setPref("zoom", value);
    /* Dropped now the store holds it. `setPref` notifies its listeners
       synchronously, so `stored` is already this value by the next render and
       the hand-over costs no flicker. */
    setLive(null);
  }, []);

  const setZoom = useCallback(
    (next: number) => {
      const value = clampZoom(next);
      setLive(value);
      pending.current = value;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(commit, SETTLE_MS);
    },
    [commit],
  );

  /**
   * Write what is owed on the way out.
   *
   * A writer who pinches and immediately closes the tab or opens another
   * chapter — the surface is remounted on every chapter change — would
   * otherwise lose the zoom they just set, which is the one case a debounce
   * introduces and the one this covers.
   */
  useEffect(() => commit, [commit]);

  return [live ?? stored, setZoom];
}
