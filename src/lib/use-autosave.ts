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
 * The timer machinery, deliberately kept outside React.
 *
 * Two timers, because a plain debounce is not safe for a writing app: a
 * novelist in flow can type for ten minutes without ever pausing long enough
 * to trigger it. `debounceMs` catches the common case (they stopped to think);
 * `maxWaitMs` puts a hard ceiling on how much work is ever at risk.
 */
function createAutosaveController<T>({
  onChange,
  debounceMs,
  maxWaitMs,
}: ControllerOptions) {
  let save: (value: T) => void | Promise<void> = () => {};
  let pending: { value: T } | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let lastSavedAt: Date | null = null;
  let disposed = false;

  const emit = (status: SaveStatus) => {
    if (!disposed) onChange({ status, lastSavedAt });
  };

  const clearTimers = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (maxWaitTimer) clearTimeout(maxWaitTimer);
    debounceTimer = null;
    maxWaitTimer = null;
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
    try {
      await save(value);
      lastSavedAt = new Date();
      emit(pending ? "unsaved" : "saved");
    } catch (err) {
      console.error("[autosave] save failed", err);
      // Put the value back so the next attempt retries it, rather than
      // silently dropping the writer's work.
      pending ??= { value };
      emit("error");
    } finally {
      inFlight = false;
      if (pending) void flush();
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
