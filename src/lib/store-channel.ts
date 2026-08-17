/**
 * "Something changed" between tabs, for the stores that left `localStorage`.
 *
 * **The `storage` event was doing this job and it only fires for
 * `localStorage`.** Bodies, notes, history and cover thumbnails are in
 * IndexedDB now, which has no such event — so without this, a writer with the
 * same chapter open in two tabs would type in one and the other would go on
 * showing the old text until it was reloaded, which is the failure
 * `subscribeToBodyReload` was written to prevent from the other direction.
 *
 * Only the *moved* stores need it. Every `storage` listener for a key that
 * stayed — the shelf, prefs, ideas, the ledger, the writing log, the bible, the
 * ARC list — is left exactly as it was.
 *
 * **One channel object for the whole module, and that detail is load-bearing.**
 * A `BroadcastChannel` message goes to every same-named channel *except the
 * object that posted it* — including other channel objects in the same
 * document. So a channel per subscription would echo the writing tab's own
 * saves back at its own body listeners, remounting Tiptap in the middle of a
 * keystroke. One channel that both posts and receives gives "other tabs only"
 * by construction, which is exactly what the `storage` event gave for free.
 *
 * A per-tab nonce rides along and is filtered on receipt anyway. It should be
 * unreachable; it is cheap insurance on the one bug in this app that eats a
 * writer's cursor.
 */

/** What a tab says when it has written something. */
export interface StoreNote {
  /** Which object store — one of the names in `store-db.ts`. */
  store: string;
  /** The key inside it: a chapter id, or a book id for a cover. */
  key: string;
  /** Which tab wrote it, so our own messages can be recognised and dropped. */
  from: string;
}

const CHANNEL = "openchapter:store";

/**
 * The `localStorage` key the fallback writes to.
 *
 * Where `BroadcastChannel` is missing — older Safari, some embedded
 * webviews — a write to `localStorage` still raises a `storage` event **in
 * other tabs only**, which is semantically identical. The nonce is not
 * decoration: `setItem` with a value byte-for-byte equal to the stored one
 * fires nothing at all, so two identical saves in a row would deliver one
 * message.
 */
const FALLBACK_KEY = "openchapter:note";

const me =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let channel: BroadcastChannel | null = null;
let nonce = 0;

const listeners = new Set<(note: StoreNote) => void>();

function ensureChannel(): void {
  if (channel || typeof window === "undefined") return;
  if (typeof BroadcastChannel === "undefined") return;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent) => deliver(event.data);
  } catch {
    // A locked-down browser. The fallback below still works.
    channel = null;
  }
}

function deliver(data: unknown): void {
  const note = data as Partial<StoreNote> | null;
  if (
    !note ||
    typeof note.store !== "string" ||
    typeof note.key !== "string" ||
    note.from === me
  ) {
    return;
  }
  for (const listener of listeners) {
    listener({ store: note.store, key: note.key, from: note.from ?? "" });
  }
}

/**
 * Start listening. Called once, from the store's own boot.
 *
 * Both transports are attached: `BroadcastChannel` where it exists, and the
 * `storage` fallback always, since attaching a listener costs nothing and a
 * browser with one and not the other is not worth branching on.
 */
export function openStoreChannel(
  onNote: (note: StoreNote) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  listeners.add(onNote);
  ensureChannel();

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FALLBACK_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Somebody else's key, or a truncated write.
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onNote);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Tell the other tabs that one key moved.
 *
 * **The note carries the key and never the value**, which is what keeps a
 * message cheap enough to send on every autosave — and what makes the receiving
 * side re-read from disk, so it cannot act on a value that has since been
 * written over.
 */
export function postStoreNote(store: string, key: string): void {
  if (typeof window === "undefined") return;
  ensureChannel();

  const note: StoreNote = { store, key, from: me };
  try {
    channel?.postMessage(note);
  } catch {
    // A closed channel. The fallback below still carries it.
  }

  if (channel) return;
  try {
    nonce += 1;
    window.localStorage.setItem(
      FALLBACK_KEY,
      JSON.stringify({ ...note, n: nonce }),
    );
  } catch {
    // A full or walled-off origin. Cross-tab freshness is the one thing here
    // worth losing silently.
  }
}
