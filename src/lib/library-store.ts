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

import type { BookKind } from "./book-kinds";
import { DEFAULT_PAGE, type PageSetup } from "./page-setup";

const SHELF_KEY = "openchapter:shelf";
const BODY_PREFIX = "openchapter:chapter:";
const NOTES_PREFIX = "openchapter:notes:";

/** A book's three regions. "body" is the default and is stored as absent. */
export type ChapterPart = "front" | "body" | "back";

export interface ChapterMeta {
  id: string;
  title: string;
  words: number;
  /** Flagged for quick return. Absent rather than false when not marked. */
  bookmarked?: true;
  /** Where it sits in the book. Absent means the body. */
  part?: ChapterPart;
}

export interface Book {
  id: string;
  title: string;
  /** Optional. Used for the DOCX byline and EPUB's dc:creator. */
  author?: string;
  /** What the writer set out to make. Absent on books made before setup. */
  kind?: BookKind;
  /** A plain string, not a union: the list can grow without a migration. */
  genre?: string;
  /** Words aimed at. Absent means no goal, and no progress is shown. */
  targetWords?: number;
  /** Page geometry. Absent means the default — see pageSetupOf. */
  page?: PageSetup;
  /** Set aside but kept. Epoch ms. */
  archivedAt?: number;
  /** Deleted but recoverable. Epoch ms. Wins over archivedAt. */
  trashedAt?: number;
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
/** What the setup dialog collects. Every field is optional — see createBook. */
export interface BookSetup {
  kind?: BookKind;
  genre?: string;
  targetWords?: number;
}

/**
 * Setup is optional throughout. A book made without it is a complete book with
 * no goal attached, which is what every book made before this existed is, and
 * what "skip" has to keep producing.
 */
export function createBook(
  title?: string,
  setup?: BookSetup,
): {
  bookId: string;
  chapterId: string;
} {
  const shelf = getShelf();
  const bookId = newId();
  const chapterId = newId();

  const book: Book = {
    id: bookId,
    title: title ?? "Untitled Book",
    // Spread conditionally rather than assigning undefined: an explicit
    // `targetWords: undefined` survives JSON.stringify as a missing key but
    // shows up in object comparisons, and the store's tests check exact shape.
    ...(setup?.kind ? { kind: setup.kind } : {}),
    ...(setup?.genre ? { genre: setup.genre } : {}),
    ...(setup?.targetWords ? { targetWords: setup.targetWords } : {}),
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

/** The writing surface's background. A closed set, because each one needs a
 *  text colour chosen to stay readable against it. */
export type PaperColor = "white" | "cream" | "sepia" | "slate" | "black";

const PAPER_COLORS: readonly PaperColor[] = [
  "white",
  "cream",
  "sepia",
  "slate",
  "black",
];

export interface Prefs {
  /** Dim every paragraph but the one being written. */
  focusMode: boolean;
  /** Hold the caret at a fixed height instead of letting it sink. */
  typewriter: boolean;
  /** The chapters-and-notes panel. */
  leftPanel: boolean;
  /** The assistant panel. */
  rightPanel: boolean;
  /** The colour of the page under the prose. */
  paper: PaperColor;
}

const DEFAULT_PREFS: Prefs = Object.freeze({
  focusMode: false,
  typewriter: false,
  // Navigation is open by default; the assistant is opt-in, since it is the
  // only part of the app that talks to a server.
  leftPanel: true,
  rightPanel: false,
  // White by default: the chrome is dark, the page is not. Long-form prose is
  // what most people still read most comfortably on a light surface.
  paper: "white",
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
      paper: PAPER_COLORS.includes(parsed.paper as PaperColor)
        ? (parsed.paper as PaperColor)
        : DEFAULT_PREFS.paper,
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

// ---------------------------------------------------------------------------
// Page setup
//
// On the book rather than in prefs: in Word this belongs to the document, and
// here the document is the book. It also has somewhere to go later — DOCX
// export already writes a page size and margins.
//
// Stored only once changed. An absent field reads as the default, so books
// created before this existed need no migration.
// ---------------------------------------------------------------------------

export function pageSetupOf(book: Book): PageSetup {
  return { ...DEFAULT_PAGE, ...(book.page ?? {}) };
}

export function setPageSetup(bookId: string, patch: Partial<PageSetup>) {
  commitBook(bookId, (book) => ({
    ...book,
    page: { ...pageSetupOf(book), ...patch },
  }));
}

/**
 * A book with its chapters already laid out.
 *
 * Composed from the calls above rather than writing the shelf directly, so a
 * template gets exactly the same book a writer would build by hand.
 */
export function createBookFromTemplate(
  title: string,
  chapterTitles: readonly string[],
): { bookId: string; chapterId: string } {
  const { bookId, chapterId } = createBook(title);

  // createBook already made one chapter; rename it rather than leaving a stray
  // "Chapter One" in front of the template's own first chapter.
  const [first, ...rest] = chapterTitles.length
    ? chapterTitles
    : ["Chapter One"];

  renameChapter(bookId, chapterId, first);
  for (const chapterTitle of rest) createChapter(bookId, chapterTitle);

  return { bookId, chapterId };
}


// ---------------------------------------------------------------------------
// Archive and trash
//
// Deleting used to be immediate and permanent, and it took every chapter of a
// book with it. Trash makes that recoverable: the record is flagged and
// nothing on disk is touched, so the words survive a misclick. Permanent
// deletion still exists, but now it is reachable only from the trash.
// ---------------------------------------------------------------------------

export type BookView = "active" | "archived" | "trashed";

/** Trash wins over archive: a trashed book appears in one list, not two. */
export function booksIn(shelf: Shelf, view: BookView): Book[] {
  return shelf.books.filter((book) => {
    if (book.trashedAt) return view === "trashed";
    if (book.archivedAt) return view === "archived";
    return view === "active";
  });
}

/**
 * Keeps lastOpenedBookId pointing at something still on the shelf, so
 * "Continue writing" never offers a book the writer just put away.
 */
function reseatLastOpened(shelf: Shelf, leavingId: string): string | null {
  if (shelf.lastOpenedBookId !== leavingId) return shelf.lastOpenedBookId;
  const next = booksIn(shelf, "active").find((b) => b.id !== leavingId);
  return next?.id ?? null;
}

function setFlags(bookId: string, patch: Partial<Book>) {
  const shelf = getShelf();
  if (!findBook(shelf, bookId)) return;

  const leaving = patch.archivedAt !== undefined || patch.trashedAt !== undefined;

  commit({
    ...shelf,
    books: shelf.books.map((b) => (b.id === bookId ? { ...b, ...patch } : b)),
    lastOpenedBookId: leaving
      ? reseatLastOpened(shelf, bookId)
      : shelf.lastOpenedBookId,
  });
}

export function archiveBook(bookId: string) {
  setFlags(bookId, { archivedAt: Date.now() });
}

export function trashBook(bookId: string) {
  setFlags(bookId, { trashedAt: Date.now() });
}

/** Back to the active shelf, out of both archive and trash. */
export function restoreBook(bookId: string) {
  const shelf = getShelf();
  if (!findBook(shelf, bookId)) return;

  commit({
    ...shelf,
    books: shelf.books.map((b) => {
      if (b.id !== bookId) return b;
      // Drop the keys rather than setting them undefined, so the stored record
      // matches a book that was never archived in the first place.
      const restored = { ...b };
      delete restored.archivedAt;
      delete restored.trashedAt;
      return restored;
    }),
  });
}


// ---------------------------------------------------------------------------
// Bookmarks
//
// A flag on the chapter rather than a list of its own, so a bookmark cannot
// outlive the chapter it points at — deleting a chapter takes its bookmark with
// it, with no separate list to keep in step.
// ---------------------------------------------------------------------------

export interface Bookmark {
  book: Book;
  chapter: ChapterMeta;
}

export function toggleBookmark(bookId: string, chapterId: string) {
  commitBook(bookId, (book) => ({
    ...book,
    chapters: book.chapters.map((c) => {
      if (c.id !== chapterId) return c;
      if (c.bookmarked) {
        const next = { ...c };
        delete next.bookmarked;
        return next;
      }
      return { ...c, bookmarked: true as const };
    }),
  }));
}

/** Every bookmarked chapter in the library, each with the book it lives in. */
export function bookmarks(shelf: Shelf): Bookmark[] {
  const found: Bookmark[] = [];
  for (const book of shelf.books) {
    // A trashed book's chapters are not somewhere to jump to.
    if (book.trashedAt) continue;
    for (const chapter of book.chapters) {
      if (chapter.bookmarked) found.push({ book, chapter });
    }
  }
  return found;
}


// ---------------------------------------------------------------------------
// Front matter, body, back matter
//
// A part is a field on the chapter, not a separate list, so chapter order stays
// the single source of truth: moving a chapter between parts never reorders it,
// and each part renders in the order the book already has.
// ---------------------------------------------------------------------------

export function chaptersInPart(book: Book, part: ChapterPart): ChapterMeta[] {
  return book.chapters.filter((c) => (c.part ?? "body") === part);
}

export function setChapterPart(
  bookId: string,
  chapterId: string,
  part: ChapterPart,
) {
  commitBook(bookId, (book) => ({
    ...book,
    chapters: book.chapters.map((c) => {
      if (c.id !== chapterId) return c;
      if (part === "body") {
        // Store the default as absent, matching a chapter never moved.
        const next = { ...c };
        delete next.part;
        return next;
      }
      return { ...c, part };
    }),
  }));
}
