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
 * in `localStorage` where the shelf can read it during a synchronous render,
 * and the original here.
 *
 * **IndexedDB rather than localStorage, and that is forced.** A 1600×2560 JPEG
 * is a few hundred kilobytes, and base64 in `localStorage` inflates it by a
 * third against a budget the whole library shares — eight books would fill it
 * and start failing autosaves on chapters that have nothing to do with covers.
 * IndexedDB stores the bytes as bytes and is measured in hundreds of megabytes.
 *
 * **This is the second module allowed to touch storage**, and the exception is
 * narrow on purpose: `library-store.ts` owns everything synchronous, which is
 * what lets `useSyncExternalStore` read a snapshot during render. Nothing here
 * is read during a render — only the export reads it, and the export is
 * already async. A screen wanting cover art still asks `getCover`.
 *
 * **Every failure resolves rather than throwing.** Firefox in private browsing
 * refuses IndexedDB outright, and some privacy extensions stub it. A browser
 * that cannot store the original degrades to exactly today's behaviour — the
 * thumbnail is packaged — instead of breaking the export.
 */

const DB_NAME = "openchapter";
const DB_VERSION = 1;
const STORE = "print-covers";

/** What is kept per book: the bytes, and what they measure. */
export interface PrintCover {
  /** The artwork as a data URL, ready for `packageCover`. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * The open database, opened at most once.
 *
 * Held as the *promise* rather than the connection, so two calls arriving in
 * the same tick share one open request instead of racing to create two.
 */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error("[covers] could not open the database", request.error);
        resolve(null);
      };
      // Firefox in private browsing neither succeeds nor errors on some
      // versions; it blocks. Nothing here is worth hanging an export on.
      request.onblocked = () => resolve(null);
    } catch (err) {
      console.error("[covers] indexedDB unavailable", err);
      resolve(null);
    }
  });

  return dbPromise;
}

/** One transaction, wrapped so a caller sees a promise and never an event. */
function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const request = work(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => {
            console.error("[covers] request failed", request.error);
            resolve(null);
          };
          // A quota error arrives on the transaction rather than the request.
          tx.onabort = () => {
            console.error("[covers] transaction aborted", tx.error);
            resolve(null);
          };
        } catch (err) {
          console.error("[covers] transaction failed", err);
          resolve(null);
        }
      }),
  );
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
  const done = await run("readwrite", (store) => store.put(cover, bookId));
  // `put` resolves with the key, so anything non-null is a success; the null
  // path is the one where IndexedDB was unavailable or the quota refused it.
  return done !== null;
}

export async function getPrintCover(
  bookId: string,
): Promise<PrintCover | null> {
  const found = await run<PrintCover>("readonly", (store) => store.get(bookId));
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
  await run("readwrite", (store) => store.delete(bookId));
}

/**
 * Every book's artwork, for the one caller that clears the library.
 *
 * `clearLocalLibrary` wipes every `openchapter:` key when a different account
 * signs in on a shared browser. Cover art has to go with it, or the second
 * writer's export packages the first writer's picture.
 */
export async function clearPrintCovers(): Promise<void> {
  await run("readwrite", (store) => store.clear());
}
