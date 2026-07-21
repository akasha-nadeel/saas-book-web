/**
 * The whole of OpenChapter's persistence, in one module.
 *
 * Everything the app knows about storage lives here, deliberately: no other
 * file touches localStorage. When this moves to Supabase, the reads become
 * queries and the writes become mutations, and nothing outside this file and
 * its React bindings needs to change.
 *
 * The shape is split in two on purpose:
 *
 *   manifest  — the chapter list: ids, titles, word counts, order.
 *   bodies    — one Tiptap document per chapter, keyed by id.
 *
 * The sidebar renders from the manifest alone, so opening a book with forty
 * chapters never parses forty documents. Word count is denormalised into the
 * manifest for the same reason — the editor already knows it, so it writes it
 * where the list can read it cheaply.
 */

const MANIFEST_KEY = "openchapter:manifest";
const BODY_PREFIX = "openchapter:chapter:";

/** The spike's single hard-coded chapter, adopted on first run. See migrate(). */
const LEGACY_BODY_KEY = "openchapter:spike:chapter-1";

export interface ChapterMeta {
  id: string;
  title: string;
  words: number;
}

export interface Manifest {
  bookTitle: string;
  /** Readonly because every snapshot the store hands out is shared and cached. */
  chapters: readonly ChapterMeta[];
  lastOpenedId: string | null;
}

/**
 * Referentially stable, and frozen so a caller can never mutate the value the
 * server rendered from. useSyncExternalStore requires the server snapshot to
 * be identical across calls or it will loop.
 */
const EMPTY_MANIFEST: Manifest = Object.freeze({
  bookTitle: "Untitled Book",
  chapters: Object.freeze([]),
  lastOpenedId: null,
});

const bodyKey = (id: string) => `${BODY_PREFIX}${id}`;

