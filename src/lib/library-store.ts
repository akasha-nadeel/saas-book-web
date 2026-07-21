/**
 * The whole of OpenChapter's persistence, in one module.
 *
 * No other file touches localStorage. When this moves to Supabase the reads
 * become queries and the writes become mutations, and nothing outside this
 * file and its React bindings changes.
 *
 * The shape is split in two on purpose:
 *
 *   shelf   — every book, each with its chapter list: ids, titles, word
 *             counts, order. One document, so a reorder commits atomically.
 *   bodies  — one Tiptap document per chapter, at its own key.
 *
 * Keeping bodies out of the shelf is what makes the sidebar cheap: opening a
 * forty-chapter book parses no documents. Word count is denormalised into the
 * shelf because the editor already knows it and the list would otherwise have
 * to load every chapter to add them up.
 *
 * Book totals are summed on read rather than stored, so they cannot drift from
 * the chapters they describe.
 */

const SHELF_KEY = "openchapter:shelf";
const BODY_PREFIX = "openchapter:chapter:";
const NOTES_PREFIX = "openchapter:notes:";

export interface ChapterMeta {
  id: string;
  title: string;
  words: number;
}

export interface Book {
  id: string;
  title: string;
  /** Optional. Used for the DOCX byline and EPUB's dc:creator. */
  author?: string;
  /** Readonly because every snapshot handed out is shared and cached. */
  chapters: readonly ChapterMeta[];
  lastOpenedId: string | null;
  /** Epoch ms, so the shelf can order by recency. */
  lastOpenedAt: number;
}

export interface Shelf {
  books: readonly Book[];
  lastOpenedBookId: string | null;
}

/**
 * Referentially stable and frozen, so a caller can never mutate the value the
 * server rendered from. useSyncExternalStore requires the server snapshot to
 * be identical across calls or it loops.
 */
const EMPTY_SHELF: Shelf = Object.freeze({
  books: Object.freeze([]),
  lastOpenedBookId: null,
});

const bodyKey = (id: string) => `${BODY_PREFIX}${id}`;
const notesKey = (id: string) => `${NOTES_PREFIX}${id}`;

