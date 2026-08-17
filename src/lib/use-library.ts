"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseActivity, type Activity } from "./activity";
import { parseArc, type ArcReader } from "./arc";
import { parseBible, type BibleEntry } from "./bible";
import { parseLedger, type Entry } from "./ledger";
import { parseHistory, type Snapshot } from "./history";
import { parseIdeas, type Idea } from "./ideas";
import {
  mergeSeriesBible,
  type SeriesBook,
  type SeriesEntry,
} from "./series";
import {
  getBody,
  getBodyReload,
  getCover,
  getServerCover,
  getServerBody,
  getServerBodyReload,
  getBibleRaw,
  getBiblesRaw,
  getServerBibleRaw,
  getServerBiblesRaw,
  subscribeToBible,
  subscribeToBibles,
  getArcRaw,
  getServerArcRaw,
  subscribeToArc,
  getLedgerRaw,
  getServerLedgerRaw,
  subscribeToLedger,
  getActivityRaw,
  getServerActivityRaw,
  subscribeToActivity,
  getHistoryRaw,
  getServerHistoryRaw,
  subscribeToHistory,
  getIdeasRaw,
  getNotes,
  getPrefs,
  getServerIdeasRaw,
  getServerNotes,
  getServerPrefs,
  getServerShelf,
  getShelf,
  subscribeToBody,
  subscribeToBodyReload,
  subscribeToCover,
  subscribeToIdeas,
  subscribeToNotes,
  subscribeToPrefs,
  getCoverEpoch,
  getServerStorageTrouble,
  getStoragePhase,
  getStorageTrouble,
  getSyncPhase,
  subscribeToShelf,
  subscribeToStorageLoad,
  subscribeToStorageTrouble,
  subscribeToSync,
  type Prefs,
  type Shelf,
  type StorageTrouble,
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

const onServer = () => false;
const readOnClient = () => getStoragePhase() === "ready";

/**
 * False during SSR and until this browser's storage has been read.
 *
 * Needed because an empty shelf means two different things: "no books yet" and
 * "storage hasn't been read yet". Without telling them apart, every valid page
 * would flash an empty or not-found screen on load.
 *
 * **It waits on the disk now, and every screen that already gated on it is
 * covered by that without changing a line.** The manuscript moved to IndexedDB,
 * which is asynchronous, so "the client is running" and "the library is
 * readable" stopped being the same instant — and the gap is the dangerous one:
 * the editor keys its writing surface on the chapter id rather than on the
 * text, deliberately, to protect the caret, so a surface mounted over a null
 * body keeps its empty document when the prose lands and the next autosave
 * writes that empty document over the chapter.
 *
 * A browser with no IndexedDB at all — private-mode Firefox, and the server —
 * has nothing to wait for and this reads exactly as it did before. See
 * `getStoragePhase`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToStorageLoad, readOnClient, onServer);
}

/**
 * False until the first reconcile with the server has finished.
 *
 * The companion to `useHydrated`, and needed for the state that one cannot
 * see: storage read, genuinely empty, books still arriving. See the note on
 * `getSyncPhase` in the store — a screen that treats that as "no books" tells a
 * writer their library is gone and then takes it back.
 *
 * Guard the *empty* states on this, never the loaded ones. A shelf with books
 * on it is worth showing the instant it is readable, whether or not the
 * download has caught up.
 */
const pendingOnServer = () => "pending" as const;

export function useLibrarySettled(): boolean {
  return (
    useSyncExternalStore(subscribeToSync, getSyncPhase, pendingOnServer) ===
    "settled"
  );
}

/**
 * Whether this browser has run out of room, and how badly.
 *
 * Read by one component — `StorageAlert` in the root layout — because a full
 * origin is a fact about the whole app rather than about the screen that
 * happened to notice it. See `StorageTrouble` in the store.
 */
export function useStorageTrouble(): StorageTrouble {
  return useSyncExternalStore(
    subscribeToStorageTrouble,
    getStorageTrouble,
    getServerStorageTrouble,
  );
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

/**
 * A counter that moves only when another tab saves this chapter — never on this
 * tab's own autosaves. The editor keys its surface on it so a cross-tab save
 * reloads the text without remounting the surface being typed into. See
 * subscribeToBodyReload for why the stored text itself can't do this job.
 */
export function useBodyReload(id: string): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToBodyReload(id, onStoreChange),
    [id],
  );
  const snapshot = useCallback(() => getBodyReload(id), [id]);
  return useSyncExternalStore(subscribe, snapshot, getServerBodyReload);
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

/**
 * A number that moves whenever any cover changes.
 *
 * For screens that read `hasCover` for a *list* of books. `useCover` is the
 * right hook for one book's artwork; this is for the case where the cover is
 * not the thing being rendered but is an input to something that is — the
 * dashboard's readiness findings, which are memoised on `books` and so cannot
 * see a write that leaves the shelf untouched.
 *
 * Name it as a dependency beside `books` and the memo recomputes when a cover
 * arrives. See `getCoverEpoch` for what the counter is for.
 */
export function useCoverEpoch(): number {
  return useSyncExternalStore(subscribeToShelf, getCoverEpoch, () => 0);
}

/** How the writer likes the editor to behave. Persisted, and shared across tabs. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribeToPrefs, getPrefs, getServerPrefs);
}

/** One book's story bible — people, places, things — alphabetically. */
export function useBible(bookId: string): BibleEntry[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToBible(bookId, onStoreChange),
    [bookId],
  );
  const snapshot = useCallback(() => getBibleRaw(bookId), [bookId]);
  const raw = useSyncExternalStore(subscribe, snapshot, getServerBibleRaw);
  return useMemo(() => parseBible(raw), [raw]);
}

