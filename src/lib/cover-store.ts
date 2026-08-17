/**
 * The writer's cover artwork at the size they gave it to us.
 *
 * **This exists because the app was checking a standard and then breaking it
 * itself.** `cover-check.ts` tells a writer their cover has to be at least
 * 1000px tall and 625 wide and that 1600×2560 is what the shops recommend.
 * `image-import.ts` then stored every cover at 700px — right for the shelf,
 * where a cover is rendered about 150px wide and every book in the library
 * shares one 5MB origin budget — and the EPUB packaged *that*. So a writer
 * uploaded perfect artwork, passed our own check, and shipped a 495×700
 * picture, with nothing on any screen saying it had been shrunk.
 *
 * The thumbnail is still right for the shelf, so both are kept: the small one
 * where the shelf can read it during a synchronous render, and the original
 * here.
 *
 * **This was the first thing to leave `localStorage`, and the argument it made
 * eventually took the whole library with it.** A 1600×2560 JPEG is a few
 * hundred kilobytes, and base64 in `localStorage` inflated it by a third
 * against a five-megabyte budget the whole library shared — eight books would
 * have filled it and started failing autosaves on chapters that had nothing to
 * do with covers. Every other store followed on 2026-08-17; see the note in
 * `library-store.ts`. The two are still kept apart, because the *thumbnail*
 * syncs to Postgres and this does not.
 *
 * **This is the second module allowed to touch storage**, and the exception is
 * narrow on purpose: `library-store.ts` owns everything synchronous, which is
 * what lets `useSyncExternalStore` read a snapshot during render. Nothing here
 * is read during a render — only the export reads it, and the export is
 * already async. A screen wanting cover art still asks `getCover`.
 *
 * **The transport it was built on now lives in `store-db.ts`**, because the
 * forty lines of `IDBRequest`-to-promise plumbing written here turned out to be
 * the whole of what the rest of the library needed when it moved off
 * `localStorage` too. Two `indexedDB.open` calls on one name at different
 * versions block each other, so there is exactly one `openDb` in the app and
 * every store — this one included — is declared in its one `onupgradeneeded`.
 *
 * **Every failure resolves rather than throwing.** Firefox in private browsing
 * refuses IndexedDB outright, and some privacy extensions stub it. A browser
 * that cannot store the original degrades to exactly today's behaviour — the
 * thumbnail is packaged — instead of breaking the export.
 */

import { PRINT_COVERS, run } from "./store-db";

/** What is kept per book: the bytes, and what they measure. */
export interface PrintCover {
  /** The artwork as a data URL, ready for `packageCover`. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Keep this book's full-size artwork.
 *
 * Returns whether it was stored. A false is not an error the writer needs to
 * see as a failure — their cover *is* set, and the shelf shows it — so callers
 * treat it as "the export will use the smaller copy" rather than as a broken
 * save. The cover tool says so on the page.
 */
export async function putPrintCover(
  bookId: string,
  cover: PrintCover,
): Promise<boolean> {
  const done = await run(PRINT_COVERS, "readwrite", (store) => store.put(cover, bookId));
  // `put` resolves with the key, so anything non-null is a success; the null
  // path is the one where IndexedDB was unavailable or the quota refused it.
  return done !== null;
}

export async function getPrintCover(
  bookId: string,
): Promise<PrintCover | null> {
  const found = await run<PrintCover>(PRINT_COVERS, "readonly", (store) => store.get(bookId));
  // Written by us, but read back a version later out of a store no compiler
  // has checked — the same narrowing `sync.ts` does on the way out of Postgres.
  if (
    !found ||
    typeof found.dataUrl !== "string" ||
    typeof found.width !== "number" ||
    typeof found.height !== "number"
  ) {
    return null;
  }
  return found;
}

export async function deletePrintCover(bookId: string): Promise<void> {
  await run(PRINT_COVERS, "readwrite", (store) => store.delete(bookId));
}

/**
 * Which books have artwork in here, without reading any of it.
 *
 * For the sweep in `library-store.ts`, which is cleaning up after a real leak:
 * `deletePrintCover` was reachable only from `clearCover` until 2026-08-17, so
 * every book deleted before that left its full-size artwork behind — up to
 * 2560px of JPEG apiece, measured at about sixteen megabytes on one library,
 * under keys nothing would ever ask for again.
 *
 * `getAllKeys` rather than `getAll`, or asking the question would materialise
 * every one of those pictures to answer it.
 */
export async function printCoverIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>(PRINT_COVERS, "readonly", (store) =>
    store.getAllKeys(),
  );
  return (keys ?? []).filter((k): k is string => typeof k === "string");
}

/**
 * Every book's artwork, for the one caller that clears the library.
 *
 * `clearLocalLibrary` wipes every `openchapter:` key when a different account
 * signs in on a shared browser. Cover art has to go with it, or the second
 * writer's export packages the first writer's picture.
 */
export async function clearPrintCovers(): Promise<void> {
  await run(PRINT_COVERS, "readwrite", (store) => store.clear());
}
