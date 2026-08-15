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

import type { CollabRole } from "./collab";
import type { CoverFacts } from "./cover-check";
import {
  parseActivity,
  record as recordActivity,
  trim as trimActivity,
} from "./activity";
import { addSnapshot, parseHistory, shouldSnapshot } from "./history";
import { clearPrintCovers } from "./cover-store";
import {
  MATTER_SECTIONS,
  matterSection,
  matterSectionIndex,
  type MatterPart,
} from "./matter";
import { DEFAULT_PAGE, type PageSetup } from "./page-setup";
// Types and one date helper. free-limits.ts is pure and imports nothing back, so
// the policy stays out of the store and the store stays the only place that keeps
// the score.
import {
  localDay,
  type BookLimit,
  type DailyLimit,
  type DailyUse,
  type TotalLimit,
} from "./free-limits";
// Type-only, and publishing.ts imports Book the same way — a cycle that exists
// for the compiler and never at runtime.
import { isEmptyDetail, type PublishingMeta } from "./publishing";
import { isSupabaseConfigured } from "./supabase/config";
import {
  fetchLibrary,
  hasClaimed,
  currentOwner,
  pushBody,
  pushBook,
  pushBookDeleted,
  pushChapterDeleted,
  pushCover,
  pushNotes,
  pushPrefs,
  seedBodyRevs,
  setConflictHandler,
  uploadLibrary,
} from "./sync";
import { DEFAULT_TYPOGRAPHY, type Typography } from "./typography";

const SHELF_KEY = "openchapter:shelf";
const BODY_PREFIX = "openchapter:chapter:";
const NOTES_PREFIX = "openchapter:notes:";
// Covers live at their own key rather than in the shelf. The shelf is
// parsed on every read and shared by every screen; folding a few hundred
// kilobytes of base64 per book into it would make opening the library the
// most expensive thing the app does.
const COVER_PREFIX = "openchapter:cover:";
/**
 * What the cover checker measured, kept so other screens can report it.
 *
 * **Not the cover — the cover's dimensions.** The artwork stored at
 * `COVER_PREFIX` is compressed to 700px and 250KB to fit a browser, so
 * measuring *it* would tell every book it was too small to upload: a true
 * statement about a file no shop will ever see, and a false one about the
 * writer's. The checker is the only place that ever holds the real artwork,
 * for as long as it takes to read it, and it was throwing the numbers away.
 *
 * Four integers, so this costs nothing and cannot go stale in the dangerous
 * direction: it is written when a file is checked and cleared when the check
 * is cleared, so the dashboard either reports a real measurement or says
 * nothing at all.
 */
const COVER_FACTS_PREFIX = "openchapter:coverfacts:";

/**
 * Which of a book's three parts a chapter belongs to. Absent means the body —
 * the ordinary numbered chapters — so books made before this need no migration
 * and the common case carries no field.
 */
export type ChapterMatter = "front" | "body" | "back";

export interface ChapterMeta {
  id: string;
  title: string;
  words: number;
  /** Flagged for quick return. Absent rather than false when not marked. */
  bookmarked?: true;
  /** Front or back matter. Absent means a body chapter — see ChapterMatter. */
  matter?: "front" | "back";
  /**
   * **Legacy: the one combined front- or back-matter page.**
   *
   * Front and back matter used to be a single page each, holding every standard
   * division as a heading, and this field is how the panel found that page
   * again rather than making a second one. They are separate pages now — see
   * `src/lib/matter.ts` — so nothing sets this any more.
   *
   * It stays read-only, and it is not tidied away: books written before the
   * change still carry one of these pages with the writer's prose in it. It
   * lists, opens, renames, deletes and exports like any other matter page; the
   * field simply no longer means anything special. Deleting it here would drop
   * the column on the way to Postgres (see `sync.ts`) and lose nothing useful,
   * but it would also make an older tab and a newer one disagree about a
   * chapter, which is not worth the tidiness.
   */
  matterKey?: "front" | "back";
}

/** A chapter's part, with the body default applied. */
export function chapterMatterOf(chapter: ChapterMeta): ChapterMatter {
  return chapter.matter ?? "body";
}

const MATTER_RANK: Record<ChapterMatter, number> = { front: 0, body: 1, back: 2 };

/**
 * The book's chapters in reading order: front matter, then the body, then back
 * matter, each keeping its own order. The stored array is a flat sequence the
 * writer reorders freely; this is the single derived order the sidebar shows
 * and the exporters lay out, so the two never disagree.
 */
export function orderedChapters(book: Book): readonly ChapterMeta[] {
  return [...book.chapters].sort(
    (a, b) => MATTER_RANK[chapterMatterOf(a)] - MATTER_RANK[chapterMatterOf(b)],
  );
}

/** A part's pages, in the order they are bound. */
export function matterPages(
  book: Book,
  matter: MatterPart,
): readonly ChapterMeta[] {
  return book.chapters.filter((c) => chapterMatterOf(c) === matter);
}

/**
 * A body chapter's number — its position among the body chapters alone, so the
 * count is 1, 2, 3 no matter how much front or back matter sits around it.
 * Returns null for front and back matter, which are named, not numbered.
 */
export function chapterNumberOf(book: Book, chapterId: string): number | null {
  let n = 0;
  for (const chapter of orderedChapters(book)) {
    if (chapterMatterOf(chapter) !== "body") continue;
    n += 1;
    if (chapter.id === chapterId) return n;
  }
  return null;
}

