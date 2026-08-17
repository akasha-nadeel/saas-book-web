/**
 * How much room this browser will give the library, and asking it not to take
 * the room away again.
 *
 * **Everything the app stores is "best effort" until something asks otherwise.**
 * That is the browser's own word for it, and it means what it sounds like: when
 * the device runs short, browsers evict by least-recently-used origin — and
 * they evict **the whole origin at once**, not the least useful part of it, so
 * that a half-deleted library cannot exist. Safari goes further and clears an
 * origin the writer has not visited in seven days. A signed-out writer whose
 * only copy of the manuscript is in this browser can lose all of it, and
 * nothing anywhere would say so.
 *
 * `navigator.storage.persist()` is the one call that changes that: a persisted
 * origin is only cleared if its owner clears it. Firefox asks the writer,
 * Chrome and Safari decide from how the site has been used, and all three may
 * simply say no — so this is a request rather than a guarantee, and the app has
 * to be correct either way.
 *
 * Every function here resolves rather than throwing, the policy `cover-store.ts`
 * already follows: a browser without `navigator.storage` (or with it stubbed by
 * a privacy extension) should behave exactly as it does today rather than take
 * a screen down over a housekeeping call.
 */

/** What the browser is prepared to hold, and what is in there now. */
export interface SpaceUsed {
  /** Bytes in use across every store this origin owns. */
  used: number;
  /** Bytes the browser is prepared to give it. */
  quota: number;
}

function manager(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  // Present on `navigator` but not on the type in every environment, and
  // absent entirely in some — a bare property read is the only safe test.
  return navigator.storage ?? null;
}

/**
 * Ask the browser to stop evicting this origin.
 *
 * Answers whether it is persisted *now*, which is not the same as whether this
 * call is what persisted it — an origin already granted stays granted, and
 * asking again is free. Called once per load; there is nothing to remember.
 */
export async function askToPersist(): Promise<boolean> {
  const storage = manager();
  if (!storage || typeof storage.persist !== "function") return false;
  try {
    if (typeof storage.persisted === "function" && (await storage.persisted())) {
      return true;
    }
    return await storage.persist();
  } catch {
    return false;
  }
}

/**
 * Roughly what a browser gives one origin for `localStorage`.
 *
 * Not queryable — there is no API for it — and universally about 5MB, which is
 * why every cap in this app is sized against that number. Stated here so the
 * one screen that quotes it is quoting a constant rather than a guess made at
 * the call site.
 */
export const LOCAL_STORAGE_LIMIT = 5_000_000;

/**
 * What this origin is holding in `localStorage`, in bytes.
 *
 * **Measured by hand, because `navigator.storage.estimate()` does not count
 * `localStorage` at all** — and that is not a footnote, it is the whole reason
 * this function exists. Measured on a real library mid-failure: `estimate()`
 * reported 16MB used of a 10,753MB quota, all of it IndexedDB, while
 * `localStorage` sat at 4.93MB and autosaves were failing. A dialog quoting the
 * estimate would have told a writer whose book had stopped saving that they had
 * ten gigabytes free.
 *
 * Keys count as well as values: the key is stored too, and this app's are long.
 * UTF-16 means the true cost is nearer twice this, but browsers differ on
 * whether they charge for that, so the smaller honest number is the one to
 * show.
 */
export function localBytes(): number {
  if (typeof window === "undefined") return 0;
  try {
    let total = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key === null) continue;
      total += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * What is stored and what the ceiling is, or null when the browser will not say.
 *
 * **This is the IndexedDB budget, not the `localStorage` one** — see
 * `localBytes`. Nothing reads it today; it is here for the move to IndexedDB,
 * where it is the right question and this is the only way to ask it.
 *
 * An estimate by name and by nature: browsers pad the figures to stop a page
 * fingerprinting the disk, and the number moves between identical calls.
 */
export async function spaceUsed(): Promise<SpaceUsed | null> {
  const storage = manager();
  if (!storage || typeof storage.estimate !== "function") return null;
  try {
    const { usage, quota } = await storage.estimate();
    if (typeof usage !== "number" || typeof quota !== "number") return null;
    return { used: usage, quota };
  } catch {
    return null;
  }
}

/** "4.9 MB", for a sentence a writer reads once and acts on. */
export function describeSpace(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