function newId(): string {
  // randomUUID needs a secure context; plain http://<lan-ip>:3000 isn't one.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private-mode Safari and friends throw rather than degrade.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
//
// Two audiences with opposite needs:
//
//   Shelf listeners want *every* write, including ours — renaming a chapter
//   has to repaint the sidebar immediately.
//
//   Body listeners want only writes from other tabs. Echoing our own saves
//   back would remount the surface the writer is typing into and throw away
//   their cursor.
//
// The `storage` event covers cross-tab for both, since browsers fire it only
// in tabs other than the one that wrote. Local fan-out is manual, shelf-only.
// ---------------------------------------------------------------------------

const shelfListeners = new Set<() => void>();

function emitShelf() {
  for (const listener of shelfListeners) listener();
}

export function subscribeToShelf(onStoreChange: () => void) {
  shelfListeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    // A null key means the whole store was cleared, which affects everyone.
    if (event.key === null || event.key === SHELF_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    shelfListeners.delete(onStoreChange);
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

let cachedRaw: string | null = null;
let cachedShelf: Shelf = EMPTY_SHELF;

/**
 * Cached on the raw string it was parsed from. Keying the cache on the stored
 * text — rather than invalidating by hand — means a write from another tab
 * busts it for free, and null always maps to EMPTY_SHELF so the pair can never
 * fall out of step.
 */
export function getShelf(): Shelf {
  const raw = readRaw(SHELF_KEY);
  if (raw === cachedRaw) return cachedShelf;

  cachedRaw = raw;
  cachedShelf = parseShelf(raw);
  return cachedShelf;
}

function parseShelf(raw: string | null): Shelf {
  if (!raw) return EMPTY_SHELF;
  try {
    const parsed = JSON.parse(raw) as Partial<Shelf>;
    if (!Array.isArray(parsed.books)) return EMPTY_SHELF;
    return {
      books: parsed.books,
      lastOpenedBookId: parsed.lastOpenedBookId ?? null,
    };
  } catch {
    // Better an empty shelf than a crash on every route.
    return EMPTY_SHELF;
  }
}

export function getServerShelf(): Shelf {
  return EMPTY_SHELF;
}

export function getBody(id: string): string | null {
  return readRaw(bodyKey(id));
}

export function getServerBody(): string | null {
  return null;
}

/**
 * Pure lookup. The result is a reference into the cached shelf, so it is
 * stable for as long as the shelf is.
 */
export function findBook(shelf: Shelf, bookId: string): Book | null {
  return shelf.books.find((b) => b.id === bookId) ?? null;
}

export function bookWordCount(book: Book): number {
  return book.chapters.reduce((total, c) => total + c.words, 0);
}

// ---------------------------------------------------------------------------
// Writes
//
// Each one reads the current shelf, produces a new one, and commits. There is
// no partial update: a torn shelf is far worse than a redundant write.
// ---------------------------------------------------------------------------

function commit(next: Shelf) {
  try {
    window.localStorage.setItem(SHELF_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[store] could not write shelf", err);
    return;
  }
  emitShelf();
}

/** Replaces one book in place, leaving shelf order untouched. */
function commitBook(bookId: string, update: (book: Book) => Book) {
  const shelf = getShelf();
  const target = findBook(shelf, bookId);
  if (!target) return;
  commit({
    ...shelf,
    books: shelf.books.map((b) => (b.id === bookId ? update(b) : b)),
  });
}

/**
 * Creates a book and its opening chapter together — a book with no chapters is
 * a dead end, with nowhere for the route to send the writer.
 */
export function createBook(title?: string): {
  bookId: string;
  chapterId: string;
} {
  const shelf = getShelf();
  const bookId = newId();
  const chapterId = newId();

  const book: Book = {
    id: bookId,
    title: title ?? "Untitled Book",
    chapters: [{ id: chapterId, title: "Chapter One", words: 0 }],
    lastOpenedId: chapterId,
    lastOpenedAt: Date.now(),
  };

  commit({
    ...shelf,
    books: [...shelf.books, book],
    lastOpenedBookId: bookId,
  });

  return { bookId, chapterId };
}

export function renameBook(bookId: string, title: string) {
  commitBook(bookId, (book) => ({ ...book, title }));
}

export function deleteBook(bookId: string) {
  const shelf = getShelf();
  const doomed = findBook(shelf, bookId);
  if (!doomed) return;

  const books = shelf.books.filter((b) => b.id !== bookId);

  commit({
    books,
    lastOpenedBookId:
      shelf.lastOpenedBookId === bookId
        ? (books[0]?.id ?? null)
        : shelf.lastOpenedBookId,
  });

  // Shelf first, bodies second. The shelf entry is what makes the book visible,
  // so if this half fails the writer sees a consistent app with some dead bytes
  // in storage — the reverse order would show a book whose chapters are gone.
  for (const chapter of doomed.chapters) {
    try {
      window.localStorage.removeItem(bodyKey(chapter.id));
      window.localStorage.removeItem(notesKey(chapter.id));
    } catch {
      // Unreachable bytes, not a broken app.
    }
  }
}

export function touchLastOpenedBook(bookId: string) {
  const shelf = getShelf();
  if (!findBook(shelf, bookId)) return;

  commit({
    ...shelf,
    books: shelf.books.map((b) =>
      b.id === bookId ? { ...b, lastOpenedAt: Date.now() } : b,
    ),
    lastOpenedBookId: bookId,
  });
}

export function createChapter(bookId: string, title?: string): string {
  const id = newId();
  commitBook(bookId, (book) => ({
    ...book,
    chapters: [
      ...book.chapters,
      { id, title: title ?? `Chapter ${book.chapters.length + 1}`, words: 0 },
    ],
    lastOpenedId: id,
  }));
  return id;
}

export function renameChapter(
  bookId: string,
  chapterId: string,
  title: string,
) {
  commitBook(bookId, (book) => ({
    ...book,
    chapters: book.chapters.map((c) =>
      c.id === chapterId ? { ...c, title } : c,
    ),
  }));
}

export function deleteChapter(bookId: string, chapterId: string) {
  commitBook(bookId, (book) => {
    const chapters = book.chapters.filter((c) => c.id !== chapterId);
    return {
      ...book,
      chapters,
      lastOpenedId:
        book.lastOpenedId === chapterId
          ? (chapters[0]?.id ?? null)
          : book.lastOpenedId,
    };
  });

  try {
    window.localStorage.removeItem(bodyKey(chapterId));
    window.localStorage.removeItem(notesKey(chapterId));
  } catch {
    // The shelf entry is gone, which is what removes it from the UI. An
    // orphaned body is wasted bytes, not a broken app.
  }
}

/** Moves the chapter at `from` so that it sits at index `to`. */
export function moveChapter(bookId: string, from: number, to: number) {
  commitBook(bookId, (book) => {
    const chapters = [...book.chapters];
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= chapters.length ||
      to >= chapters.length
    ) {
      return book;
    }
    const [moved] = chapters.splice(from, 1);
    chapters.splice(to, 0, moved);
    return { ...book, chapters };
  });
}

/**
 * Persists a chapter's text. Body and word count are two writes, so they can
 * in principle diverge — the body goes first, since a stale count in the
 * sidebar is cosmetic and lost prose is not.
 */
export function saveBody(
  bookId: string,
  chapterId: string,
  doc: unknown,
  words: number,
) {
  window.localStorage.setItem(bodyKey(chapterId), JSON.stringify(doc));

  const book = findBook(getShelf(), bookId);
  const current = book?.chapters.find((c) => c.id === chapterId);
  if (!current || current.words === words) return;

  commitBook(bookId, (b) => ({
    ...b,
    chapters: b.chapters.map((c) => (c.id === chapterId ? { ...c, words } : c)),
  }));
}

export function touchLastOpened(bookId: string, chapterId: string) {
  const book = findBook(getShelf(), bookId);
  if (!book || book.lastOpenedId === chapterId) return;
  commitBook(bookId, (b) => ({ ...b, lastOpenedId: chapterId }));
}

/**
 * The chapter `/book/[bookId]` should open, creating one if the book is empty.
 * Returns null only when the book itself does not exist.
 *
 * Idempotent, because it is called from an effect that React runs twice in
 * development — a version that blindly created a chapter would leave every
 * developer with a phantom extra chapter on first load.
 */
export function ensureChapter(bookId: string): string | null {
  const book = findBook(getShelf(), bookId);
  if (!book) return null;

  const remembered = book.chapters.some((c) => c.id === book.lastOpenedId);
  if (remembered) return book.lastOpenedId;
  if (book.chapters.length > 0) return book.chapters[0].id;

  return createChapter(bookId, "Chapter One");
}

// ---------------------------------------------------------------------------
// Migration
//
// Two older shapes can be sitting in storage. Both become the first book on the
// shelf. Chapter ids were already UUIDs, so bodies keep their keys and are
// never rewritten — the migration only ever moves metadata.
// ---------------------------------------------------------------------------

const LEGACY_MANIFEST_KEY = "openchapter:manifest";
const LEGACY_SPIKE_KEY = "openchapter:spike:chapter-1";

interface LegacyManifest {
  bookTitle?: string;
  chapters?: ChapterMeta[];
  lastOpenedId?: string | null;
}

/**
 * Idempotent by construction: each source key is removed once consumed, so a
 * second call finds nothing. That matters because this runs from an effect and
 * React runs effects twice in development.
 */
export function migrateLegacy() {
  const migrated = migrateManifest() || migrateSpike();
  if (!migrated) return;

  // Land the writer on what they were working on before.
  const shelf = getShelf();
  commit({ ...shelf, lastOpenedBookId: shelf.books[shelf.books.length - 1].id });
}

function migrateManifest(): boolean {
  const raw = readRaw(LEGACY_MANIFEST_KEY);
  if (!raw) return false;

  let legacy: LegacyManifest;
  try {
    legacy = JSON.parse(raw) as LegacyManifest;
  } catch {
    // Unreadable. Drop the key so it stops being retried on every load.
    window.localStorage.removeItem(LEGACY_MANIFEST_KEY);
    return false;
  }

  const chapters = Array.isArray(legacy.chapters) ? legacy.chapters : [];
  const shelf = getShelf();

  commit({
    ...shelf,
    books: [
      ...shelf.books,
      {
        id: newId(),
        title: legacy.bookTitle ?? "Untitled Book",
        chapters,
        lastOpenedId: legacy.lastOpenedId ?? chapters[0]?.id ?? null,
        lastOpenedAt: Date.now(),
      },
    ],
  });

  window.localStorage.removeItem(LEGACY_MANIFEST_KEY);
  return true;
}

function migrateSpike(): boolean {
  const body = readRaw(LEGACY_SPIKE_KEY);
  if (!body) return false;

  const { chapterId } = createBook("Untitled Book");
  try {
    window.localStorage.setItem(bodyKey(chapterId), body);
    window.localStorage.removeItem(LEGACY_SPIKE_KEY);
  } catch {
    // Couldn't carry the text over. The new book still exists.
  }
  return true;
}

export function setBookAuthor(bookId: string, author: string) {
  commitBook(bookId, (book) => ({ ...book, author }));
}

// ---------------------------------------------------------------------------
// Preferences
//
// Kept in their own document rather than on the shelf. How a writer likes the
// editor to behave is not book data — it should not ride along in every shelf
// write, and it should not travel with a book when this moves to Supabase.
// ---------------------------------------------------------------------------

const PREFS_KEY = "openchapter:prefs";

export interface Prefs {
  /** Dim every paragraph but the one being written. */
  focusMode: boolean;
  /** Hold the caret at a fixed height instead of letting it sink. */
  typewriter: boolean;
  /** The chapters-and-notes panel. */
  leftPanel: boolean;
  /** The assistant panel. */
  rightPanel: boolean;
}

const DEFAULT_PREFS: Prefs = Object.freeze({
  focusMode: false,
  typewriter: false,
  // Navigation is open by default; the assistant is opt-in, since it is the
  // only part of the app that talks to a server.
  leftPanel: true,
  rightPanel: false,
});

const prefsListeners = new Set<() => void>();

export function subscribeToPrefs(onStoreChange: () => void) {
  prefsListeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PREFS_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    prefsListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

let cachedPrefsRaw: string | null = null;
let cachedPrefs: Prefs = DEFAULT_PREFS;

/** Cached on its raw string, for the same reason getShelf is. */
export function getPrefs(): Prefs {
  const raw = readRaw(PREFS_KEY);
  if (raw === cachedPrefsRaw) return cachedPrefs;

  cachedPrefsRaw = raw;
  cachedPrefs = parsePrefs(raw);
  return cachedPrefs;
}

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      focusMode: parsed.focusMode === true,
      typewriter: parsed.typewriter === true,
      leftPanel: parsed.leftPanel !== false,
      rightPanel: parsed.rightPanel === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function getServerPrefs(): Prefs {
  return DEFAULT_PREFS;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  const next = { ...getPrefs(), [key]: value };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[store] could not write prefs", err);
    return;
  }
  for (const listener of prefsListeners) listener();
}

// ---------------------------------------------------------------------------
// Chapter notes
//
// At their own key, like chapter bodies and for the same reason: notes are
// unbounded text a writer types into, and putting them in the shelf would make
// every keystroke rewrite the document the sidebar reads.
// ---------------------------------------------------------------------------

export function subscribeToNotes(id: string, onStoreChange: () => void) {
  const key = notesKey(id);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function getNotes(id: string): string | null {
  return readRaw(notesKey(id));
}

export function getServerNotes(): string | null {
  return null;
}

export function saveNotes(id: string, text: string) {
  try {
    if (text) window.localStorage.setItem(notesKey(id), text);
    else window.localStorage.removeItem(notesKey(id));
  } catch (err) {
    console.error("[store] could not write notes", err);
  }
}