const CARDINALS = [
  "",
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen", "Twenty",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

/** A number spelled out ("Five", "Twenty-One"), the way a book prints a chapter
 *  number. Past 99 the digits are returned — spelled that far reads worse. */
export function spellNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
  if (n <= 20) return CARDINALS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${CARDINALS[ones]}`;
}

/** "Chapter Five" — a body chapter's number as a printed page labels it. */
export function chapterLabel(n: number): string {
  return `Chapter ${spellNumber(n)}`;
}

// The auto-generated titles a writer never replaced — "Chapter 7", "Chapter
// Seven". Both the digit form (nextChapterTitle) and the spelled form
// (ensureChapter's "Chapter One") are treated as generic.
const GENERIC_TITLES = new Set<string>();
for (let i = 1; i <= 99; i += 1) {
  GENERIC_TITLES.add(`chapter ${i}`);
  GENERIC_TITLES.add(chapterLabel(i).toLowerCase());
}

/**
 * Whether a chapter's title is just its number, so the opener should not print
 * the number twice — a chapter still called "Chapter 7" needs no "Chapter Seven"
 * label above it, but one named "The Last Light" does.
 */
export function isGenericChapterTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase().replace(/\s+/g, " "));
}

/**
 * Moves a chapter into front matter, the body, or back matter.
 *
 * After retagging, the stored order is re-grouped front → body → back (stable
 * within each part), so the flat array the sidebar reads is always in reading
 * order. That keeps drag-reorder, numbering, and export in agreement without a
 * separate sort at each read.
 */
export function setChapterMatter(
  bookId: string,
  chapterId: string,
  matter: ChapterMatter,
) {
  commitBook(bookId, (book) => {
    const retagged = book.chapters.map((c) => {
      if (c.id !== chapterId) return c;
      const next = { ...c };
      // Absent is the body, so a body chapter drops the field entirely.
      if (matter === "body") delete next.matter;
      else next.matter = matter;
      return next;
    });
    // Stable sort: JS keeps equal-ranked items in their existing order, so a
    // chapter moved into a part lands at the end of it.
    const grouped = [...retagged].sort(
      (a, b) => MATTER_RANK[chapterMatterOf(a)] - MATTER_RANK[chapterMatterOf(b)],
    );
    return { ...book, chapters: grouped };
  });
}

/** A chapter that was deleted but kept, so it can be restored. Its body and
 *  notes stay at their own keys until it is emptied from the trash. */
export interface TrashedChapter extends ChapterMeta {
  /** Epoch ms it was deleted, for ordering and "deleted N ago". */
  trashedAt: number;
}

export interface Book {
  id: string;
  title: string;
  /** Shown under the title on the cover. */
  subtitle?: string;
  /**
   * Leave cover artwork bare — no title, byline or scrim over it. Absent
   * rather than false, so only the books deliberately set this way carry it.
   */
  bareCover?: true;
  /** Optional. Used for the DOCX byline and EPUB's dc:creator. */
  author?: string;
  /* **`kind` was here** — novel, novella or short story. The picker that set
     it came off `/book/new` on 2026-08-15 and nothing reads it now; the
     `books.kind` column is left in Postgres unused rather than migrated away,
     since dropping a column earns nothing and an older build still writing one
     is harmless. See the note at the top of `book-kinds.ts`. */
  /** A plain string, not a union: the list can grow without a migration. */
  genre?: string;
  /** Words aimed at. Absent means no goal, and no progress is shown. */
  targetWords?: number;
  /**
   * Roadmap steps ticked by hand — only the ones that happen outside the app.
   * Everything else `roadmapFor()` works out from the book itself. Absent until
   * the first tick, and local-only: see `setRoadmapStep`.
   */
  roadmapDone?: string[];
  /** Page geometry. Absent means the default — see pageSetupOf. */
  page?: PageSetup;
  /** Body-text typography. Absent means the default — see typographyOf. */
  typography?: Typography;
  /**
   * What a shop asks for and a manuscript does not: ISBN, language, blurb,
   * categories. Absent on every book until someone sets out to publish it —
   * see lib/export/publishing.ts.
   */
  publishing?: PublishingMeta;
  /** Set aside but kept. Epoch ms. */
  archivedAt?: number;
  /** Deleted but recoverable. Epoch ms. Wins over archivedAt. */
  trashedAt?: number;
  /** Readonly because every snapshot handed out is shared and cached. */
  chapters: readonly ChapterMeta[];
  /** Deleted chapters, newest first, kept until emptied. Absent means none. */
  trash?: readonly TrashedChapter[];
  lastOpenedId: string | null;
  /** Epoch ms, so the shelf can order by recency. */
  lastOpenedAt: number;
  /**
   * Whose book this is, when the server has said.
   *
   * **Absent means the writer's own** — a book made offline, or before there was
   * an account, has no owner id and never needs one. Set by `rowsToBook` from
   * `books.owner` on the way down, and never sent back up: `bookToRow` builds an
   * explicit row, so this is not a column and cannot become one by accident.
   */
  ownerId?: string;
  /**
   * What this writer may do with somebody else's book. Absent on their own.
   *
   * Derived from `book_members` on the way down, like `ownerId`. The capability
   * questions are asked through `can()` in `collab.ts` rather than by comparing
   * this string, so the whole policy stays in one tested table.
   */
  role?: CollabRole;
  /**
   * A shared book that stopped arriving from the server.
   *
   * Set when a book carrying an `ownerId` is missing from a download: access was
   * revoked, or the book was deleted. It stays on the shelf, read-only, rather
   * than vanishing mid-sentence — and it must *never* be treated as unsaved work
   * and pushed back up, which is what `syncWithServer`'s strays path would
   * otherwise do with it, under this writer's own account.
   */
  access?: "lost";
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
const coverKey = (id: string) => `${COVER_PREFIX}${id}`;
const coverFactsKey = (id: string) => `${COVER_FACTS_PREFIX}${id}`;

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
    // A cover written in another tab changes what this one renders without
    // touching the shelf, exactly as a local `setCover` does.
    else if (event.key.startsWith(COVER_PREFIX)) {
      coverEpoch += 1;
      onStoreChange();
    }
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
// Body reload signal
//
// The editor keys its writing surface on this counter so the surface remounts —
// and re-reads the text — when *another* tab saves the same chapter. Keying on
// the stored text itself looked equivalent, but it also fired on the tab's own
// autosave: the save wrote the body, a re-render re-read it, the key changed,
// and Tiptap remounted in the middle of a keystroke. The `storage` event never
// fires in the tab that wrote, so this counter moves only for cross-tab writes.
// ---------------------------------------------------------------------------

const bodyReloads = new Map<string, number>();

export function subscribeToBodyReload(id: string, onStoreChange: () => void) {
  const key = bodyKey(id);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) {
      bodyReloads.set(id, (bodyReloads.get(id) ?? 0) + 1);
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function getBodyReload(id: string): number {
  return bodyReloads.get(id) ?? 0;
}

export function getServerBodyReload(): number {
  return 0;
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

/** A data URL, or null when the book has no cover art. */
export function getCover(bookId: string): string | null {
  return readRaw(coverKey(bookId));
}

export function getServerCover(): string | null {
  return null;
}

/**
 * Whether a book has cover art, without reading it.
 *
 * `getItem` returns the whole data URL, and a cover is allowed to be 250KB.
 * Asking "does this book have one" for every book on a list — which the Prepare
 * screen does, to say what a shop would refuse — would otherwise materialise a
 * couple of megabytes of base64 to answer seven booleans.
 *
 * `in` tests for the key rather than fetching the value, because a Storage
 * object exposes its keys as named properties.
 */
/**
 * How many times a cover has changed in this tab.
 *
 * **`setCover` already fans out on the shelf channel, and that was not
 * enough.** Covers live at their own key, so writing one leaves the shelf
 * document byte-for-byte identical — `useSyncExternalStore` reads the same
 * snapshot it read before, React correctly decides nothing changed, and every
 * `useMemo` keyed on `books` keeps its old answer.
 *
 * What that looked like: a writer pressed "Add a cover" on the dashboard's own
 * "No cover" finding, chose a file, and the finding stayed. Nothing was wrong
 * with the data — `hasCover` was true the moment it was asked — but nothing
 * asked it again until some *other* edit happened to change the shelf, so the
 * screen kept telling them to do the thing they had just done. It came right on
 * its own later, which is the worst version of this bug: intermittent, and
 * invisible in whatever you were looking at when it cleared.
 *
 * A counter gives those readers something that *does* change, so they can name
 * it as a dependency. See `useCoverEpoch`.
 */
let coverEpoch = 0;

export function getCoverEpoch(): number {
  return coverEpoch;
}

export function getCoverFacts(bookId: string): CoverFacts | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(coverFactsKey(bookId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.width === "number" && typeof parsed?.height === "number"
      ? (parsed as CoverFacts)
      : null;
  } catch {
    return null;
  }
}

export function setCoverFacts(bookId: string, facts: CoverFacts | null): void {
  try {
    if (facts === null) window.localStorage.removeItem(coverFactsKey(bookId));
    else window.localStorage.setItem(coverFactsKey(bookId), JSON.stringify(facts));
  } catch (err) {
    // A full origin costs the dashboard a warning, never the check itself.
    console.error("[store] could not write cover facts", err);
    return;
  }
  coverEpoch += 1;
  emitShelf();
}

export function hasCover(bookId: string): boolean {
  if (typeof window === "undefined") return false;
  return coverKey(bookId) in window.localStorage;
}

export function subscribeToCover(bookId: string, onStoreChange: () => void) {
  // Local writes arrive on the shelf channel, which is what setCover emits on;
  // the storage event covers the other tabs.
  shelfListeners.add(onStoreChange);

  const key = coverKey(bookId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    shelfListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Pass null to clear. Returns false when the write failed, which for a cover
 * means the browser is out of room — worth saying rather than swallowing,
 * because the book itself saved and only the picture did not.
 */
export function setCover(bookId: string, dataUrl: string | null): boolean {
  try {
    if (dataUrl === null) window.localStorage.removeItem(coverKey(bookId));
    else window.localStorage.setItem(coverKey(bookId), dataUrl);
  } catch (err) {
    console.error("[store] could not write cover", err);
    return false;
  }
  // The shelf did not change, but what the shelf *renders* did — and since the
  // shelf snapshot is identical, the fan-out alone moves nothing. Bump first,
  // so listeners woken by `emitShelf` read the new value.
  coverEpoch += 1;
  emitShelf();

  /*
   * **The book first, then its cover.**
   *
   * `book_covers.book_id` is a foreign key, so a cover row for a book the
   * server has never seen is rejected outright:
   *
   *   [23503] insert or update on table "book_covers" violates foreign key
   *   constraint — Key is not present in table "books".
   *
   * Which is exactly what a book made on the landing page does. It is created
   * while signed out, so its own push no-ops for want of an owner; the writer
   * signs in and sets a cover, and the cover is the *first* thing that tries
   * to go up. The parent is still missing and the write is thrown away.
   *
   * The queue keeps insertion order, so enqueuing the book here puts the row
   * in front of the cover in the same flush. It is an upsert, so a book the
   * server already has costs one harmless round trip on a rare action.
   */
  const book = findBook(getShelf(), bookId);
  if (book) {
    pushBook(book, getShelf().books.findIndex((b) => b.id === bookId));
  }
  pushCover(bookId, dataUrl);
  return true;
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

/**
 * How many chapters a book has — the body alone.
 *
 * `chapters.length` counts the front-matter and back-matter pages too, and they
 * are not chapters: they are named rather than numbered, `chapterNumberOf`
 * returns null for them, and the editor's panel has always counted this way. A
 * book showing 16 on the shelf and 12 in the panel is one of them being wrong,
 * so the answer lives here and both ask it.
 */
export function bookChapterCount(book: Book): number {
  return book.chapters.reduce(
    (total, c) => (chapterMatterOf(c) === "body" ? total + 1 : total),
    0,
  );
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
  pushShelfDiff(next);
}

/**
 * What changed since the last commit, sent to Supabase.
 *
 * Diffing here rather than at each of the twenty-odd call sites is deliberate.
 * Every shelf mutation funnels through commit(), and the writes are immutable —
 * commitBook() replaces one book and leaves the rest as the same objects — so
 * reference inequality is an exact test for "this book changed". A per-call-site
 * approach would have to be remembered every time a new mutation is added, and
 * would eventually be forgotten.
 *
 * Deletions matter as much as edits and are easier to miss: pushBook upserts a
 * book's chapters but has no way to know one was removed. Comparing the id sets
 * catches every path — emptying the trash, undoing an import, a chapter deleted
 * for good — without any of them having to say so.
 */
let pushedBooks: readonly Book[] = [];

function chapterIdsOf(book: Book): Set<string> {
  const ids = new Set<string>();
  for (const c of book.chapters) ids.add(c.id);
  for (const c of book.trash ?? []) ids.add(c.id);
  return ids;
}

/**
 * Is this book somebody else's?
 *
 * Absence of `ownerId` means it is this writer's own — a book made offline, or
 * before there was an account, carries neither field.
 */
export function isSharedBook(book: Book): boolean {
  return Boolean(book.role);
}

/** May this writer change the manuscript? Owner or editor; a viewer may not. */
export function canWriteBook(book: Book): boolean {
  return book.access !== "lost" && book.role !== "viewer";
}

/**
 * Which of a book's chapter rows actually differ, position included only where
 * the chapter really moved.
 *
 * **This is what keeps two writers from reverting each other.** `pushBook` used
 * to upsert a book's *whole* chapter list on any change to the book — and a word
 * count bumped by autosave in one chapter is a change to the book. So a
 * co-writer typing a sentence in chapter seven would send their own stale titles
 * for all forty chapters and silently undo a rename somebody made in chapter
 * three. It also renumbered every `position` from the local array index, which
 * scrambles the order when two people add a chapter at once.
 *
 * Comparing field by field is the fix. Nothing unchanged is sent, so a stale copy
 * of a row cannot overwrite a fresh one.
 */
function changedChapterIds(
  book: Book,
  previous: Book | undefined,
): Set<string> | undefined {
  // No baseline means nothing is known to be unchanged, so everything goes.
  if (!previous) return undefined;

  const was = new Map<string, { chapter: ChapterMeta; at: number }>();
  (previous.chapters ?? []).forEach((c, at) => was.set(c.id, { chapter: c, at }));
  (previous.trash ?? []).forEach((c, at) => was.set(c.id, { chapter: c, at }));

  const changed = new Set<string>();
  const consider = (c: ChapterMeta, at: number) => {
    const old = was.get(c.id);
    if (
      !old ||
      old.at !== at ||
      old.chapter.title !== c.title ||
      old.chapter.words !== c.words ||
      old.chapter.matter !== c.matter ||
      old.chapter.bookmarked !== c.bookmarked
    ) {
      changed.add(c.id);
    }
  };

  book.chapters.forEach(consider);
  (book.trash ?? []).forEach(consider);
  return changed;
}

function pushShelfDiff(next: Shelf) {
  const before = new Map(pushedBooks.map((b) => [b.id, b]));

  next.books.forEach((book, position) => {
    const previous = before.get(book.id);
    before.delete(book.id);

    if (previous === book) return;

    /*
     * **A book that stopped arriving is not a book to push.** Access was revoked,
     * or the owner deleted it; either way nothing local about it belongs on the
     * server, and the strays path in `syncWithServer` must not take it for
     * unsaved work.
     */
    if (book.access === "lost") return;

    if (previous) {
      const survives = chapterIdsOf(book);
      for (const id of chapterIdsOf(previous)) {
        // Deleting the chapter row cascades to its body and notes, so the
        // cascade stays declared in the schema rather than repeated here.
        //
        // Owner only. An editor has no DELETE on `chapters` by design — theirs is
        // the soft delete, an update — because this call is made from a *local*
        // diff, so a local shelf that lost a chapter for any reason at all would
        // otherwise become a hard delete of somebody else's prose.
        if (!survives.has(id) && !isSharedBook(book)) pushChapterDeleted(id);
      }
    }

    pushBook(book, position, changedChapterIds(book, previous));
  });

  // Whatever is left never made it into the new shelf. Only ever our own: a
  // shared book leaving the shelf means access ended, not that the book did.
  for (const [id, book] of before) {
    if (!isSharedBook(book) && book.access !== "lost") pushBookDeleted(id);
  }

  pushedBooks = next.books;
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
  genre?: string;
  targetWords?: number;
  subtitle?: string;
  author?: string;
  /** A data URL. Stored at its own key, not in the shelf — see COVER_PREFIX. */
  cover?: string;
  /**
   * Leave the artwork bare — see `bareCover` on `Book`.
   *
   * Answerable at creation because that is where the cover is first chosen: a
   * writer bringing a designed jacket already knows it carries its own title,
   * and making them save the book, find it on the shelf and open a dialog to
   * say so is asking them to fix something we let them create wrong.
   */
  bareCover?: boolean;
  /**
   * Listing details a file arrived with. Only import fills this in: a book made
   * at `/book/new` has nothing to say about ISBNs yet, and asking would be four
   * more fields between a writer and their first sentence.
   */
  publishing?: PublishingMeta;
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
    ...(setup?.subtitle ? { subtitle: setup.subtitle } : {}),
    ...(setup?.author ? { author: setup.author } : {}),
    // Absent rather than `false`, so only books deliberately set this way
    // carry the field — the same rule `setBareCover` follows.
    ...(setup?.bareCover ? { bareCover: true as const } : {}),
    ...(setup?.genre ? { genre: setup.genre } : {}),
    ...(setup?.targetWords ? { targetWords: setup.targetWords } : {}),
    ...(setup?.publishing ? { publishing: setup.publishing } : {}),
    chapters: [{ id: chapterId, title: "Chapter One", words: 0 }],
    lastOpenedId: chapterId,
    lastOpenedAt: Date.now(),
  };

  /*
   * **The book is committed before its cover, and the order is load-bearing.**
   *
   * `setCover` puts a book row in front of the cover row precisely because
   * `book_covers.book_id` is a foreign key — but it does that by looking the
   * book up in the shelf, and called from here the book is not in the shelf
   * yet. So `findBook` returned null, nothing went in front, and the cover was
   * the first row of a brand-new book to reach Postgres:
   *
   *   [23503] insert or update on table "book_covers" violates foreign key
   *   constraint — Key is not present in table "books".
   *
   * Committing first means the shelf holds the book by the time the cover is
   * set, and `setCover` can do its job.
   */
  commit({
    ...shelf,
    books: [...shelf.books, book],
    lastOpenedBookId: bookId,
  });

  if (setup?.cover) setCover(bookId, setup.cover);

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
  try {
    window.localStorage.removeItem(coverKey(bookId));
  } catch {
    // Unreachable bytes, not a broken app.
  }

  // Active chapters and anything still sitting in the book's trash.
  for (const chapter of [...doomed.chapters, ...(doomed.trash ?? [])]) {
    try {
      window.localStorage.removeItem(bodyKey(chapter.id));
      window.localStorage.removeItem(notesKey(chapter.id));
      window.localStorage.removeItem(historyKey(chapter.id));
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

/**
 * The next unused "Chapter N".
 *
 * Counts the body chapters only — front and back matter are named, not
 * numbered, so a title page or a dedication must not push the count up. And
 * counting is not enough on its own: delete the second of three and the count
 * says the next is 3, which is still sitting there. Numbering from the highest
 * "Chapter N" already in use collides with nothing and renames nobody.
 */
function nextChapterTitle(chapters: readonly ChapterMeta[]): string {
  const body = chapters.filter((c) => chapterMatterOf(c) === "body");

  let highest = body.length;
  let digits = 0;
  let spelled = 0;

  for (const c of body) {
    const asDigits = /^Chapter (\d+)$/.exec(c.title);
    if (asDigits) {
      digits += 1;
      highest = Math.max(highest, Number(asDigits[1]));
      continue;
    }
    const asWords = /^Chapter ([A-Za-z-]+)$/.exec(c.title);
    if (asWords) {
      const n = numberFromWords(asWords[1]);
      if (n) {
        spelled += 1;
        highest = Math.max(highest, n);
      }
    }
  }

  /*
   * **Follow the book's own convention rather than imposing one.**
   *
   * This used to emit digits always, while the first chapter of every book is
   * created as "Chapter One" — so a two-chapter book listed "Chapter One,
   * Chapter 2" in its own contents page, which is the first thing a reader
   * notices and the last thing a writer thinks to check.
   *
   * Answering it by spelling everything would have been just as wrong in the
   * other direction: a writer who has renamed their chapters "Chapter 12" is
   * using digits on purpose, and the next one should be "Chapter 13". So the
   * count decides, and a fresh book — whose only chapter is "Chapter One" —
   * gets words.
   */
  return digits > spelled
    ? `Chapter ${highest + 1}`
    : chapterLabel(highest + 1);
}

/** "Twenty-One" back to 21, for reading the titles this file writes. */
function numberFromWords(words: string): number | null {
  const key = words.toLowerCase();
  const direct = CARDINALS.findIndex((w) => w.toLowerCase() === key);
  if (direct > 0) return direct;

  const [tens, ones] = key.split("-");
  const tensAt = TENS.findIndex((w) => w && w.toLowerCase() === tens);
  if (tensAt < 0) return null;
  if (!ones) return tensAt * 10;
  const onesAt = CARDINALS.findIndex((w) => w.toLowerCase() === ones);
  return onesAt > 0 ? tensAt * 10 + onesAt : null;
}

export function createChapter(bookId: string, title?: string): string {
  const id = newId();
  commitBook(bookId, (book) => ({
    ...book,
    chapters: [
      ...book.chapters,
      { id, title: title ?? nextChapterTitle(book.chapters), words: 0 },
    ],
    lastOpenedId: id,
  }));
  return id;
}

/**
 * A Tiptap document seeded from a matter part's standard sections: each becomes
 * a heading with an empty paragraph beneath it, ready to write into. Built here
 * so the store owns the one definition of what the template contains. Typed just
 * enough to build it — the editor reads it back as Tiptap's own JSONContent.
 */
type TemplateNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TemplateNode[];
  text?: string;
};

/**
 * One matter page's body: the template lines, and nothing else.
 *
 * **No heading.** The first draft seeded the page's own title as an `h2`, which
 * looked right in the panel and was a duplicate everywhere it mattered: the
 * editor prints the page's title above the sheet, and so does every export — so
 * a dedication arrived in the EPUB as "Dedication" twice, once from the
 * exporter and once from the template, one under the other. The page is titled
 * by its name in the chapter list; the body is what goes on it.
 *
 * A page a writer named themselves gets one empty paragraph — there is nothing
 * to seed it with, and an empty page is a page rather than a page of guesses
 * about what they meant.
 */
function matterPageDoc(part: MatterPart, title: string): TemplateNode {
  const lines = matterSection(part, title)?.lines ?? [];
  const content: TemplateNode[] = lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  }));
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/** One page to make: which part it belongs to, and what it is called. */
export interface MatterPick {
  part: MatterPart;
  title: string;
}

/**
 * Add pages to a book's front or back matter.
 *
 * **Inserted where they belong, not appended.** A writer who adds a dedication
 * after they have already made a prologue expects it in front of it, because
 * that is where a dedication goes — so each page lands at its place in
 * `MATTER_SECTIONS` rather than at the end of the part. A page the writer named
 * themselves has no place in that list and goes last, which is the only answer
 * available and the right one: it is the page nobody but them knows the
 * position of, and they can drag it later.
 *
 * **Many pages, one commit.** The setup dialog can ask for a dozen at once and
 * Start asks for eight; a loop over a single-page function would be a dozen
 * shelf writes, a dozen fan-outs to every listening screen, and a dozen pushes
 * to Postgres for one gesture.
 *
 * Bodies are written before the shelf entry, so a page never appears in the
 * list pointing at a template that is not there. A body that will not store is
 * skipped rather than taking the others with it: some of the pages is a state
 * the writer can see and finish, where nothing at all after pressing Start is
 * one they cannot. Returns the first page's id, so the caller can open it, or
 * null if none could be written.
 */
export function createMatterPages(
  bookId: string,
  picks: readonly MatterPick[],
): string | null {
  const made: (MatterPick & { id: string })[] = [];
  for (const pick of picks) {
    const id = newId();
    try {
      window.localStorage.setItem(
        bodyKey(id),
        JSON.stringify(matterPageDoc(pick.part, pick.title)),
      );
      made.push({ ...pick, id });
    } catch (err) {
      console.error("[store] could not seed matter page", err);
    }
  }
  if (made.length === 0) return null;

  commitBook(bookId, (book) => {
    const chapters = [...book.chapters];
    for (const { id, part, title } of made) {
      const chapter: ChapterMeta = { id, title, words: 0, matter: part };
      const rank = matterSectionIndex(part, title);

      // Among this part's own pages only. Splicing into the flat array by a
      // global index would put a front-matter page in the middle of the body.
      const at = chapters.findIndex(
        (c) =>
          chapterMatterOf(c) === part && matterSectionIndex(part, c.title) > rank,
      );
      if (at === -1) chapters.push(chapter);
      else chapters.splice(at, 0, chapter);
    }

    // Regroup front → body → back so the stored array stays in reading order,
    // as setChapterMatter does — the sidebar and export both read it that way.
    const grouped = chapters.sort(
      (a, b) => MATTER_RANK[chapterMatterOf(a)] - MATTER_RANK[chapterMatterOf(b)],
    );
    return { ...book, chapters: grouped, lastOpenedId: made[0].id };
  });
  return made[0].id;
}

/** One page, for the Add-page menu. */
export function createMatterPage(
  bookId: string,
  part: MatterPart,
  title: string,
): string | null {
  return createMatterPages(bookId, [{ part, title }]);
}

/**
 * Every standard page of a part at once, for a book that has none.
 *
 * What the card's Start button does, for a writer who did not answer the setup
 * dialog — or skipped it. Meeting front matter for the first time with no idea
 * which of eight printer's terms you need, being asked to choose is asking the
 * question backwards; so they get the lot, each one a page they can open, and
 * deleting the ones they do not want is the easy direction.
 */
export function startMatter(bookId: string, part: MatterPart): string | null {
  return createMatterPages(
    bookId,
    MATTER_SECTIONS[part].map((section) => ({ part, title: section.title })),
  );
}

/**
 * A whole book at once, from an imported file.
 *
 * Bodies are written before the shelf entry so that a book never appears in the
 * library pointing at text that is not there. If any write fails — a manuscript
 * larger than the browser will hold is the likely reason — everything already
 * written is removed and nothing is committed. A half-imported novel that looks
 * complete is the worst outcome available here.
 *
 * Returns null on failure, so the caller can say what happened.
 */
export function createBookFromImport(
  title: string,
  chapters: readonly {
    title: string;
    doc: unknown;
    words: number;
    /** Set only by the EPUB importer, which is the one format that says. */
    matter?: "front" | "back";
  }[],
  setup?: BookSetup,
): { bookId: string; chapterId: string } | null {
  if (!chapters.length) return null;

  const bookId = newId();
  const metas: ChapterMeta[] = [];
  const written: string[] = [];

  try {
    for (const chapter of chapters) {
      const id = newId();
      window.localStorage.setItem(bodyKey(id), JSON.stringify(chapter.doc));
      written.push(id);
      /* **A page the file declared as front or back matter stays one.**
         Only an EPUB says — see `parseEpub` — and only for the pages it typed;
         everything else is absent and means the body, as it always has. */
      metas.push({
        id,
        title: chapter.title,
        words: chapter.words,
        ...(chapter.matter ? { matter: chapter.matter } : {}),
      });
    }
  } catch (err) {
    console.error("[store] import failed, rolling back", err);
    for (const id of written) {
      try {
        window.localStorage.removeItem(bodyKey(id));
      } catch {
        // Nothing further to try; the shelf is untouched either way.
      }
    }
    return null;
  }

  const shelf = getShelf();
  const book: Book = {
    id: bookId,
    title: title.trim() || "Untitled Book",
    ...(setup?.subtitle ? { subtitle: setup.subtitle } : {}),
    ...(setup?.author ? { author: setup.author } : {}),
    ...(setup?.genre ? { genre: setup.genre } : {}),
    ...(setup?.targetWords ? { targetWords: setup.targetWords } : {}),
    ...(setup?.publishing ? { publishing: setup.publishing } : {}),
    // Front → body → back, as every other write to this array is.
    chapters: [...metas].sort(
      (a, b) => MATTER_RANK[chapterMatterOf(a)] - MATTER_RANK[chapterMatterOf(b)],
    ),
    // The first *chapter*, not the first page: landing an imported book on its
    // own half-title would open the editor on a line of title text.
    lastOpenedId:
      metas.find((m) => chapterMatterOf(m) === "body")?.id ?? metas[0].id,
    lastOpenedAt: Date.now(),
  };

  /*
   * Artwork and byline the *file* carried, kept rather than dropped.
   *
   * An EPUB knows its author, its blurb, its categories and usually its cover;
   * importing one used to take the chapters and the title and lose the rest, so
   * a writer whose file was complete was met by a book the app called
   * anonymous and coverless — and, now that the readiness check runs on the
   * landing page, met by two screens disagreeing about the same file.
   *
   * `setCover` enforces its own size cap and fails cleanly, which is all the
   * handling this needs: a cover that will not fit leaves a book without one,
   * and the app already knows how to say that.
   */
  if (setup?.cover) setCover(bookId, setup.cover);

  commit({
    ...shelf,
    books: [...shelf.books, book],
    lastOpenedBookId: bookId,
  });

  /*
   * **Send the prose up, which for a long time nothing did.**
   *
   * The bodies above are written straight to localStorage rather than through
   * `saveBody` — deliberately, because a hundred chapters through the autosave
   * path is a hundred shelf writes and fan-outs for one gesture. But `saveBody`
   * is also the *only* thing that calls `pushBody`, so the whole manuscript
   * stayed on this machine while `commit` faithfully uploaded the book and
   * every one of its chapter rows: word counts, titles, positions, and not a
   * word of the writing.
   *
   * Nothing said so. The shelf reported the right totals on every machine, and
   * the book opened empty on the second one. Found on a real library — 298
   * chapters on the server and 30 bodies, the 30 being the ones that had since
   * been edited in the editor, which does go through `saveBody`.
   *
   * After `commit`, never before: `pushBook` upserts the chapter rows and a
   * body cannot land without one. The queue sorts `book:` ahead of `body:` for
   * the same reason, so the pair arrives in the order the foreign keys need
   * however the timers fall.
   */
  for (const meta of metas) {
    const raw = window.localStorage.getItem(bodyKey(meta.id));
    if (raw !== null) pushBody(meta.id, raw);
  }

  return { bookId, chapterId: metas[0].id };
}

/**
 * Renames an imported chapter so the book's numbering runs on unbroken.
 *
 * The number comes from where the existing chapters end — a nine-chapter book
 * takes an import in starting at Chapter 10 — while any description the writer
 * gave the chapter is kept: "Chapter 8 – The Shadow's Secret" appended after
 * nine chapters becomes "Chapter 10 – The Shadow's Secret". A chapter with no
 * description of its own is simply "Chapter 10".
 */
function renumberTitle(original: string, number: number): string {
  // Strip a leading "Chapter <n>" and any separator after it; what remains is
  // the description the writer actually chose.
  const description = original
    .replace(/^\s*chapter\s+\d+\s*[–—:.\-]*\s*/i, "")
    .trim();

  /* **A heading that is only a chapter number is not a description.**
     The strip above catches the digit form, so "Chapter 7" comes back empty and
     is renumbered cleanly. It missed the *spelled* form, which is what a
     manuscript actually uses and what this app's own default titles are — so
     importing a file whose headings read "Chapter One" produced
     "Chapter 1 – Chapter One" on every chapter of the book. */
  if (!description || isGenericChapterTitle(description)) {
    return `Chapter ${number}`;
  }
  return `Chapter ${number} – ${description}`;
}

/**
 * What an import did, kept so it can be reversed. Held by the caller (the undo
 * banner) rather than in storage — it only has to survive until the writer
 * accepts or undoes.
 */
export interface ImportUndo {
  bookId: string;
  /** The chapters the import added — removed on undo. */
  addedIds: string[];
  /** For a replace, the chapters it cleared, with their prose and notes, to
   *  put back on undo. Empty for an append. */
  removed: { meta: ChapterMeta; body: string | null; notes: string | null }[];
  /** The chapter that was open before, to return to on undo. */
  prevLastOpenedId: string | null;
}

/**
 * Brings imported chapters into a book that already exists.
 *
 * `add` appends them after what is there and continues the numbering; `replace`
 * clears the book's **body** first and numbers the import from one. Either way
 * bodies are written before the shelf is touched and removed if a write fails,
 * so the book never points at prose that is not there. Returns the first new
 * chapter's id and an undo record, or null on failure (bad book, empty import,
 * or storage full).
 *
 * **Replace does not touch front or back matter, and that is the whole point.**
 * It used to clear `book.chapters` entire, which was harmless while those were
 * one page each that few writers made — and destructive the moment a book
 * carried a dedication, a copyright page and an about-the-author. Worse, it was
 * *silent*: the add-or-replace question is asked only when the book already has
 * words in it, and a freshly-made set of matter pages has none, so importing a
 * manuscript into a book that had just been set up deleted ten pages without
 * asking. A manuscript file is the story; it is not the writer's dedication,
 * and replacing one with the other was never what anybody meant.
 */
export function importIntoBook(
  bookId: string,
  chapters: readonly {
    title: string;
    doc: unknown;
    words: number;
    /** Set only by the EPUB importer, which is the one format that says. */
    matter?: "front" | "back";
  }[],
  mode: "add" | "replace",
): { firstId: string; undo: ImportUndo } | null {
  if (!chapters.length) return null;
  const book = findBook(getShelf(), bookId);
  if (!book) return null;

  /* **Numbered on from the last body chapter, not the last row in the array.**
     `chapters.length` counts the front- and back-matter pages, so importing
     three chapters into a two-chapter book carrying the standard sixteen matter
     pages produced "Chapter 19, 20, 21" — numbers with nothing before them. The
     banner and the panel both count the body, and so does this. */
  const startNumber = mode === "replace" ? 0 : bookChapterCount(book);
  // Counts the body chapters as they are made, so the matter pages mixed in
  // among them do not consume numbers.
  let bodyAt = 0;
  const metas: ChapterMeta[] = [];
  const written: string[] = [];

  try {
    // No index: the numbering counts body chapters (`bodyAt`), not positions,
    // because the matter pages mixed in among them take no number.
    chapters.forEach((chapter) => {
      const id = newId();
      window.localStorage.setItem(bodyKey(id), JSON.stringify(chapter.doc));
      written.push(id);
      /* A matter page keeps its own name; only body chapters are renumbered,
         because "Chapter 4 – Dedication" is what happens when they are not. */
      metas.push(
        chapter.matter
          ? {
              id,
              title: chapter.title,
              words: chapter.words,
              matter: chapter.matter,
            }
          : {
              id,
              title: renumberTitle(chapter.title, startNumber + bodyAt++ + 1),
              words: chapter.words,
            },
      );
    });
  } catch (err) {
    console.error("[store] import failed, rolling back", err);
    for (const id of written) {
      try {
        window.localStorage.removeItem(bodyKey(id));
      } catch {
        // The shelf is untouched; these are just unreachable bytes.
      }
    }
    return null;
  }

  const undo: ImportUndo = {
    bookId,
    addedIds: written,
    removed: [],
    prevLastOpenedId: book.lastOpenedId,
  };

  if (mode === "replace") {
    // The body alone. Front and back matter are the writer's own pages and
    // survive an import of the manuscript — see the note above.
    const clearing = book.chapters.filter((c) => chapterMatterOf(c) === "body");
    const keeping = book.chapters.filter((c) => chapterMatterOf(c) !== "body");

    // Snapshot the chapters being cleared — prose and notes — so undo restores
    // them, then remove their stored text.
    undo.removed = clearing.map((c) => ({
      meta: c,
      body: getBody(c.id),
      notes: getNotes(c.id),
    }));
    for (const c of clearing) {
      try {
        window.localStorage.removeItem(bodyKey(c.id));
        window.localStorage.removeItem(notesKey(c.id));
        window.localStorage.removeItem(historyKey(c.id));
      } catch {
        // Unreachable bytes, not a broken book.
      }
    }
    commitBook(bookId, (b) => ({
      ...b,
      // Regrouped front → body → back, as every other write to this array is,
      // so the stored order stays reading order.
      chapters: [...keeping, ...metas].sort(
        (a, x) => MATTER_RANK[chapterMatterOf(a)] - MATTER_RANK[chapterMatterOf(x)],
      ),
      lastOpenedId: metas[0].id,
    }));
  } else {
    commitBook(bookId, (b) => ({
      ...b,
      chapters: [...b.chapters, ...metas],
      lastOpenedId: metas[0].id,
    }));
  }


  return { firstId: metas[0].id, undo };
}

/**
 * Reverses an import: removes the chapters it added, and — if it was a replace
 * — puts the cleared chapters back with their prose and notes intact.
 */
export function undoChapterImport(undo: ImportUndo) {
  if (!findBook(getShelf(), undo.bookId)) return;

  for (const id of undo.addedIds) {
    try {
      window.localStorage.removeItem(bodyKey(id));
      window.localStorage.removeItem(notesKey(id));
      window.localStorage.removeItem(historyKey(id));
    } catch {
      // Unreachable bytes either way.
    }
  }

  for (const r of undo.removed) {
    try {
      if (r.body !== null) window.localStorage.setItem(bodyKey(r.meta.id), r.body);
      if (r.notes !== null)
        window.localStorage.setItem(notesKey(r.meta.id), r.notes);
    } catch {
      // Best effort; the shelf below is what makes the chapter visible.
    }
  }

  const addedSet = new Set(undo.addedIds);
  commitBook(undo.bookId, (b) => {
    /* **Drop what was added, put back what was removed** — one rule for both
       modes. This used to *replace* the whole array with the snapshot whenever
       anything had been removed, on the reasoning that a replace had cleared
       everything. It no longer clears everything: front and back matter now
       survive an import, so restoring only the snapshot would have undone the
       import by deleting the very pages the import was fixed to protect. */
    const chapters = [
      ...b.chapters.filter((c) => !addedSet.has(c.id)),
      ...undo.removed.map((r) => r.meta),
    ].sort(
      (x, y) => MATTER_RANK[chapterMatterOf(x)] - MATTER_RANK[chapterMatterOf(y)],
    );
    return {
      ...b,
      chapters,
      lastOpenedId:
        undo.prevLastOpenedId &&
        chapters.some((c) => c.id === undo.prevLastOpenedId)
          ? undo.prevLastOpenedId
          : (chapters[0]?.id ?? null),
    };
  });

  // Nothing to give back: importing is unbounded on either plan.
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

/**
 * Sends a chapter to the book's trash rather than erasing it.
 *
 * The meta moves to `trash` with a timestamp and its body and notes are left in
 * storage untouched, so restoreChapter can bring it back whole. Permanent
 * deletion is a separate, deliberate step — see deleteChapterForever.
 */
export function deleteChapter(bookId: string, chapterId: string) {
  commitBook(bookId, (book) => {
    const target = book.chapters.find((c) => c.id === chapterId);
    if (!target) return book;

    const index = book.chapters.findIndex((c) => c.id === chapterId);
    const chapters = book.chapters.filter((c) => c.id !== chapterId);

    // Whatever took its place, or the one before it if it was last. Falling
    // back to the first chapter sent a writer who deleted chapter twenty all
    // the way back to chapter one.
    const neighbour = index < 0 ? null : (chapters[index] ?? chapters[index - 1]);

    return {
      ...book,
      chapters,
      trash: [{ ...target, trashedAt: Date.now() }, ...(book.trash ?? [])],
      lastOpenedId:
        book.lastOpenedId === chapterId
          ? (neighbour?.id ?? null)
          : book.lastOpenedId,
    };
  });
}

/** Every deleted-but-kept chapter in a book, newest first. */
export function trashedChapters(book: Book): readonly TrashedChapter[] {
  return book.trash ?? [];
}

/** Puts a trashed chapter back, at the end of the book. Its prose is intact. */
export function restoreChapter(bookId: string, chapterId: string) {
  commitBook(bookId, (book) => {
    const item = (book.trash ?? []).find((t) => t.id === chapterId);
    if (!item) return book;

    // Rebuild an ordinary chapter meta, dropping the trashedAt marker but
    // keeping the bookmark and its front/back matter tag.
    const meta: ChapterMeta = {
      id: item.id,
      title: item.title,
      words: item.words,
      ...(item.bookmarked ? { bookmarked: true as const } : {}),
      ...(item.matter ? { matter: item.matter } : {}),
    };
    return {
      ...book,
      chapters: [...book.chapters, meta],
      trash: (book.trash ?? []).filter((t) => t.id !== chapterId),
      lastOpenedId: book.lastOpenedId ?? meta.id,
    };
  });
}

/** Erases a trashed chapter for good, prose and all. Not recoverable. */
export function deleteChapterForever(bookId: string, chapterId: string) {
  commitBook(bookId, (book) => ({
    ...book,
    trash: (book.trash ?? []).filter((t) => t.id !== chapterId),
  }));

  try {
    window.localStorage.removeItem(bodyKey(chapterId));
    window.localStorage.removeItem(notesKey(chapterId));
    window.localStorage.removeItem(historyKey(chapterId));
  } catch {
    // Unreachable bytes, not a broken app.
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
): boolean {
  const book = findBook(getShelf(), bookId);

  /*
   * **A book this writer may not write is not written, locally either.**
   *
   * The database refuses a viewer's row, so the prose was never going to land —
   * but writing it to localStorage anyway is worse than refusing: the reader's
   * copy silently diverges from the book everybody else can see, and nothing on
   * screen says which one is real. The UI hides the controls and the editor is not
   * typeable, so reaching here at all means a bug; failing closed is what keeps
   * that bug from becoming two versions of a manuscript.
   *
   * Returned rather than thrown, because the caller is an autosave.
   */
  if (book && !canWriteBook(book)) return false;

  const raw = JSON.stringify(doc);
  window.localStorage.setItem(bodyKey(chapterId), raw);

  /*
   * **Only prose with a chapter to hang on is sent.**
   *
   * `chapter_bodies` derives its book and owner from the chapter row in a
   * trigger, which raises `foreign_key_violation` when there is no such row —
   * and 23503 is retryable, because the ordinary cause is a body queued a beat
   * before the chapter that carries it. For a chapter that no longer *exists*
   * there is nothing to wait for: the job fails five times, gives up, and
   * writes six red lines into the console for a row that could never land.
   * Seen with a chapter that was in neither the shelf nor the trash while its
   * body key was still in storage — a book emptied out from under an autosave
   * in flight.
   *
   * The local write above still happens. Refusing that would throw away the
   * writer's last keystrokes to tidy a key, and an orphaned body costs a few
   * kilobytes until `uploadLibrary` drops it — which it already does, for
   * exactly this reason. This only declines to *send* what the server has
   * nowhere to put.
   *
   * Asked here rather than in `sync.ts`: that module reads no storage and owns
   * no state on purpose, so the caller is what decides there is something to
   * push. Same direction as every other call in this file.
   */
  const onShelf =
    book?.chapters.some((c) => c.id === chapterId) ??
    getShelf().books.some((b) => b.chapters.some((c) => c.id === chapterId));
  if (onShelf) pushBody(chapterId, raw);

  // *After* the body is written, never before, and never in a way that can
  // throw: history is a nicety and the manuscript is the point. A quota error
  // taking the save down with it would be a backup feature that loses work.
  rememberVersion(chapterId, raw, words);

  const current = book?.chapters.find((c) => c.id === chapterId);
  if (!current || current.words === words) return true;

  // The day's log, before the shelf is updated — `current.words` is still the
  // previous count at this point, and the difference is the day's work.
  rememberActivity(words - current.words);

  commitBook(bookId, (b) => ({
    ...b,
    chapters: b.chapters.map((c) => (c.id === chapterId ? { ...c, words } : c)),
  }));
  return true;
}

export function touchLastOpened(bookId: string, chapterId: string) {
  const shelf = getShelf();
  const book = findBook(shelf, bookId);
  if (!book) return;

  // All three, in one commit.
  //
  // This used to set the chapter alone, and `touchLastOpenedBook` — which sets
  // the other two — was called by nothing outside its own tests. So the shelf's
  // idea of the most recent book was fixed at the moment a book was *created*
  // and never moved again: a writer could spend a week in one manuscript and
  // "Continue writing" would still offer whichever they had made last, over a
  // figure labelled as when they opened it. Writing in a book is the strongest
  // evidence there is of which book you are working on.
  const current =
    book.lastOpenedId === chapterId && shelf.lastOpenedBookId === bookId;
  // Recency moves even when nothing else does, so an unchanged chapter is still
  // worth a write — but not repeatedly. Every commit here is a shelf write and
  // a push, and a stamp a few seconds old answers the same question as a fresh
  // one.
  if (current && Date.now() - book.lastOpenedAt < 60_000) return;

  const at = Date.now();
  commit({
    ...shelf,
    books: shelf.books.map((b) =>
      b.id === bookId
        ? { ...b, lastOpenedId: chapterId, lastOpenedAt: at }
        : b,
    ),
    lastOpenedBookId: bookId,
  });
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

/**
 * Tick or untick one step of the publishing roadmap.
 *
 * Only the steps that happen *outside* the app are stored — getting a cover
 * made, sending the ARCs, uploading. The rest work themselves out from the
 * book, and `roadmapFor()` ignores a stored tick on those deliberately, so
 * nothing here can put the list out of step with the truth.
 *
 * **Not synced.** `sync.ts` maps a book's columns by name and this is not one
 * of them, so roadmap ticks stay on the machine they were made on. Noted in
 * TODO.md; a writer on two machines will tick twice.
 */
export function setRoadmapStep(bookId: string, stepId: string, done: boolean) {
  commitBook(bookId, (book) => {
    const current = book.roadmapDone ?? [];
    const next = done
      ? [...new Set([...current, stepId])]
      : current.filter((id) => id !== stepId);
    const out = { ...book };
    if (next.length > 0) out.roadmapDone = next;
    else delete out.roadmapDone;
    return out;
  });
}

/**
 * The word count a book is aiming at.
 *
 * Zero or less removes it rather than storing a goal of nothing: absent means
 * "no target", and the editor shows no progress at all for a book without one.
 * Storing `0` would instead show a bar that is permanently complete.
 */
export function setTargetWords(bookId: string, words: number) {
  commitBook(bookId, (book) => {
    const next = { ...book };
    if (words > 0) next.targetWords = Math.round(words);
    else delete next.targetWords;
    return next;
  });
}

/**
 * Whether cover artwork is shown without words printed over it.
 *
 * A jacket the writer designed already has its title on it, and printing ours
 * on top of theirs is worse than showing nothing.
 */
export function setBareCover(bookId: string, bare: boolean) {
  commitBook(bookId, (book) => {
    const next = { ...book };
    if (bare) next.bareCover = true;
    else delete next.bareCover;
    return next;
  });
}

/**
 * The three fields the cover shows, written together.
 *
 * One commit rather than three, so the shelf never repaints mid-edit with a new
 * title above an old byline. Blank means absent: a subtitle cleared to nothing
 * should leave the cover, not sit on it as an empty line.
 */
export function setBookDetails(
  bookId: string,
  details: {
    title: string;
    subtitle: string;
    author: string;
    /**
     * The genre, which until now could only be set when a book was *made*.
     *
     * That was fine while every book came from `/book/new`, which asks. An
     * imported one never does, and a book with no genre silently dead-ends
     * comp titles, categories, the blurb examples and the structure targets —
     * `buildQuery()` has nothing to search on. Four broken tools and no way to
     * fix the cause was the single worst gap on the shelf.
     */
    genre?: string;
  },
) {
  commitBook(bookId, (book) => {
    const next = { ...book, title: details.title.trim() || "Untitled Book" };

    if (details.subtitle.trim()) next.subtitle = details.subtitle.trim();
    else delete next.subtitle;

    if (details.author.trim()) next.author = details.author.trim();
    else delete next.author;

    if (details.genre?.trim()) next.genre = details.genre.trim();
    else delete next.genre;

    return next;
  });
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

/**
 * The chrome's colour scheme. The paper above is a separate choice — a writer
 * can keep a white page whichever way the chrome is dressed.
 */
export type Theme = "system" | "light" | "dark";

const THEMES: readonly Theme[] = ["system", "light", "dark"];

export interface Prefs {
  /** Dim every paragraph but the one being written. */
  focusMode: boolean;
  /**
   * Show the paragraph marks, as Word's ¶ button does.
   *
   * Blank space on a page is ambiguous: it may be room the page has, or it may
   * be empty paragraphs, which take up room while showing nothing. The two look
   * identical and behave completely differently, and there is no way to tell
   * them apart by looking. This is how a word processor answers that.
   */
  marks: boolean;
  /** Hold the caret at a fixed height instead of letting it sink. */
  typewriter: boolean;
  /** The chapters-and-notes panel. */
  leftPanel: boolean;
  /**
   * Which face the editor's book panel shows — the cover, or the three parts.
   *
   * Stored rather than held in memory because a reload is not a decision. A
   * writer who moved the panel to the parts and then refreshed was put back on
   * the cover, having asked for nothing of the sort.
   */
  bookPanel: "book" | "chapters";
  /** The colour of the page under the prose. */
  paper: PaperColor;
  /**
   * The chrome's colour scheme.
   *
   * Three values, not two: **"system" is a real answer, not the absence of
   * one.** A writer whose laptop turns dark at sunset has already said what
   * they want, and a two-way toggle makes them say it again twice a day. It is
   * the default for the same reason.
   *
   * Only ever `light` or `dark` reaches CSS — the bootstrap in layout.tsx
   * resolves "system" against `prefers-color-scheme` and writes the answer to
   * `<html data-theme>`, so no stylesheet has to know this third value exists.
   */
  theme: Theme;
  /**
   * Books whose front/back-matter setup question has been answered — or
   * skipped.
   *
   * **A note that a question was asked, not a fact about the book**, which is
   * why it is here and not on the book itself. It records nothing a reader of
   * the manuscript would want and it must not travel: a writer who skipped the
   * dialog on their laptop has said nothing about what they want on their
   * phone, and a field on the book would have to be a column in Postgres to
   * survive at all.
   *
   * Book ids rather than a single boolean, because the question is per book —
   * the second novel deserves it as much as the first.
   */
  matterAsked: string[];
  /**
   * Readiness banners the writer has waved away, by signature.
   *
   * **Persisted, where it used to live only in component state.** The argument
   * for keeping it in memory was that a dismissal means "I have read it" rather
   * than "never again", and that coming back on a fresh visit is the safe
   * direction for a diagnosis to fail in. That is true of a *changed*
   * diagnosis and false of an unchanged one: pressing × and having the same
   * red row return on the next visit is not a safe failure, it is the app not
   * listening, and a banner that ignores its own dismiss control teaches a
   * writer to ignore the banner.
   *
   * The signature is the book and its two counts, so the safety is kept where
   * it was actually doing work: waving away "1 to fix · 4 worth doing" hides
   * exactly that, and a *new* blocking problem carries a new signature and
   * speaks up. Fixing something changes it too, which is the right kind of
   * wrong — a banner that returns to say fewer things are outstanding is
   * information, not nagging.
   *
   * Here rather than on a book for the reason `matterAsked` is: it records
   * something about the reader, not the manuscript, and a field on the book
   * would need a Postgres column to survive `sync.ts` at all.
   */
  dismissed: string[];
  /**
   * Today's count for each per-day tool, with the local day it belongs to.
   *
   * The day travels with the counts so a stale record reads as nought without
   * anybody having to sweep it — see `dailyAllowance`, which does that
   * comparison. It is deliberately *not* reset in the parser: `getPrefs` caches
   * on the raw string, so anything derived from the clock there goes stale the
   * moment midnight passes with nothing to invalidate it.
   */
  usedToday: DailyUse;
  /**
   * Which books each book-counted tool has been used on. Cumulative.
   *
   * **A set per tool, not a tally.** A book already listed costs nothing more
   * however much work is done on it, which is the whole of "unlimited within a
   * book". An id is added the first time a tool does real work there and is
   * never removed: dropping it when a book is deleted would make "five books"
   * mean "five at a time", a different promise from the one the pricing page
   * makes.
   */
  usedOn: Partial<Record<BookLimit, string[]>>;
  /**
   * How many of each lifetime allowance have been spent. Never reset.
   *
   * The plainest of the three counters and the only one with nothing that can
   * give a count back — no day to compare against, no set to union. That is
   * what "for the life of the account" means, and it is why the sentences
   * built from it may not borrow the daily ones' vocabulary.
   *
   * It counts *presses that produced something*: the screen records here when
   * a reply lands, not when the button is pressed, so a failed request does
   * not cost a writer one of five.
   */
  usedTotal: Partial<Record<TotalLimit, number>>;
}

const DEFAULT_PREFS: Prefs = Object.freeze({
  focusMode: false,
  typewriter: false,
  // Off, as in a word processor: shown when a writer goes looking for what is
  // taking up the space, not while they are simply writing.
  marks: false,
  // Navigation is open by default; the assistant is opt-in, since it is the
  // only part of the app that talks to a server.
  leftPanel: true,
  // The cover: the panel opens on the book as an object, and the writer
  // steps into its parts from there.
  bookPanel: "book",
  // Black by default, because the chrome around it is. A white sheet on a black
  // app is the one combination that glares, and a writer arriving for the first
  // time should not have to go and fix that. The other four sheets are still
  // there — including white, for anyone who wants a page that looks like paper.
  // setTheme keeps this in step with the chrome until the writer picks a sheet.
  paper: "black",
  // The machine's own answer, until the writer overrules it.
  theme: "system",
  // Nobody has been asked yet. Frozen with the rest, so it is shared — never
  // pushed to; `rememberMatterAsked` writes a new array.
  matterAsked: [],
  dismissed: [],
  // Nothing spent yet, which is also what a library stored before this existed
  // reads as. Erring low is deliberate: charging a writer for work they cannot
  // be shown any evidence of is the wrong way round to be wrong. Frozen with
  // the rest, so it is shared — the writers build new objects rather than
  // adding to this one.
  // Nothing used yet, which is also what a library stored before this existed
  // reads as. `day: ""` never equals a real local day, so a fresh library and a
  // legacy one both read as "nothing used today" with no special case anywhere.
  // Frozen with the rest, so they are shared — the writers below build new
  // objects rather than adding to these.
  usedToday: Object.freeze({ day: "", counts: Object.freeze({}) }) as DailyUse,
  usedOn: Object.freeze({}) as Partial<Record<BookLimit, string[]>>,
  usedTotal: Object.freeze({}) as Partial<Record<TotalLimit, number>>,
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
    const parsed = JSON.parse(raw) as Partial<Prefs> & { paperPicked?: boolean };
    return {
      focusMode: parsed.focusMode === true,
      typewriter: parsed.typewriter === true,
      marks: parsed.marks === true,
      leftPanel: parsed.leftPanel !== false,
      bookPanel: parsed.bookPanel === "chapters" ? "chapters" : "book",
      paper: paperFrom(parsed),
      theme: THEMES.includes(parsed.theme as Theme)
        ? (parsed.theme as Theme)
        : DEFAULT_PREFS.theme,
      // Narrowed on the way in like everything else here: this key is written
      // by us but read out of storage a version later, and a non-array would
      // throw on the first `.includes`.
      dismissed: Array.isArray(parsed.dismissed)
        ? parsed.dismissed.filter((s): s is string => typeof s === "string")
        : [],
      matterAsked: Array.isArray(parsed.matterAsked)
        ? parsed.matterAsked.filter((id): id is string => typeof id === "string")
        : [],
      // Narrowed on the way in for the same reason, and once more where they are
      // used: the allowance functions refuse anything that is not a whole
      // positive number, so a hand-edited key cannot make the arithmetic
      // nonsense.
      usedToday: parseUsedToday(parsed),
      usedOn: parseUsedOn(parsed),
      usedTotal: parseUsedTotal(parsed),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * The four tallies, narrowed one at a time.
 *
 * A missing action reads as nought, which is what every library stored before
 * this existed will do. The `imports` fallback is the one migration in here:
 * the first version of this counted imports alone, at the top level, and a
 * writer who had already brought books in must not have that forgiven silently
 * — a limit that resets itself is not a limit.
 */
/**
 * Today's counters, narrowed on the way in.
 *
 * The day is kept verbatim rather than compared against the clock here — see the
 * field's own note. Anything that is not a positive finite number is dropped
 * rather than coerced, so a hand-edited key cannot hand somebody an allowance.
 */
function parseUsedToday(parsed: Partial<Prefs>): DailyUse {
  const stored = parsed.usedToday;
  if (!stored || typeof stored !== "object" || typeof stored.day !== "string") {
    return { day: "", counts: {} };
  }

  const raw = (stored.counts ?? {}) as Record<string, unknown>;
  const counts: Partial<Record<DailyLimit, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      counts[key as DailyLimit] = Math.floor(value);
    }
  }

  return { day: stored.day, counts };
}

/**
 * The per-tool book lists, narrowed and de-duplicated on the way in.
 *
 * **Nothing is migrated from the version before this.** That one kept a single
 * `toolBooks` list meaning "some tool ran here", which cannot be split into
 * blurb-versus-prose after the fact, and kept no daily history at all. So every
 * writer starts clean. Erring generous is the only defensible direction when the
 * alternative is charging somebody for work there is no evidence of.
 */
function parseUsedOn(parsed: Partial<Prefs>): Partial<Record<BookLimit, string[]>> {
  const stored = parsed.usedOn;
  if (!stored || typeof stored !== "object") return {};

  const usedOn: Partial<Record<BookLimit, string[]>> = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    usedOn[key as BookLimit] = [
      ...new Set(value.filter((id): id is string => typeof id === "string")),
    ];
  }
  return usedOn;
}

/**
 * The lifetime counters, as whatever storage happens to hold.
 *
 * A string, a fraction, a negative or a missing key all read as nought — no
 * compiler has ever checked what is in `localStorage`, and this number decides
 * whether somebody is refused. Erring at nought is the generous direction, and
 * it is the right one: charging a writer for work there is no evidence of is
 * worse than handing out one extra suggestion.
 */
function parseUsedTotal(parsed: Partial<Prefs>): Partial<Record<TotalLimit, number>> {
  const stored = parsed.usedTotal;
  if (!stored || typeof stored !== "object") return {};

  const usedTotal: Partial<Record<TotalLimit, number>> = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    usedTotal[key as TotalLimit] = Math.floor(value);
  }
  return usedTotal;
}

/**
 * The three usage counters, merged rather than replaced, on the way down.
 *
 * **Every other pref is last-writer-wins and should be** — a writer who picks a
 * light theme on their phone means it, and the newest answer is the right one.
 * These two are not preferences, they are a record of what has been spent, and
 * taking the newest answer means a laptop and a phone can each hand out a full
 * allowance: two comp searches here, two there, four in a day the plan says
 * holds two. It loses counts in the other direction just as easily, which is the
 * same bug wearing a friendlier face.
 *
 * So each is merged in the way its own shape allows:
 *
 * - **`usedOn` is a set union**, which is lossless. That is the whole advantage
 *   of a set of books over a tally of attempts: two machines can each mark a
 *   different book and neither mark is lost, where two tallies can only be
 *   guessed between.
 * - **`usedTotal` takes the larger count per tool**, which is the only answer
 *   available and is deliberately not the sum. Summing would charge a writer
 *   twice for one press whenever a machine downloads a count it has already
 *   pushed — five would become two or three within a day of ordinary syncing.
 *   Taking the larger loses a genuine second press made offline on the other
 *   machine, which costs us one model call and never costs a writer anything
 *   they paid for. That is the direction to be wrong in.
 * - **`usedToday` takes the larger count per tool** when both machines are on
 *   the same local day, and otherwise the *later* day outright. A day string
 *   sorts correctly as text, and the empty day a fresh library carries sorts
 *   below every real one, so a machine that has never counted anything never
 *   overwrites one that has.
 *
 * The bias is deliberate and it is towards the plan: where two machines
 * disagree about how much has been spent, this believes the one that spent more.
 * Erring the other way would make the daily limits advisory for anybody with two
 * browsers, and these are browser gates already — they do not need a second way
 * round them.
 *
 * Pure and exported for its test: it is handed both sides rather than reading
 * storage, so a merge can be asserted without staging two browsers.
 */
export function mergeUsage(
  local: Pick<Prefs, "usedToday" | "usedOn" | "usedTotal">,
  remote: Partial<Prefs>,
): Pick<Prefs, "usedToday" | "usedOn" | "usedTotal"> {
  const theirs = {
    usedToday: parseUsedToday(remote),
    usedOn: parseUsedOn(remote),
    usedTotal: parseUsedTotal(remote),
  };

  const usedOn: Partial<Record<BookLimit, string[]>> = {};
  for (const action of new Set([
    ...Object.keys(local.usedOn),
    ...Object.keys(theirs.usedOn),
  ]) as Set<BookLimit>) {
    usedOn[action] = [
      ...new Set([...(local.usedOn[action] ?? []), ...(theirs.usedOn[action] ?? [])]),
    ];
  }

  const usedTotal: Partial<Record<TotalLimit, number>> = { ...local.usedTotal };
  for (const [key, value] of Object.entries(theirs.usedTotal)) {
    const action = key as TotalLimit;
    usedTotal[action] = Math.max(usedTotal[action] ?? 0, value ?? 0);
  }

  if (theirs.usedToday.day !== local.usedToday.day) {
    return {
      usedToday:
        theirs.usedToday.day > local.usedToday.day
          ? theirs.usedToday
          : local.usedToday,
      usedOn,
      usedTotal,
    };
  }

  const counts: Partial<Record<DailyLimit, number>> = { ...local.usedToday.counts };
  for (const [key, value] of Object.entries(theirs.usedToday.counts)) {
    const action = key as DailyLimit;
    counts[action] = Math.max(counts[action] ?? 0, value ?? 0);
  }

  return { usedToday: { day: local.usedToday.day, counts }, usedOn, usedTotal };
}

/**
 * The stored sheet, or the default for anyone who has never picked one.
 *
 * Reading is deliberately dumb — whatever is in the key, or the default. The
 * decision about what an *unpicked* sheet should be belongs to `setTheme`,
 * which is the only thing that knows which way the chrome is dressed, and it
 * writes its answer down. Working it out here instead was tried and is wrong:
 * this runs during render, off a cache keyed on the raw string, so a value
 * derived from anything but that string goes stale the moment the theme moves
 * and nothing invalidates it.
 *
 * `paperPicked` is written by `setPref` the moment anybody opens the Paper
 * menu and chooses, and it is what keeps `setTheme` from overruling them.
 */
function paperFrom(parsed: Partial<Prefs> & { paperPicked?: boolean }) {
  return PAPER_COLORS.includes(parsed.paper as PaperColor)
    ? (parsed.paper as PaperColor)
    : DEFAULT_PREFS.paper;
}

/**
 * True for a library stored before the theme existed.
 *
 * Those carry `paper: "white"` — the old light default — with no theme beside
 * it, so nothing has ever decided whether that sheet was a choice or a shrug.
 * `ThemeSync` calls `setTheme("system")` once when this is true, which records
 * the theme and moves the unpicked sheet to match the chrome in one write.
 */
export function themeUnset(): boolean {
  return storedPrefs().theme === undefined;
}

export function getServerPrefs(): Prefs {
  return DEFAULT_PREFS;
}

/** Whatever is actually in the key, fields and all. Only setPref needs this. */
function storedPrefs(): Record<string, unknown> {
  const raw = readRaw(PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  // Merged onto what is *stored* rather than onto the parsed value, so fields
  // the type does not know about survive a write. There is one — `paperPicked`,
  // below — and dropping it would re-run the white-to-black migration over a
  // writer who had already said they wanted a white page.
  const next = { ...storedPrefs(), ...getPrefs(), [key]: value };
  // Stamped rather than added to Prefs: it is not a setting, it is a note to
  // the parser that this writer has now answered the question. See paperFrom.
  if (key === "paper") {
    (next as Prefs & { paperPicked?: boolean }).paperPicked = true;
  }
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[store] could not write prefs", err);
    return;
  }
  for (const listener of prefsListeners) listener();
  pushPrefs(next);
}

/**
 * Whether this book still has the front/back-matter question to answer.
 *
 * Two conditions, and both matter. The book must have **no matter pages at
 * all** — a writer who has already made a dedication has answered by doing,
 * and a dialog offering to set up what is on screen is a dialog that has not
 * looked. And it must not have been **asked before**, skip included: "no
 * thanks" is an answer, and asking again next Tuesday makes it a nag.
 *
 * An imported EPUB often arrives with front matter of its own, so this is
 * quietly false for exactly the books that least need asking.
 */
export function shouldAskMatter(book: Book): boolean {
  if (book.chapters.some((c) => chapterMatterOf(c) !== "body")) return false;
  return !getPrefs().matterAsked.includes(book.id);
}

/**
 * Spend one of today's uses of a per-day tool.
 *
 * The only way anything writes `usedToday`, so no screen grows its own
 * read-modify-write. **The reset is folded in**: a stored record from yesterday
 * is replaced rather than added to, so the first press of a new day starts at
 * one however long the app was left open.
 *
 * What the limit *is* is not decided here — `lib/free-limits.ts` holds the policy
 * and the screens hold the gate; this only keeps the count.
 */
export function spendDailyUse(action: DailyLimit) {
  const stored = getPrefs().usedToday;
  const day = localDay();
  const counts = stored.day === day ? stored.counts : {};

  setPref("usedToday", {
    day,
    counts: { ...counts, [action]: (counts[action] ?? 0) + 1 },
  });
}

/**
 * Record that a book-counted tool has done real work on this book.
 *
 * The only way anything writes `usedOn`. **Idempotent, and that is the
 * feature**: calling it on a book already listed writes nothing at all — no
 * storage write, no fan-out, no push — so every screen can call it on every
 * action without having to work out whether this particular press is the first.
 */
export function markToolBook(action: BookLimit, bookId: string) {
  const usedOn = getPrefs().usedOn;
  const books = usedOn[action] ?? [];
  if (books.includes(bookId)) return;

  setPref("usedOn", { ...usedOn, [action]: [...books, bookId] });
}

/** Whether this book is already one of the ones that tool is counted on. */
export function isToolBook(action: BookLimit, bookId: string): boolean {
  return (getPrefs().usedOn[action] ?? []).includes(bookId);
}

/**
 * Spend one of a lifetime allowance. The only way anything writes `usedTotal`.
 *
 * **Not idempotent, unlike `markToolBook`**, and it cannot be: there is no id
 * here to recognise a repeat by, and a second suggestion really is a second
 * call to pay for. So this is called exactly once per successful reply, by the
 * screen that received it — never by `useLimitGate`, which fires on the press
 * and would charge for a request that failed.
 */
export function spendTotalUse(action: TotalLimit) {
  const usedTotal = getPrefs().usedTotal;
  setPref("usedTotal", { ...usedTotal, [action]: (usedTotal[action] ?? 0) + 1 });
}

/** How many of a lifetime allowance have gone. */
export function totalUsed(action: TotalLimit): number {
  return getPrefs().usedTotal[action] ?? 0;
}

/**
 * Wave away a book's readiness banner at its current counts.
 *
 * Keyed by the book *and* the two figures, so it hides the thing that was read
 * rather than the row forever — see `Prefs.dismissed`. Older signatures for the
 * same book are dropped on the way in: they can never match again (the counts
 * they name have already changed), and a list that only grows would carry one
 * entry per state a book has ever been in.
 */
export function dismissBanner(bookId: string, fix: number, note: number) {
  const signature = `${bookId}:${fix}:${note}`;
  const kept = getPrefs().dismissed.filter(
    (s) => !s.startsWith(`${bookId}:`),
  );
  setPref("dismissed", [...kept, signature]);
}

/** Records that the question has been put, whatever the answer was. */
export function rememberMatterAsked(bookId: string) {
  const asked = getPrefs().matterAsked;
  if (asked.includes(bookId)) return;
  // A new array rather than a push: DEFAULT_PREFS is frozen and shared, and the
  // cached parse is handed out by reference to every screen that reads prefs.
  setPref("matterAsked", [...asked, bookId]);
}

/** What "system" currently means on this machine. */
export function systemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Change the theme, and bring the page with it.
 *
 * The paper is a separate setting on purpose — a writer may want a white sheet
 * on a black app, and plenty do. But *until they have said so*, the sheet is
 * only carrying the default, and leaving a black page in the middle of a white
 * app is leaving the writer to fix something they did not choose. So the
 * default sheet follows the chrome, and `paperPicked` is what stops this
 * touching anybody who has been to the Paper menu.
 *
 * "system" is resolved here rather than stored as a rule, because there is no
 * good answer to what should happen to the page at sunset: silently repainting
 * the sheet somebody is writing on is worse than leaving it where they last
 * saw it.
 */
export function setTheme(theme: Theme) {
  const stored = storedPrefs();
  const next = { ...stored, ...getPrefs(), theme };

  if (stored.paperPicked !== true) {
    const showing = theme === "system" ? systemTheme() : theme;
    (next as Prefs).paper = showing === "light" ? "white" : "black";
    // Still not "picked": the writer chose a *theme*, and the sheet came along
    // with it. Marking it picked here would freeze the page at the first
    // switch and quietly break the rule above.
  }

  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[store] could not write prefs", err);
    return;
  }
  for (const listener of prefsListeners) listener();
  pushPrefs(next as Prefs);
}

// ---------------------------------------------------------------------------
// Chapter notes
//
// At their own key, like chapter bodies and for the same reason: notes are
// unbounded text a writer types into, and putting them in the shelf would make
// every keystroke rewrite the document the sidebar reads.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The story bible
//
// One key per book, like covers: it belongs to a book rather than to the
// library, and it is unbounded text that must not ride along in a shelf write.
// ---------------------------------------------------------------------------

const BIBLE_PREFIX = "openchapter:bible:";
const bibleKey = (bookId: string) => `${BIBLE_PREFIX}${bookId}`;
const bibleListeners = new Set<() => void>();

export function subscribeToBible(bookId: string, onStoreChange: () => void) {
  bibleListeners.add(onStoreChange);
  const key = bibleKey(bookId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    bibleListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getBibleRaw(bookId: string): string | null {
  return readRaw(bibleKey(bookId));
}

export function getServerBibleRaw(): string | null {
  return null;
}

/**
 * Write a book's bible back.
 *
 * Not swallowed on failure, for the same reason the ledger is not: this is what
 * the writer typed, rather than something the app worked out for itself.
 */
export function saveBibleRaw(bookId: string, json: string) {
  window.localStorage.setItem(bibleKey(bookId), json);
  for (const listener of bibleListeners) listener();
}

/**
 * Several books' bibles at once — the series read.
 *
 * The snapshot is **one string** rather than a list of raws, and that is the
 * whole trick: `useSyncExternalStore` compares snapshots with `Object.is` and
 * re-renders forever if handed a fresh array each time. A string of the same
 * characters is the same value, so this settles.
 *
 * It carries the whole payload — ids *and* their stored bibles — so the hook
 * parses this one string and never re-reads storage. Stamping the ids in is
 * what makes adding a book to a series change the snapshot even when the book
 * arriving has no bible of its own.
 */
export function getBiblesRaw(bookIds: readonly string[]): string {
  return JSON.stringify(bookIds.map((id) => [id, readRaw(bibleKey(id))]));
}

export function getServerBiblesRaw(): string {
  return "[]";
}

/**
 * Local writes fan out to every listener, as one book's does — a bible is
 * edited in the panel that reads it, and the series view is often the same
 * panel. Cross-tab is filtered to the keys asked for.
 */
export function subscribeToBibles(
  bookIds: readonly string[],
  onStoreChange: () => void,
) {
  bibleListeners.add(onStoreChange);
  const keys = new Set(bookIds.map(bibleKey));
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || keys.has(event.key)) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    bibleListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------------------
// Advance copies
//
// One key per book, like the bible: an advance-copy list belongs to a launch,
// and a writer running two launches at once needs two lists, not one merged one.
// ---------------------------------------------------------------------------

const ARC_PREFIX = "openchapter:arc:";
const arcKey = (bookId: string) => `${ARC_PREFIX}${bookId}`;
const arcListeners = new Set<() => void>();

export function subscribeToArc(bookId: string, onStoreChange: () => void) {
  arcListeners.add(onStoreChange);
  const key = arcKey(bookId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    arcListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getArcRaw(bookId: string): string | null {
  return readRaw(arcKey(bookId));
}

export function getServerArcRaw(): string | null {
  return null;
}

/**
 * Write a book's advance-copy list back.
 *
 * Not swallowed, like the bible and the ledger: these are names and dates the
 * writer typed, and a silent failure here loses the only record of who has the
 * book.
 */
export function saveArcRaw(bookId: string, json: string) {
  window.localStorage.setItem(arcKey(bookId), json);
  for (const listener of arcListeners) listener();
}

// ---------------------------------------------------------------------------
// The ledger — what each book cost against what it earned
//
// One key for the library rather than one per book: the rows are small, a
// writer wants to see all their books together, and this is the one store here
// that a person might genuinely want to export and keep.
// ---------------------------------------------------------------------------

const LEDGER_KEY = "openchapter:ledger";
const ledgerListeners = new Set<() => void>();

export function subscribeToLedger(onStoreChange: () => void) {
  ledgerListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LEDGER_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    ledgerListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getLedgerRaw(): string | null {
  return readRaw(LEDGER_KEY);
}

export function getServerLedgerRaw(): string | null {
  return null;
}

/**
 * Write the ledger back.
 *
 * Unlike history and the writing log, a failure here is *not* swallowed: those
 * two are conveniences the app derives for itself, and this is what the writer
 * typed. Losing a row they entered by hand, silently, in a screen about money,
 * would be the worst kind of quiet failure — so it throws and the caller says
 * so.
 */
export function saveLedgerRaw(json: string) {
  window.localStorage.setItem(LEDGER_KEY, json);
  for (const listener of ledgerListeners) listener();
}

// ---------------------------------------------------------------------------
// The writing log
//
// A number per day and nothing else, at its own key — a year of it is a few
// kilobytes. Deliberately *not* per book: it answers "am I writing", which is a
// question about the writer rather than about any one manuscript, and a writer
// who spent March on book two did not have a bad March.
// ---------------------------------------------------------------------------

const ACTIVITY_KEY = "openchapter:activity";
const activityListeners = new Set<() => void>();

export function subscribeToActivity(onStoreChange: () => void) {
  activityListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACTIVITY_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    activityListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getActivityRaw(): string | null {
  return readRaw(ACTIVITY_KEY);
}

export function getServerActivityRaw(): string | null {
  return null;
}

/**
 * Add a save's change to today's total. Never throws, for the reason a snapshot
 * never throws: the manuscript is already saved, and a log is not worth a lost
 * chapter.
 */
function rememberActivity(delta: number) {
  if (delta === 0) return;
  try {
    const next = trimActivity(
      recordActivity(parseActivity(getActivityRaw()), delta),
    );
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
    for (const listener of activityListeners) listener();
  } catch {
    // Deliberately silent, as above.
  }
}

// ---------------------------------------------------------------------------
// Chapter history
//
// One key per chapter, like bodies and notes, and for a sharper version of the
// same reason: versions are the largest thing this app stores per chapter and
// must never ride along in a write of anything else.
//
// Everything here is best-effort. `localStorage` is about 5MB an origin and a
// library of forty chapters could not possibly keep eight versions of each, so
// a failed write is swallowed: the body has already been saved by the time any
// of this runs, and losing a snapshot is a nicety lost, while throwing here
// would be a backup feature that loses work.
// ---------------------------------------------------------------------------

const HISTORY_PREFIX = "openchapter:history:";
const historyKey = (chapterId: string) => `${HISTORY_PREFIX}${chapterId}`;
const historyListeners = new Set<() => void>();

export function subscribeToHistory(id: string, onStoreChange: () => void) {
  historyListeners.add(onStoreChange);
  const key = historyKey(id);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    historyListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getHistoryRaw(chapterId: string): string | null {
  return readRaw(historyKey(chapterId));
}

export function getServerHistoryRaw(): string | null {
  return null;
}

/**
 * Keep this version of a chapter, if it is worth keeping.
 *
 * Called from `saveBody` on every autosave, and declines most of them — see
 * `shouldSnapshot`. Never throws: a full origin means no history, not a failed
 * save.
 */
function rememberVersion(chapterId: string, body: string, words: number) {
  try {
    const history = parseHistory(getHistoryRaw(chapterId));
    const now = Date.now();
    if (!shouldSnapshot(history, body, now)) return;

    const next = addSnapshot(history, { at: now, body, words });
    window.localStorage.setItem(historyKey(chapterId), JSON.stringify(next));
    for (const listener of historyListeners) listener();
  } catch {
    // Deliberately silent. See the note at the head of this section.
  }
}

// A chapter's history is removed wherever its body and notes are, inline at
// each of the four sites — the same shape those two already use. A helper here
// would be a fifth way to do a thing that is done four ways already.

// ---------------------------------------------------------------------------
// The idea parking lot
//
// At its own key, and *not* on the shelf: ideas are unbounded text with no book
// attached, and they belong to the writer rather than to any one manuscript —
// the whole point is that they are the ideas which are not the book being
// written. See lib/ideas.ts for the shape and why they are parked rather than
// started.
//
// Local fan-out is manual, as the shelf's is: a writer capturing an idea in the
// editor should see the count change in the same tab, not only in the next one.
// ---------------------------------------------------------------------------

const IDEAS_KEY = "openchapter:ideas";
const ideaListeners = new Set<() => void>();

export function subscribeToIdeas(onStoreChange: () => void) {
  ideaListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === IDEAS_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    ideaListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getIdeasRaw(): string | null {
  return readRaw(IDEAS_KEY);
}

export function getServerIdeasRaw(): string | null {
  return null;
}

export function saveIdeasRaw(json: string) {
  try {
    window.localStorage.setItem(IDEAS_KEY, json);
  } catch (err) {
    console.error("[store] could not write ideas", err);
    return;
  }
  for (const listener of ideaListeners) listener();
}

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
    return;
  }
  pushNotes(id, text);
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

export function typographyOf(book: Book): Typography {
  return { ...DEFAULT_TYPOGRAPHY, ...(book.typography ?? {}) };
}

export function setTypography(bookId: string, patch: Partial<Typography>) {
  commitBook(bookId, (book) => ({
    ...book,
    typography: { ...typographyOf(book), ...patch },
  }));
}

/**
 * The listing details, patched field by field.
 *
 * There is no `publishingOf` counterpart with defaults, because there are none
 * to give: an unset ISBN is not a default ISBN, and inventing a publisher for a
 * writer who has not named one is how a book goes to a shop under a name nobody
 * chose. Absent stays absent, and an empty string clears the field rather than
 * storing a blank.
 */
export function setPublishing(bookId: string, patch: Partial<PublishingMeta>) {
  commitBook(bookId, (book) => {
    const next: PublishingMeta = { ...(book.publishing ?? {}) };
    for (const [key, value] of Object.entries(patch)) {
      // The same rule `tidyPublishing` applies, so a screen holding a draft
      // can tell whether its form matches what a save would actually store.
      if (isEmptyDetail(value)) delete next[key as keyof PublishingMeta];
      else Object.assign(next, { [key]: value });
    }
    // An object with nothing in it is not a setting; drop it so the shelf does
    // not grow an empty `publishing: {}` on every book somebody opened once.
    if (Object.keys(next).length === 0) {
      const cleared = { ...book };
      delete cleared.publishing;
      return cleared;
    }
    return { ...book, publishing: next };
  });
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
// Syncing with Supabase
//
// Reads never come from here — localStorage stays the read path, so getShelf()
// stays synchronous and every screen keeps rendering from the first paint. This
// is the once-per-load reconciliation: work out whether this browser's library
// belongs on the server or the server's belongs here, and make them agree.
//
// See docs/plans/2026-07-29-supabase-persistence-design.md.
// ---------------------------------------------------------------------------

/** Whose library is currently cached in this browser. */
const OWNER_KEY = "openchapter:owner";

/**
 * Every key this app owns, wiped.
 *
 * Needed because a browser is shared. Without it the second writer to sign in
 * on a machine inherits the first one's shelf — and now with a server behind
 * it, would push those books up under their own account.
 */
export function clearLocalLibrary() {
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("openchapter:")) doomed.push(key);
  }
  for (const key of doomed) window.localStorage.removeItem(key);

  /* **Cover artwork lives in IndexedDB and has to go with the rest.**
     Without this, the second writer on a shared browser inherits the first
     one's full-size covers — invisible on every screen, because the shelf
     reads the localStorage thumbnail that has just been deleted, and then
     packaged into their EPUB the first time they export. Not awaited: the
     synchronous half is what the caller is waiting on, and this module stays
     synchronous. See `cover-store.ts`. */
  void clearPrintCovers();

  cachedRaw = null;
  cachedShelf = EMPTY_SHELF;
  pushedBooks = [];
  emitShelf();
  for (const listener of prefsListeners) listener();
}

/** Writes a downloaded library over the local one. */
/**
 * Fields the server has no column for, carried across a download.
 *
 * **A field `sync.ts` does not map is a field the next sync deletes.** The
 * downloaded shelf is written straight over the local one, so anything the
 * server cannot store comes back absent and the local value is gone — and
 * `roadmapDone` is exactly that: no column, no mapping, so a writer ticked
 * "Finish the first draft", saw the road move to three of nineteen, reloaded,
 * and found it back at two. Every hand-ticked step, silently, on every load.
 * Thirteen of the nineteen steps are hand-ticked, so that is most of the
 * roadmap.
 *
 * Merging rather than replacing fixes it for good and for anything added
 * later: a book the server knows keeps the server's answer for every field the
 * server *has* an answer for, and its local-only fields survive.
 *
 * The consequence is stated where a writer can read it — roadmap ticks stay on
 * the machine they were made on, like the tool stores (`ledger`, `arc`,
 * `bible`) that carry the same note on their own screens. Giving it a column
 * is the better answer and is a migration; `TODO.md` carries it.
 */
function keepLocalOnly(local: Shelf, remote: Shelf): Shelf {
  const mine = new Map(local.books.map((b) => [b.id, b]));
  return {
    ...remote,
    books: remote.books.map((book) => {
      const was = mine.get(book.id);
      let kept = book;

      const ticked = was?.roadmapDone;
      if (ticked?.length) kept = { ...kept, roadmapDone: ticked };

      /*
       * **On a shared book, four more fields are local-only — and that follows
       * directly from the `books` row being owner-only for writes.**
       *
       * `archivedAt`, `trashedAt`, `lastOpenedId` and `lastOpenedAt` are
       * per-writer state that happens to live on the shared row. A collaborator
       * cannot push them, so without this they come back as the *owner's* values
       * on every load: a book the co-writer set aside reappears on their shelf,
       * and the chapter they had open is replaced by whichever one the owner was
       * last in. `rowsToBook` already prefers the local values on the way down;
       * this is what keeps them once the merge runs.
       */
      if (book.role) {
        if (was?.archivedAt !== undefined) {
          kept = { ...kept, archivedAt: was.archivedAt };
        }
        if (was?.trashedAt !== undefined) {
          kept = { ...kept, trashedAt: was.trashedAt };
        }
      }

      return kept;
    }),
  };
}

/**
 * A shared book that stopped arriving, kept on the shelf rather than vanishing.
 *
 * **`keepLocalOnly` maps `remote.books`, so anything missing from the download is
 * simply not in the result** — which quietly undid the `access: "lost"` mark
 * `syncWithServer` had just written, and made a revoked book disappear
 * mid-session with no explanation. The co-writer's reading of that is not "my
 * access ended", it is "this app has lost my work".
 *
 * It is safe to keep them: a book only goes missing from a download that
 * *succeeded*, because a failed fetch returns null and `applyRemote` does
 * nothing at all. So absence is a real revocation or deletion, not a network
 * blip — and the prose is still in this browser either way, which is a fact the
 * share dialog states rather than hides.
 */
function keepLost(local: Shelf, merged: Shelf): Shelf {
  const arrived = new Set(merged.books.map((b) => b.id));
  const lost = local.books.filter(
    (b) => b.ownerId && b.access === "lost" && !arrived.has(b.id),
  );
  if (lost.length === 0) return merged;
  return { ...merged, books: [...merged.books, ...lost] };
}

/**
 * The merge above, reachable from a test.
 *
 * `applyRemote` takes a whole downloaded library and needs Supabase to build
 * one; the part worth testing is which fields survive it, which is this.
 */
export function applyRemoteForTest(remote: Shelf): void {
  const local = getShelf();
  const merged = keepLost(local, keepLocalOnly(local, remote));
  window.localStorage.setItem(SHELF_KEY, JSON.stringify(merged));
  cachedRaw = null;
  emitShelf();
}

/**
 * Chapters whose local text is ahead of the server and must not be overwritten.
 *
 * **Without this the conflict guard is a lie.** It promises the writer's text is
 * kept when somebody else has written the same chapter — and then the next
 * `applyRemote` writes the server's body straight over it. So a chapter in here is
 * skipped by the download until the writer has answered.
 *
 * Module-level rather than stored: it is about this session's unsent edit, and a
 * reload has already lost the race it describes.
 */
const conflicted = new Set<string>();

/** Chapters where the local text and the server's have diverged. */
export function conflictedChapters(): readonly string[] {
  return [...conflicted];
}

/** The writer has chosen; let the download win here again. */
export function resolveConflict(chapterId: string) {
  conflicted.delete(chapterId);
  emitShelf();
}

setConflictHandler((chapterId) => {
  conflicted.add(chapterId);
  // The chapter list draws the marker, and it reads the shelf.
  emitShelf();
});

function applyRemote(remote: Awaited<ReturnType<typeof fetchLibrary>>) {
  if (!remote) return;
  try {
    const local = getShelf();
    window.localStorage.setItem(
      SHELF_KEY,
      JSON.stringify(keepLost(local, keepLocalOnly(local, remote.shelf))),
    );
    for (const [id, raw] of remote.bodies) {
      // The one chapter the download may not touch: our copy is the unsent one.
      if (conflicted.has(id)) continue;
      window.localStorage.setItem(bodyKey(id), raw);
    }
    for (const [id, text] of remote.notes) {
      window.localStorage.setItem(notesKey(id), text);
    }
    for (const [id, dataUrl] of remote.covers) {
      window.localStorage.setItem(coverKey(id), dataUrl);
    }
    if (remote.prefs) {
      // The spread is last-writer-wins, which is right for a preference and
      // wrong for a spend — `mergeUsage` puts the two usage counters back after
      // it, merged rather than replaced. See its note.
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          ...DEFAULT_PREFS,
          ...remote.prefs,
          ...mergeUsage(getPrefs(), remote.prefs),
        }),
      );
    }
  } catch (err) {
    // Quota. The library on the server is larger than this browser can hold —
    // possible once a writer has worked on more than one machine. Partial is
    // better than nothing and the shelf was written first, so what landed is
    // coherent; TODO.md tracks giving this a proper warning.
    console.error("[store] could not cache the downloaded library", err);
  }

  // What revision each body was at when it arrived. The guard compares the next
  // save against this; without it the first save of a session cannot tell
  // "nobody has touched this" from "somebody has".
  seedBodyRevs(remote.revs);

  // Seed the diff baseline from what we just wrote, or the next edit would
  // push every book back up as though it were new.
  cachedRaw = null;
  pushedBooks = getShelf().books;

  emitShelf();
  for (const listener of prefsListeners) listener();
}

/** The whole local library, in the shape uploadLibrary wants. */
function collectLocal() {
  const bodies = new Map<string, string>();
  const notes = new Map<string, string>();
  const covers = new Map<string, string>();

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key);
    if (value === null) continue;

    if (key.startsWith(BODY_PREFIX)) bodies.set(key.slice(BODY_PREFIX.length), value);
    else if (key.startsWith(NOTES_PREFIX)) notes.set(key.slice(NOTES_PREFIX.length), value);
    else if (key.startsWith(COVER_PREFIX)) covers.set(key.slice(COVER_PREFIX.length), value);
  }

  return { bodies, notes, covers };
}

/**
 * Whether the first reconcile with the server has finished.
 *
 * **This exists because an empty shelf means a third thing.** `useHydrated`
 * already separates "no books yet" from "storage has not been read yet"; on a
 * machine that has just signed in there is a third state it cannot see —
 * storage *has* been read, it is genuinely empty, and the writer's books are
 * still coming down the wire. The dashboard took that for "no books" and
 * printed "Nothing on the shelf yet" at somebody with thirteen chapters on the
 * server, then replaced it a second later when `applyRemote` landed. The first
 * screen of the session said the work was gone.
 *
 * It is a phase rather than a boolean promise because nothing may await it: the
 * store is read synchronously during render, which is the whole reason
 * `useSyncExternalStore` works here.
 *
 * **The initial value is decided synchronously by whether a server exists at
 * all.** With no Supabase configured nothing is ever downloaded, so it starts
 * settled and a local-only copy behaves exactly as it did before this existed.
 * With one configured it starts pending, because the alternative — starting
 * settled and flipping to pending inside an effect — is a first paint with the
 * empty state on it, which is the bug.
 */
type SyncPhase = "pending" | "settled";

let syncPhase: SyncPhase = isSupabaseConfigured() ? "pending" : "settled";
const syncListeners = new Set<() => void>();

export function getSyncPhase(): SyncPhase {
  return syncPhase;
}

export function subscribeToSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Settled, whatever the outcome.
 *
 * A failed sync settles too, and deliberately: the screen's job is to stop
 * *waiting*, not to claim the download worked. A writer whose connection is
 * down should meet the shelf as this browser knows it rather than a spinner
 * with no end.
 */
function settleSync(): void {
  if (syncPhase === "settled") return;
  syncPhase = "settled";
  for (const listener of syncListeners) listener();
}

/**
 * Reconcile this browser with the server. Safe to call more than once.
 *
 * Three cases, and the order they are tested in is what keeps manuscripts safe:
 *
 *   1. A different writer is signed in from the one whose books are cached
 *      here. Wipe first — their library is not ours to upload.
 *   2. Nothing has ever been uploaded for this writer and this browser holds
 *      books. That is a writer who wrote before they had an account: send it
 *      up, and let the claim record that it has been done.
 *   3. Otherwise the server is the truth and this browser takes a copy.
 *
 * Case 2 is checked before case 3 because getting them the wrong way round
 * downloads an empty library over a real one.
 */
export async function syncWithServer(): Promise<void> {
  try {
    await reconcile();
  } finally {
    // In a `finally` because every path out of `reconcile` has to settle the
    // phase — the early returns for a signed-out reader and a failed upload
    // just as much as a completed download. One that did not would leave the
    // dashboard waiting on a sync that had already given up.
    settleSync();
  }
}

async function reconcile(): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  if (window.localStorage.getItem(OWNER_KEY) !== owner) {
    if (window.localStorage.getItem(OWNER_KEY) !== null) clearLocalLibrary();
    window.localStorage.setItem(OWNER_KEY, owner);
  }

  if (!(await hasClaimed())) {
    const shelf = getShelf();
    /*
     * **Own books only, and this is what stops an invited collaborator's sync
     * breaking permanently on their second load.**
     *
     * A brand-new account invited to somebody's book has never claimed, and an
     * empty shelf — so this branch is skipped, the download runs, and the shared
     * books land locally with the claim still unrecorded. On the *next* load
     * `books.length > 0` is true because those shared books are here, and the
     * upload tries to take them: refused, `uploaded` false, and this function
     * returns without applying anything, every load, forever.
     *
     * Counting only their own books means the branch never fires for a
     * collaborator who has nothing of their own. Their claim simply stays
     * unrecorded, which costs one query a load and nothing else; the moment they
     * write a book of their own it goes up and the claim is recorded with it.
     *
     * `uploadLibrary` is still handed the whole shelf — it applies the same filter
     * itself, because it is reached from the strays path below as well.
     */
    const own = shelf.books.filter((b) => !b.ownerId || b.ownerId === owner);
    if (own.length > 0) {
      const { bodies, notes, covers } = collectLocal();
      const uploaded = await uploadLibrary(shelf, bodies, notes, covers, getPrefs());
      // Claimed and already correct locally — nothing to download.
      if (uploaded) {
        pushedBooks = shelf.books;
        return;
      }
      // Upload failed. Do *not* fall through and overwrite this browser's
      // books with an empty server library; leave them be and try next load.
      return;
    }
  }

  /*
   * Case 3, with the one exception that case 2 does not cover.
   *
   * **A book can be here and never have been on the server**, and the claim
   * flag cannot see it: the flag is per *account*, so a writer who has synced
   * before is "claimed" forever, and the branch above is skipped for them.
   * Then `applyRemote` writes the server's shelf over this browser's and any
   * local-only book is gone.
   *
   * That is not a hypothetical. It is the landing page's own promise failing:
   * a visitor drops a manuscript on the hero check, presses a fix, the book is
   * written here, they sign in to an account they already had — and the book
   * they were promised would come with them is deleted on arrival. It works
   * only for accounts created on the spot, which is the case that gets tested
   * and the smaller half of the traffic.
   *
   * So the strays are found by id and pushed before the download. Comparing
   * ids rather than trusting the flag is the fix: the server's list is the
   * truth about what has been uploaded, and anything here that is missing from
   * it is unsaved work rather than a stale copy.
   *
   * A failed push leaves the book alone and returns, exactly as the upload
   * failure above does. Losing a manuscript to a network error is the one
   * outcome this function exists to prevent.
   */
  const remote = await fetchLibrary(getShelf());
  if (remote) {
    const onServer = new Set(remote.shelf.books.map((b) => b.id));
    /*
     * **A shared book missing from the download is revoked, not stray**, and this
     * clause is the difference between the two. `ownerId` is absent on every book
     * this browser made and set on every book that came down from the server, so
     * `!b.ownerId` is exactly "unsaved work of ours".
     *
     * Without it, ending a collaboration makes the shared book local-but-not-
     * remote, so the next load takes it for a manuscript that never reached the
     * server and uploads it — prose and all — under the ex-collaborator's own
     * account. The upsert then collides with the real owner's row, `books_update`
     * refuses it, `uploadLibrary` returns false, and this function returns before
     * applying anything: the theft fails by accident and the writer's sync is
     * broken from then on. Both halves of that are wrong.
     */
    const strays = getShelf().books.filter(
      (b) => !onServer.has(b.id) && !b.ownerId,
    );

    /*
     * A book that *did* come from the server and has stopped arriving is marked
     * rather than deleted. It stays on the shelf, read-only, because a fetch that
     * failed halfway is indistinguishable from a revocation and deleting somebody
     * out of a manuscript they were reading is not a guess worth making.
     */
    const lost = getShelf().books.filter(
      (b) => !onServer.has(b.id) && b.ownerId && b.access !== "lost",
    );
    for (const book of lost) {
      commitBook(book.id, (b) => ({ ...b, access: "lost" }));
    }

    if (strays.length > 0) {
      const { bodies, notes, covers } = collectLocal();
      const kept: Book[] = [];
      for (const book of strays) {
        const only: Shelf = { books: [book], lastOpenedBookId: null };
        // Prefs stay null: see `uploadLibrary`. A rescue must not carry this
        // browser's settings into an account that already has its own.
        if (await uploadLibrary(only, bodies, notes, covers, null)) {
          kept.push(book);
        }
      }
      if (kept.length !== strays.length) return; // Something did not land; keep it here.

      // Put them back on the shelf the server just handed us, so the download
      // below does not undo the upload that has only just happened.
      remote.shelf = {
        ...remote.shelf,
        books: [...kept, ...remote.shelf.books],
      };
    }
  }

  applyRemote(remote);
  repairMissingBodies(remote);
}

/**
 * Send up any prose the server turns out not to have.
 *
 * **The strays path above only asks whether the *book* arrived**, and a book
 * can be on the server complete with every chapter row and still be missing
 * the writing in them. Nothing used to notice: `pushBody` fired once when the
 * chapter was saved, and if that push was refused — for arriving before its
 * chapter existed, or because the connection dropped — the old `flush` logged
 * it and threw the job away. No later load compared what was here against what
 * was there, so the gap was permanent and silent.
 *
 * It is not hypothetical. It was found on a real library: 23 books and 298
 * chapters on the server, 30 of their bodies, and a manuscript that opened
 * empty on a second machine while the shelf still reported its word count.
 *
 * So the comparison is made every load, and it is cheap: the download already
 * carries every body this account owns, and a chapter whose id is absent from
 * it while its text sits in this browser is unsaved work by definition.
 *
 * Three things about it are deliberate:
 *
 * - **The book goes with the bodies.** `pushBook` upserts the chapter rows, and
 *   a body cannot land without one; the queue runs `book:` before `body:` so
 *   the pair arrives in the order the foreign keys need.
 * - **A book this writer may not write is skipped.** A viewer's browser holding
 *   a body the owner has since replaced would otherwise push a stale copy back
 *   over the owner's, in a repair pass they never asked for.
 * - **It settles itself.** Once a body lands, the next download carries it and
 *   this finds nothing, so a repaired library costs one `has` per chapter.
 */
function repairMissingBodies(
  remote: Awaited<ReturnType<typeof fetchLibrary>>,
): void {
  if (!remote) return;

  const onServer = new Set(remote.shelf.books.map((b) => b.id));
  const books = getShelf().books;

  books.forEach((book, position) => {
    if (!onServer.has(book.id) || !canWriteBook(book)) return;

    const missing = book.chapters.filter(
      (c) => !remote.bodies.has(c.id) && getBody(c.id) !== null,
    );
    if (missing.length === 0) return;

    console.warn(
      `[sync] ${missing.length} chapter${missing.length === 1 ? "" : "s"} of "${
        book.title
      }" had text here and none on the server; sending it up.`,
    );

    pushBook(book, position, new Set(missing.map((c) => c.id)));
    for (const chapter of missing) {
      const raw = getBody(chapter.id);
      if (raw !== null) pushBody(chapter.id, raw);
    }
  });
}