/**
 * A whole series' bible, merged — every book's people, places and things as
 * one cast, each carrying the books that wrote it down.
 *
 * The books are passed in rather than looked up, because working out what is
 * in a series is `seriesOf()`'s job and the caller has the shelf already. They
 * must arrive in **reading order**: `mergeSeriesBible` takes the first book
 * that names someone as the one that introduced them.
 *
 * Both callbacks are keyed on the books serialised to a string, and rebuild
 * the list from that string rather than closing over the caller's array — an
 * array literal is a new value every render, which would resubscribe on each
 * one. JSON rather than a joined string, because a book title contains spaces
 * and very nearly anything else, and splitting one on a separator shreds it.
 */
export function useSeriesBible(books: readonly SeriesBook[]): SeriesEntry[] {
  const key = JSON.stringify(books);

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToBibles(idsIn(key), onStoreChange),
    [key],
  );
  const snapshot = useCallback(() => getBiblesRaw(idsIn(key)), [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, getServerBiblesRaw);

  return useMemo(() => {
    // The snapshot carries the stored bibles as well as the ids, so the merge
    // is built out of `raw` itself rather than reading storage a second time —
    // which also keeps the memo honest about what it depends on.
    const stored = new Map(JSON.parse(raw) as [string, string | null][]);
    return mergeSeriesBible(
      (JSON.parse(key) as SeriesBook[]).map((book) => ({
        book,
        entries: parseBible(stored.get(book.id) ?? null),
      })),
    );
  }, [key, raw]);
}

function idsIn(key: string): string[] {
  return (JSON.parse(key) as SeriesBook[]).map((b) => b.id);
}

/** One book's advance readers, the ones to chase first. */
export function useArc(bookId: string): ArcReader[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToArc(bookId, onStoreChange),
    [bookId],
  );
  const snapshot = useCallback(() => getArcRaw(bookId), [bookId]);
  const raw = useSyncExternalStore(subscribe, snapshot, getServerArcRaw);
  return useMemo(() => parseArc(raw), [raw]);
}

/** Every cost and every royalty the writer has recorded, newest first. */
export function useLedger(): Entry[] {
  const raw = useSyncExternalStore(
    subscribeToLedger,
    getLedgerRaw,
    getServerLedgerRaw,
  );
  return useMemo(() => parseLedger(raw), [raw]);
}

/** The writing log — net words per day, across the whole library. */
export function useActivity(): Activity {
  const raw = useSyncExternalStore(
    subscribeToActivity,
    getActivityRaw,
    getServerActivityRaw,
  );
  return useMemo(() => parseActivity(raw), [raw]);
}

/**
 * One chapter's saved versions, newest first.
 *
 * Parsed off the raw string for the same reason `useIdeas` is: the snapshot
 * `useSyncExternalStore` compares has to be referentially stable, and a parse
 * that returns a fresh array every call loops the store.
 */
export function useHistory(chapterId: string): Snapshot[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToHistory(chapterId, onStoreChange),
    [chapterId],
  );
  const snapshot = useCallback(() => getHistoryRaw(chapterId), [chapterId]);
  const raw = useSyncExternalStore(subscribe, snapshot, getServerHistoryRaw);
  return useMemo(() => parseHistory(raw), [raw]);
}

/**
 * The idea parking lot.
 *
 * Parsed here rather than in the snapshot, because `useSyncExternalStore`
 * demands a referentially stable value and `parseIdeas` returns a new array
 * every call — handing that back as the snapshot loops the store forever. The
 * raw string is the snapshot, and the parse is memoised off it.
 */
export function useIdeas(): Idea[] {
  const raw = useSyncExternalStore(
    subscribeToIdeas,
    getIdeasRaw,
    getServerIdeasRaw,
  );
  return useMemo(() => parseIdeas(raw), [raw]);
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
