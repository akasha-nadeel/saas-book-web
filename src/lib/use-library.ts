"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getBody,
  getCover,
  getServerCover,
  getServerBody,
  getNotes,
  getPrefs,
  getServerNotes,
  getServerPrefs,
  getServerShelf,
  getShelf,
  subscribeToBody,
  subscribeToCover,
  subscribeToNotes,
  subscribeToPrefs,
  subscribeToShelf,
  type Prefs,
  type Shelf,
} from "./library-store";

/**
 * React's view of the store. Kept apart from library-store.ts so that module
 * stays free of React and can be swapped for a Supabase client wholesale.
 *
 * Reading through useSyncExternalStore rather than an effect is what keeps this
 * SSR-safe without a loading flag: the server renders the empty snapshot, and
 * the client swaps in the real one immediately after hydration.
 */
export function useShelf(): Shelf {
  return useSyncExternalStore(subscribeToShelf, getShelf, getServerShelf);
}

const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during SSR and the first render, true afterwards.
 *
 * Needed because an empty shelf means two different things: "no books yet" and
 * "storage hasn't been read yet". Without telling them apart, every valid page
 * would flash an empty or not-found screen on load.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
}

/** The raw stored document for one chapter, or null if never saved. */
export function useChapterBody(id: string): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToBody(id, onStoreChange),
    [id],
  );
  const snapshot = useCallback(() => getBody(id), [id]);

  // Safe to return a string straight from storage: React compares snapshots
  // with Object.is, and equal strings are Object.is-equal, so no caching layer
  // is needed here the way it is for the parsed shelf.
  return useSyncExternalStore(subscribe, snapshot, getServerBody);
}

/** A book's cover art as a data URL, or null. */
export function useCover(bookId: string): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToCover(bookId, onStoreChange),
    [bookId],
  );
  const snapshot = useCallback(() => getCover(bookId), [bookId]);
  return useSyncExternalStore(subscribe, snapshot, getServerCover);
}

/** How the writer likes the editor to behave. Persisted, and shared across tabs. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribeToPrefs, getPrefs, getServerPrefs);
}

/** A chapter's notes, or null if none have been written. */
export function useNotes(id: string): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToNotes(id, onStoreChange),
    [id],
  );
  const snapshot = useCallback(() => getNotes(id), [id]);
  return useSyncExternalStore(subscribe, snapshot, getServerNotes);
}
