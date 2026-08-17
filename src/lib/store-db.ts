/**
 * The IndexedDB transport — one database, one way in.
 *
 * **This is the disk the library sits on, and it exists because `localStorage`
 * is about five megabytes for the whole origin.** Bodies run 20–40KB a chapter,
 * cover thumbnails are capped at 250KB each and version history is bounded in
 * the megabytes, so three finished novels with covers is already most of the
 * budget — and what fails first is an autosave, on a chapter that had nothing
 * to do with whatever filled the room. IndexedDB is roughly 60% of free disk in
 * Chrome and 10% or 10GB in Firefox: a thousand times the space, for data of
 * exactly the same shape.
 *
 * **It was `cover-store.ts` first.** That module needed forty lines of
 * `IDBRequest`-to-promise plumbing to keep full-size cover artwork out of the
 * five megabytes, and those forty lines are the whole of what the rest of the
 * library needs too. So the transport is lifted here and `cover-store.ts`
 * imports it. Two `indexedDB.open` calls on one database name at different
 * versions block each other, so there is exactly one `openDb` in the app and
 * every store is declared in its one `onupgradeneeded`.
 *
 * **Every failure resolves rather than throwing**, which is inherited from that
 * module and is now load-bearing for the whole app: Firefox in private browsing
 * refuses IndexedDB outright and some privacy extensions stub it. A browser
 * that cannot open this degrades to `localStorage` — the old ceiling, and
 * exactly the old behaviour — instead of breaking.
 *
 * Values are **strings**, deliberately. The stores hold what `localStorage`
 * held: stringified Tiptap documents, data URLs, JSON. Storing structured
 * clones instead would be a second migration hiding inside the first, and every
 * reader downstream would change shape. (`print-covers` is the exception and
 * predates this: it stores an object, because it always did.)
 */

const DB_NAME = "openchapter";

/**
 * Version 2 adds the library's own stores beside the print covers.
 *
 * Bump this and add the store to `STORES` to add another; `onupgradeneeded`
 * creates whatever is missing, so an upgrade from either version lands in the
 * same place and a browser that has never opened the database gets all of them
 * in one go.
 */
const DB_VERSION = 2;

/** Full-size cover artwork, one object per book. Predates the rest. */
export const PRINT_COVERS = "print-covers";
/** One stringified Tiptap document per chapter. */
export const BODIES = "bodies";
/** One chapter note per chapter. */
export const NOTES = "notes";
/** Up to eight snapshots per chapter, as JSON. */
export const HISTORY = "history";
/** The shelf's cover thumbnails, as data URLs. */
export const COVERS = "covers";
/** Housekeeping: whether the move off localStorage has happened. */
export const META = "meta";

const STORES = [PRINT_COVERS, BODIES, NOTES, HISTORY, COVERS, META] as const;

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
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error("[store-db] could not open the database", request.error);
        resolve(null);
      };
      // Firefox in private browsing neither succeeds nor errors on some
      // versions; it blocks. Nothing here is worth hanging the app on.
      request.onblocked = () => resolve(null);
    } catch (err) {
      console.error("[store-db] indexedDB unavailable", err);
      resolve(null);
    }
  });

  return dbPromise;
}

/** Whether this browser gave us a database at all. */
export async function diskReady(): Promise<boolean> {
  return (await openDb()) !== null;
}

/**
 * A test seam: refuse every put after the nth.
 *
 * The quota tests used to mock `Storage.prototype.setItem`, which reaches
 * nothing once the manuscript is in here. Zero refuses everything, which is the
 * "this browser is full" case; a negative number turns it off again.
 *
 * **Puts only, never deletes.** A browser out of room still lets you remove
 * things — that is the whole reason the store gives up its version history to
 * land a save — so a seam that refused deletions too would be modelling a
 * failure that does not exist and would break the escape it is there to test.
 */
let failWritesAfter = -1;
let writes = 0;

export function __failWritesAfter(n: number) {
  failWritesAfter = n;
  writes = 0;
}

