"use client";

import { useEffect, useState } from "react";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface AutosaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

interface ControllerOptions {
  onChange: (state: AutosaveState) => void;
  debounceMs: number;
  maxWaitMs: number;
}

/**
 * How long to wait before trying a failed save again.
 *
 * **The retry used to be immediate, and that is a spin.** A failure puts the
 * value back so nothing is lost, and the `finally` below then saw work pending
 * and called `flush` straight away — which is right after a save that *worked*
 * and catastrophic after one that did not, because the commonest reason a save
 * fails is a full origin, and nothing about calling `setItem` again a
 * microtask later makes room. Measured on a full origin: the editor locked to
 * a crawl and the console took fifty identical quota errors in a few seconds.
 *
 * Long enough that a wedged save costs nothing, short enough that a transient
 * one is picked up before the writer notices. Any real edit reschedules
 * through `schedule` anyway, which is the path that matters.
 */
const RETRY_MS = 5000;

/**
 * The timer machinery, deliberately kept outside React.
 *
 * Two timers, because a plain debounce is not safe for a writing app: a
 * novelist in flow can type for ten minutes without ever pausing long enough
 * to trigger it. `debounceMs` catches the common case (they stopped to think);
 * `maxWaitMs` puts a hard ceiling on how much work is ever at risk.
 *
 * **Exported so it can be tested.** The hook around it is three lines of React
 * and everything that can go wrong is in here — the debounce against the
 * ceiling timer, the retry backoff, whether a failure is reported once or
 * fifty times, and whether the controller can still speak after a teardown.
 * All of that is reachable with fake timers, and none of it is reachable
 * through the hook without a renderer this project does not have.
 */
export function createAutosaveController<T>({
  onChange,
  debounceMs,
  maxWaitMs,
}: ControllerOptions) {
  let save: (value: T) => void | Promise<void> = () => {};
  let pending: { value: T } | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let lastSavedAt: Date | null = null;
  let disposed = false;
  /** Failures since the last save that worked, so a stuck one is reported once
   *  rather than on every attempt for as long as it stays stuck. */
  let failures = 0;

  const emit = (status: SaveStatus) => {
    if (!disposed) onChange({ status, lastSavedAt });
  };

  const clearTimers = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (maxWaitTimer) clearTimeout(maxWaitTimer);
    if (retryTimer) clearTimeout(retryTimer);
    debounceTimer = null;
    maxWaitTimer = null;
    retryTimer = null;
  };

  const flush = async (): Promise<void> => {
    if (!pending) return;
    // A save is already running. Leave the value pending — the in-flight save
    // picks it up when it finishes rather than racing it.
    if (inFlight) return;

    clearTimers();
    const { value } = pending;
    pending = null;

    inFlight = true;
    emit("saving");
    let failed = false;
    try {
      await save(value);
      failures = 0;
      lastSavedAt = new Date();
      emit(pending ? "unsaved" : "saved");
    } catch (err) {
      failed = true;
      failures += 1;
      // Once per run of failures. A save that stays broken is one fact, and
      // repeating it every few seconds buries whatever else is in the console.
      if (failures === 1) console.error("[autosave] save failed", err);
      // Put the value back so the next attempt retries it, rather than
      // silently dropping the writer's work.
      pending ??= { value };
      emit("error");
    } finally {
      inFlight = false;
      // Straight on after a save that worked — that is the newer keystrokes
      // arriving mid-save, and they should land at once. After one that did
      // not, wait: see RETRY_MS.
      if (pending && !failed) void flush();
      else if (pending) retryTimer = setTimeout(() => void flush(), RETRY_MS);
    }
  };

  return {
    /** Kept current from an effect, so callers needn't memoise their save fn. */
    setSave(next: (value: T) => void | Promise<void>) {
      save = next;
    },
    schedule(value: T) {
      pending = { value };
      emit("unsaved");

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void flush(), debounceMs);

      // Only start the ceiling timer if one isn't already counting down —
      // otherwise continuous typing would keep pushing it back too.
      maxWaitTimer ??= setTimeout(() => void flush(), maxWaitMs);
    },
    flush,
    /**
     * Take the controller back out of its disposed state.
     *
     * **Called at the top of the effect that disposes it, which is not
     * belt-and-braces — it is the whole fix.** React runs an effect
     * setup → cleanup → setup in StrictMode, which Next turns on by default in
     * development. The cleanup calls `dispose`, and `disposed` was a one-way
     * latch: the second setup got a controller that still saved (nothing else
     * is gated on the flag) and could never *say* anything again, because
     * `emit` is. So the indicator in the corner of the editor sat on its
     * initial "Saved" for the life of the page — through failures, through a
     * full origin, through everything.
     *
     * That is how a writer came to be looking at "Saved" beside a
     * `QuotaExceededError`, which is the worst thing this app can put on a
     * screen: the one word telling them their work is safe, saying so while it
     * is being thrown away.
     */
    activate() {
      disposed = false;
    },
    dispose() {
      void flush();
      clearTimers();
      disposed = true;
    },
  };
}

interface AutosaveOptions<T> {
  /** Persist the value. May be async; calls are serialised so none overlap. */
  save: (value: T) => void | Promise<void>;
  debounceMs?: number;
  maxWaitMs?: number;
}

export function useAutosave<T>({
  save,
  debounceMs = 800,
  maxWaitMs = 5000,
}: AutosaveOptions<T>) {
  const [state, setState] = useState<AutosaveState>({
    status: "saved",
    lastSavedAt: null,
  });

  // Lazy initialiser rather than a ref: this value is read during render, and
  // useState is the primitive that permits that while staying stable for the
  // lifetime of the component.
  const [controller] = useState(() =>
    createAutosaveController<T>({
      onChange: setState,
      debounceMs,
      maxWaitMs,
    }),
  );

  useEffect(() => {
    controller.setSave(save);
  }, [controller, save]);

  // Flush on tab hide and on unmount. `visibilitychange` is the reliable
  // signal here; `beforeunload` is ignored on mobile Safari and friends.
  useEffect(() => {
    // Paired with the `dispose` in the cleanup below, so a controller that is
    // torn down and set up again — which StrictMode does to every effect in
    // development — can still report. See `activate`.
    controller.activate();

    const onHide = () => {
      if (document.visibilityState === "hidden") void controller.flush();
    };
    const onPageHide = () => void controller.flush();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      controller.dispose();
    };
  }, [controller]);

  return {
    schedule: controller.schedule,
    flush: controller.flush,
    status: state.status,
    lastSavedAt: state.lastSavedAt,
  };
}
