"use client";

import { useSyncExternalStore } from "react";
import type { SaveStatus } from "./use-autosave";

/**
 * Where the save indicator lives.
 *
 * The editor knows whether a chapter is saved; the manuscript panel is where it
 * is shown, and the two are cousins rather than parent and child. Passing it
 * through would mean threading a prop down every layer between them, and
 * mirroring it into parent state from an effect cascades a render on every
 * keystroke. A tiny external store is what the rest of this codebase already
 * uses for exactly this shape of problem.
 */

export interface SaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

const IDLE: SaveState = Object.freeze({ status: "saved", lastSavedAt: null });

let state: SaveState = IDLE;
const listeners = new Set<() => void>();

/**
 * Replaced only when something actually changes, so the snapshot keeps a stable
 * reference between updates — useSyncExternalStore compares by identity and
 * loops forever otherwise.
 */
export function setSaveState(next: SaveState) {
  if (
    next.status === state.status &&
    next.lastSavedAt?.getTime() === state.lastSavedAt?.getTime()
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

export function getSaveState(): SaveState {
  return state;
}

export function getServerSaveState(): SaveState {
  return IDLE;
}

export function subscribeToSaveState(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Test seam: module state outlives a test file without this. */
export function resetSaveState() {
  state = IDLE;
  listeners.clear();
}

export function useSaveState(): SaveState {
  return useSyncExternalStore(
    subscribeToSaveState,
    getSaveState,
    getServerSaveState,
  );
}