function refusePut(): boolean {
  if (failWritesAfter < 0) return false;
  writes += 1;
  return writes > failWritesAfter;
}

/** One transaction, wrapped so a caller sees a promise and never an event. */
export function run<T>(
  store: string,
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
          const tx = db.transaction(store, mode);
          const request = work(tx.objectStore(store));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => {
            console.error(`[store-db] ${store} request failed`, request.error);
            resolve(null);
          };
          // A quota error arrives on the transaction rather than the request.
          tx.onabort = () => {
            console.error(`[store-db] ${store} transaction aborted`, tx.error);
            resolve(null);
          };
        } catch (err) {
          console.error(`[store-db] ${store} transaction failed`, err);
          resolve(null);
        }
      }),
  );
}

/**
 * Everything in one store, as key/value pairs.
 *
 * `getAllKeys` and `getAll` in **one** transaction, so the two lists cannot be
 * taken from different states of the store — a chapter deleted between two
 * transactions would pair somebody's prose with the wrong id, which is the one
 * way this could corrupt a manuscript rather than merely lose one.
 */
export function entriesOf(store: string): Promise<[string, string][]> {
  return openDb().then(
    (db) =>
      new Promise<[string, string][]>((resolve) => {
        if (!db) {
          resolve([]);
          return;
        }
        try {
          const tx = db.transaction(store, "readonly");
          const objectStore = tx.objectStore(store);
          const keyRequest = objectStore.getAllKeys();
          const valueRequest = objectStore.getAll();

          tx.oncomplete = () => {
            const keys = keyRequest.result ?? [];
            const values = valueRequest.result ?? [];
            const out: [string, string][] = [];
            for (let i = 0; i < keys.length; i += 1) {
              const key = keys[i];
              const value = values[i];
              // Written by us, read back out of a store no compiler has ever
              // looked at — the same narrowing `sync.ts` does out of Postgres.
              if (typeof key === "string" && typeof value === "string") {
                out.push([key, value]);
              }
            }
            resolve(out);
          };
          tx.onabort = () => {
            console.error(`[store-db] ${store} read aborted`, tx.error);
            resolve([]);
          };
          tx.onerror = () => resolve([]);
        } catch (err) {
          console.error(`[store-db] ${store} could not be read`, err);
          resolve([]);
        }
      }),
  );
}

/** One value, or null when it is absent or unreadable. */
export async function readOne(
  store: string,
  key: string,
): Promise<string | null> {
  const found = await run<unknown>(store, "readonly", (s) => s.get(key));
  return typeof found === "string" ? found : null;
}

/** Keep one value. Answers whether it landed. */
export async function writeOne(
  store: string,
  key: string,
  value: string,
): Promise<boolean> {
  if (refusePut()) return false;
  // `put` resolves with the key, so anything non-null is a success; null is the
  // path where IndexedDB was unavailable or the quota refused it.
  return (await run(store, "readwrite", (s) => s.put(value, key))) !== null;
}

export async function removeOne(store: string, key: string): Promise<void> {
  await run(store, "readwrite", (s) => s.delete(key));
}

/**
 * Many values in one transaction, which is what makes the migration atomic.
 *
 * A key at a time would leave a half-copied library behind a browser closed
 * mid-move; one transaction either commits or aborts, and the caller only
 * deletes the originals once this has answered true.
 */
export function writeAll(
  store: string,
  entries: readonly (readonly [string, string])[],
): Promise<boolean> {
  if (entries.length === 0) return Promise.resolve(true);
  if (refusePut()) return Promise.resolve(false);

  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          const tx = db.transaction(store, "readwrite");
          const objectStore = tx.objectStore(store);
          for (const [key, value] of entries) objectStore.put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onabort = () => {
            console.error(`[store-db] ${store} bulk write aborted`, tx.error);
            resolve(false);
          };
          tx.onerror = () => resolve(false);
        } catch (err) {
          console.error(`[store-db] ${store} bulk write failed`, err);
          resolve(false);
        }
      }),
  );
}

export async function clearStore(store: string): Promise<void> {
  await run(store, "readwrite", (s) => s.clear());
}