function newId(): string {
  // randomUUID needs a secure context; plain http://<lan-ip>:3000 isn't one.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Subscriptions
//
// Two audiences with opposite needs:
//
//   Manifest listeners want *every* write, including ours — renaming a chapter
//   has to repaint the sidebar immediately.
//
//   Body listeners want only writes from other tabs. Echoing our own saves back
//   into the editor would remount the surface the writer is typing into and
//   throw away their cursor.
//
// The `storage` event covers cross-tab for both, since browsers only fire it in
// tabs other than the one that wrote. Local fan-out is manual, and manifest-only.
// ---------------------------------------------------------------------------

const manifestListeners = new Set<() => void>();

function emitManifest() {
  for (const listener of manifestListeners) listener();
}

export function subscribeToManifest(onStoreChange: () => void) {
  manifestListeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    // A null key means the whole store was cleared, which affects everyone.
    if (event.key === null || event.key === MANIFEST_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    manifestListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function subscribeToBody(id: string, onStoreChange: () => void) {
  const key = bodyKey(id);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private-mode Safari and friends throw rather than degrade.
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedManifest: Manifest = EMPTY_MANIFEST;

/**
 * Cached on the raw string it was parsed from. useSyncExternalStore compares
 * snapshots by identity and re-renders forever if this returns a fresh object
 * each call, so parsing on every read is not an option. Keying the cache on the
 * stored text — rather than invalidating by hand — means a write from another
 * tab busts it for free.
 */
export function getManifest(): Manifest {
  const raw = readRaw(MANIFEST_KEY);
  if (raw === cachedRaw) return cachedManifest;

  cachedRaw = raw;
  cachedManifest = parseManifest(raw);
  return cachedManifest;
}

function parseManifest(raw: string | null): Manifest {
  if (!raw) return EMPTY_MANIFEST;
  try {
    const parsed = JSON.parse(raw) as Partial<Manifest>;
    if (!Array.isArray(parsed.chapters)) return EMPTY_MANIFEST;
    return {
      bookTitle: parsed.bookTitle ?? EMPTY_MANIFEST.bookTitle,
      chapters: parsed.chapters,
      lastOpenedId: parsed.lastOpenedId ?? null,
    };
  } catch {
    // Corrupt manifest. Better an empty shelf than a crash on every route.
    return EMPTY_MANIFEST;
  }
}

export function getServerManifest(): Manifest {
  return EMPTY_MANIFEST;
}

export function getBody(id: string): string | null {
  return readRaw(bodyKey(id));
}

export function getServerBody(): string | null {
  return null;
}

// ---------------------------------------------------------------------------
// Writes
//
// Each one reads the current manifest, produces a new one, and commits. There
// is no partial update: a torn manifest is far worse than a redundant write.
// ---------------------------------------------------------------------------

function commit(next: Manifest) {
  try {
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[store] could not write manifest", err);
    return;
  }
  emitManifest();
}

export function setBookTitle(bookTitle: string) {
  commit({ ...getManifest(), bookTitle });
}

export function createChapter(title?: string): string {
  const manifest = getManifest();
  const id = newId();
  const chapter: ChapterMeta = {
    id,
    title: title ?? `Chapter ${manifest.chapters.length + 1}`,
    words: 0,
  };
  commit({
    ...manifest,
    chapters: [...manifest.chapters, chapter],
    lastOpenedId: id,
  });
  return id;
}

export function renameChapter(id: string, title: string) {
  const manifest = getManifest();
  commit({
    ...manifest,
    chapters: manifest.chapters.map((c) => (c.id === id ? { ...c, title } : c)),
  });
}

export function deleteChapter(id: string) {
  const manifest = getManifest();
  const chapters = manifest.chapters.filter((c) => c.id !== id);

  commit({
    ...manifest,
    chapters,
    lastOpenedId:
      manifest.lastOpenedId === id
        ? (chapters[0]?.id ?? null)
        : manifest.lastOpenedId,
  });

  try {
    window.localStorage.removeItem(bodyKey(id));
  } catch {
    // The manifest entry is gone, which is what makes it disappear from the
    // UI. An orphaned body is wasted bytes, not a broken app.
  }
}

/** Moves the chapter at `from` so that it sits at index `to`. */
export function moveChapter(from: number, to: number) {
  const manifest = getManifest();
  const chapters = [...manifest.chapters];

  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= chapters.length ||
    to >= chapters.length
  ) {
    return;
  }

  const [moved] = chapters.splice(from, 1);
  chapters.splice(to, 0, moved);
  commit({ ...manifest, chapters });
}

/**
 * Persists a chapter's text. The body and the manifest's word count are two
 * writes, so they can in principle diverge — the body is written first, since a
 * stale count in the sidebar is a cosmetic problem and lost prose is not.
 */
export function saveBody(id: string, doc: unknown, words: number) {
  window.localStorage.setItem(bodyKey(id), JSON.stringify(doc));

  const manifest = getManifest();
  const current = manifest.chapters.find((c) => c.id === id);
  if (!current || current.words === words) return;

  commit({
    ...manifest,
    chapters: manifest.chapters.map((c) => (c.id === id ? { ...c, words } : c)),
  });
}

export function touchLastOpened(id: string) {
  const manifest = getManifest();
  if (manifest.lastOpenedId === id) return;
  commit({ ...manifest, lastOpenedId: id });
}

// ---------------------------------------------------------------------------
// First run
// ---------------------------------------------------------------------------

/**
 * Guarantees the book has at least one chapter and returns the one to open.
 *
 * Idempotent, because it is called from an effect that React runs twice in
 * development — a version that blindly created a chapter would leave every
 * developer with a phantom "Chapter 2" on first load.
 *
 * Also adopts the spike's single chapter if it is still sitting in storage, so
 * anything already written survives the move to a real chapter list.
 */
export function ensureChapter(): string {
  const manifest = getManifest();
  if (manifest.chapters.length > 0) {
    const known = manifest.chapters.some((c) => c.id === manifest.lastOpenedId);
    return known ? manifest.lastOpenedId! : manifest.chapters[0].id;
  }

  const legacy = readRaw(LEGACY_BODY_KEY);
  const id = createChapter("Chapter One");

  if (legacy) {
    try {
      window.localStorage.setItem(bodyKey(id), legacy);
      window.localStorage.removeItem(LEGACY_BODY_KEY);
    } catch {
      // Couldn't carry the spike's text over. The new chapter still exists.
    }
  }

  return id;
}
