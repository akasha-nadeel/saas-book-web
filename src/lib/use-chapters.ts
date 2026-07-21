"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getBody,
  getManifest,
  getServerBody,
  getServerManifest,
  subscribeToBody,
  subscribeToManifest,
  type Manifest,
} from "./chapter-store";

/**
 * React's view of the store. Kept apart from chapter-store.ts so that module
 * stays free of React and can be swapped for a Supabase client wholesale.
 *
 * Reading through useSyncExternalStore rather than an effect is what keeps this
 * SSR-safe without a loading flag: the server renders the empty snapshot, and
 * the client swaps in the real one immediately after hydration.
 */
export function useManifest(): Manifest {
  return useSyncExternalStore(
    subscribeToManifest,
    getManifest,
    getServerManifest,
  );
}

const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during SSR and the first render, true afterwards.
 *
 * Needed because an empty chapter list means two different things: "this book
 * has no chapters" and "storage hasn't been read yet". Without telling them
 * apart, every valid chapter would flash a "not found" screen on load.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
}

/** The raw stored document for one chapter, or null if it has never been saved. */
export function useChapterBody(id: string): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToBody(id, onStoreChange),
    [id],
  );

  const snapshot = useCallback(() => getBody(id), [id]);

  // Safe to return a string straight from storage: React compares snapshots
  // with Object.is, and equal strings are Object.is-equal, so no caching layer
  // is needed here the way it is for the parsed manifest.
  return useSyncExternalStore(subscribe, snapshot, getServerBody);
}
