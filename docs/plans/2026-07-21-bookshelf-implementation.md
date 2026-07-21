# Bookshelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let OpenChapter hold more than one book — a shelf at `/`, chapters scoped to a book, and the existing single book migrated onto the shelf without losing a word.

**Architecture:** One metadata document in localStorage (`openchapter:shelf`) holding every book with its chapter list nested inside; chapter bodies stay at their own keys and are never rewritten. Routing moves to `/book/[bookId]/chapter/[chapterId]`, and the chapter sidebar moves out of the root layout into a book-scoped layout so the shelf renders full-width. Design rationale lives in `docs/plans/2026-07-21-bookshelf-design.md`.

**Tech Stack:** Next.js 16.2.10 (App Router, Turbopack), React 19, Tailwind CSS v4, Tiptap 3, Vitest + jsdom.

**Plan location note:** this skill defaults to `docs/superpowers/plans/`, but this project already keeps plans in `docs/plans/` — the design doc was committed there in `e583e03`. Staying consistent.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/lib/library-store.ts` | The only module that touches localStorage. Shelf reads/writes, book and chapter mutations, migration. Replaces `chapter-store.ts`. |
| `src/lib/library-store.test.ts` | Store logic under test. |
| `src/lib/use-library.ts` | React bindings — `useShelf`, `useChapterBody`, `useHydrated`. Replaces `use-chapters.ts`. |
| `src/components/shelf/bookshelf.tsx` | The shelf: book list, create, delete, continue-writing. |
| `src/app/book/[bookId]/layout.tsx` | Book-scoped shell — sidebar plus scrolling manuscript column. |
| `src/app/book/[bookId]/page.tsx` | Redirects into the book's last-opened chapter. |
| `src/app/book/[bookId]/chapter/[chapterId]/page.tsx` | The editor route. |
| `vitest.config.mts` | Test config. |

**Modified**

| File | Change |
| --- | --- |
| `src/app/layout.tsx` | Drop the sidebar; return to being only the shell. |
| `src/app/page.tsx` | Becomes the shelf page. |
| `src/components/sidebar/chapter-sidebar.tsx` | Takes `bookId`, gains an "All books" back-link. |
| `src/components/editor/chapter-editor.tsx` | Takes `bookId` alongside `chapterId`. |
| `package.json` | Test script and dev dependencies. |

**Deleted**

- `src/lib/chapter-store.ts` (superseded by `library-store.ts`)
- `src/lib/use-chapters.ts` (superseded by `use-library.ts`)
- `src/app/chapter/[id]/page.tsx` (superseded by the book-scoped route)

---

## Task 1: Test runner

The project has no test framework — earlier store checks were a throwaway script in a scratchpad. Vitest is what the bundled Next docs recommend (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`), and jsdom supplies a real `localStorage` rather than a hand-rolled fake.

Only three packages: no `@testing-library/react` or `@vitejs/plugin-react` yet, since this phase tests no components. Add them when a component test actually exists.

**Files:**
- Create: `vitest.config.mts`
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install -D vitest jsdom vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // tsconfigPaths teaches Vitest the "@/..." alias from tsconfig.json.
  plugins: [tsconfigPaths()],
  test: {
    // jsdom for localStorage, not for a DOM — these are unit tests.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner starts**

Run: `npx vitest run`
Expected: exits 0 with "No test files found" — the runner works, there is nothing to run yet.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.mts
git commit -m "Add Vitest so the store can be tested properly"
```

---

## Task 2: Shelf types and cached reads

Establishes the data shape and the read path. The snapshot cache is the load-bearing part: `useSyncExternalStore` compares by identity and re-renders forever if the getter returns a fresh object each call.

**Files:**
- Create: `src/lib/library-store.ts`
- Create: `src/lib/library-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/library-store.test.ts`:

```ts
import { beforeEach, expect, it } from "vitest";
import {
  createBook,
  findBook,
  getShelf,
  bookWordCount,
  type Book,
} from "@/lib/library-store";

beforeEach(() => {
  localStorage.clear();
});

it("starts with an empty shelf", () => {
  expect(getShelf().books).toEqual([]);
  expect(getShelf().lastOpenedBookId).toBeNull();
});

it("returns an identical reference on repeat reads", () => {
  // useSyncExternalStore compares snapshots by identity; a fresh object each
  // call is an infinite render loop.
  expect(getShelf()).toBe(getShelf());
});

it("returns a new reference after a write", () => {
  const before = getShelf();
  createBook("The Salt Road");
  expect(getShelf()).not.toBe(before);
});

it("degrades to an empty shelf when storage is corrupt", () => {
  localStorage.setItem("openchapter:shelf", "{ not json");
  expect(getShelf().books).toEqual([]);
});

it("finds a book by id and reports null for an unknown one", () => {
  const { bookId } = createBook("The Salt Road");
  expect(findBook(getShelf(), bookId)?.title).toBe("The Salt Road");
  expect(findBook(getShelf(), "nope")).toBeNull();
});

it("sums word counts across a book's chapters", () => {
  const book: Book = {
    id: "b",
    title: "T",
    chapters: [
      { id: "1", title: "One", words: 1200 },
      { id: "2", title: "Two", words: 812 },
    ],
    lastOpenedId: null,
    lastOpenedAt: 0,
  };
  expect(bookWordCount(book)).toBe(2012);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: FAIL — cannot resolve `@/lib/library-store`.

- [ ] **Step 3: Create `src/lib/library-store.ts`**

```ts
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

export interface ChapterMeta {
  id: string;
  title: string;
  words: number;
}

export interface Book {
  id: string;
  title: string;
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

/** Pure lookup. The result is a reference into the cached shelf, so it is
 *  stable for as long as the shelf is. */
export function findBook(shelf: Shelf, bookId: string): Book | null {
  return shelf.books.find((b) => b.id === bookId) ?? null;
}

export function bookWordCount(book: Book): number {
  return book.chapters.reduce((total, c) => total + c.words, 0);
}
```

Then append the commit function and `createBook`, needed by the tests:

```ts
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
export function createBook(title?: string): { bookId: string; chapterId: string } {
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
```

And the subscription block (listeners are needed by `commit`; the React binding uses them in Task 6):

```ts
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

export function getBody(id: string): string | null {
  return readRaw(bodyKey(id));
}

export function getServerBody(): string | null {
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library-store.ts src/lib/library-store.test.ts
git commit -m "Add the shelf document and its cached read path"
```

---

## Task 3: Book mutations

**Files:**
- Modify: `src/lib/library-store.ts`
- Modify: `src/lib/library-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/library-store.test.ts`, and extend the import at the top to include `deleteBook`, `renameBook`, `touchLastOpenedBook`:

```ts
it("renames a book without disturbing its chapters", () => {
  const { bookId, chapterId } = createBook("Untitled Book");
  renameBook(bookId, "The Salt Road");

  const book = findBook(getShelf(), bookId)!;
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.id)).toEqual([chapterId]);
});

it("gives a new book an opening chapter", () => {
  const { bookId, chapterId } = createBook();
  const book = findBook(getShelf(), bookId)!;
  expect(book.chapters).toHaveLength(1);
  expect(book.lastOpenedId).toBe(chapterId);
});

it("deletes a book and every body it owns", () => {
  const { bookId, chapterId } = createBook("Doomed");
  // Written directly rather than through saveBody, which does not exist until
  // Task 4 — this task should stand on its own.
  localStorage.setItem(`openchapter:chapter:${chapterId}`, '{"type":"doc"}');

  deleteBook(bookId);

  expect(findBook(getShelf(), bookId)).toBeNull();
  // The bodies are the whole point: an orphan here is unreachable bytes that
  // never get collected.
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).toBeNull();
});

it("moves lastOpenedBookId off a deleted book", () => {
  const keep = createBook("Keep");
  const doomed = createBook("Doomed");
  touchLastOpenedBook(doomed.bookId);

  deleteBook(doomed.bookId);

  expect(getShelf().lastOpenedBookId).toBe(keep.bookId);
});

it("clears lastOpenedBookId when the last book goes", () => {
  const { bookId } = createBook("Only");
  deleteBook(bookId);
  expect(getShelf().lastOpenedBookId).toBeNull();
});

it("records when a book was last opened, for shelf ordering", () => {
  const { bookId } = createBook("The Salt Road");
  const before = findBook(getShelf(), bookId)!.lastOpenedAt;

  vi.setSystemTime(new Date(before + 60_000));
  touchLastOpenedBook(bookId);

  expect(findBook(getShelf(), bookId)!.lastOpenedAt).toBe(before + 60_000);
  vi.useRealTimers();
});
```

Add `vi` to the vitest import: `import { beforeEach, expect, it, vi } from "vitest";`

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: FAIL — `renameBook` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/library-store.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library-store.ts src/lib/library-store.test.ts
git commit -m "Add book create, rename and delete"
```

---

## Task 4: Chapter mutations, scoped to a book

Every chapter operation now takes a `bookId`. This is the bulk of the port from `chapter-store.ts`.

**Files:**
- Modify: `src/lib/library-store.ts`
- Modify: `src/lib/library-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append, extending the import with `createChapter`, `renameChapter`, `deleteChapter`, `moveChapter`, `touchLastOpened`, `ensureChapter`:

```ts
const titlesOf = (bookId: string) =>
  findBook(getShelf(), bookId)!.chapters.map((c) => c.title);

it("appends chapters in order", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  createChapter(bookId, "Chapter Three");
  expect(titlesOf(bookId)).toEqual(["Chapter One", "Chapter Two", "Chapter Three"]);
});

it("numbers an unnamed chapter by its position", () => {
  const { bookId } = createBook();
  createChapter(bookId);
  expect(titlesOf(bookId)).toEqual(["Chapter One", "Chapter 2"]);
});

it("renames a chapter", () => {
  const { bookId, chapterId } = createBook();
  renameChapter(bookId, chapterId, "The Salt Flats");
  expect(titlesOf(bookId)).toEqual(["The Salt Flats"]);
});

it("reorders chapters in both directions", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  createChapter(bookId, "Chapter Three");

  moveChapter(bookId, 2, 0);
  expect(titlesOf(bookId)).toEqual(["Chapter Three", "Chapter One", "Chapter Two"]);

  moveChapter(bookId, 0, 2);
  expect(titlesOf(bookId)).toEqual(["Chapter One", "Chapter Two", "Chapter Three"]);
});

it("ignores out-of-range and no-op moves", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  const before = titlesOf(bookId);

  moveChapter(bookId, 0, -1);
  moveChapter(bookId, 0, 99);
  moveChapter(bookId, 1, 1);

  expect(titlesOf(bookId)).toEqual(before);
});

it("writes the body and denormalises the word count", () => {
  const { bookId, chapterId } = createBook();
  saveBody(bookId, chapterId, { type: "doc" }, 1204);

  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).not.toBeNull();
  expect(findBook(getShelf(), bookId)!.chapters[0].words).toBe(1204);
});

it("deletes a chapter, its body, and fixes lastOpenedId", () => {
  const { bookId, chapterId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  saveBody(bookId, second, { type: "doc" }, 5);
  touchLastOpened(bookId, second);

  deleteChapter(bookId, second);

  expect(titlesOf(bookId)).toEqual(["Chapter One"]);
  expect(localStorage.getItem(`openchapter:chapter:${second}`)).toBeNull();
  expect(findBook(getShelf(), bookId)!.lastOpenedId).toBe(chapterId);
});

it("keeps chapter ids unique across books", () => {
  const a = createBook("A");
  const b = createBook("B");
  expect(a.chapterId).not.toBe(b.chapterId);
});

it("does not touch another book's chapters", () => {
  const a = createBook("A");
  const b = createBook("B");
  createChapter(a.bookId, "Only in A");

  expect(titlesOf(a.bookId)).toHaveLength(2);
  expect(titlesOf(b.bookId)).toHaveLength(1);
});

it("ensureChapter opens the last-opened chapter", () => {
  const { bookId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  touchLastOpened(bookId, second);
  expect(ensureChapter(bookId)).toBe(second);
});

it("ensureChapter falls back to the first chapter when the memory is stale", () => {
  const { bookId, chapterId } = createBook();
  const second = createChapter(bookId, "Chapter Two");
  touchLastOpened(bookId, second);
  deleteChapter(bookId, second);
  expect(ensureChapter(bookId)).toBe(chapterId);
});

it("ensureChapter creates a chapter for an empty book", () => {
  const { bookId, chapterId } = createBook();
  deleteChapter(bookId, chapterId);
  expect(findBook(getShelf(), bookId)!.chapters).toHaveLength(0);

  const created = ensureChapter(bookId);
  expect(created).not.toBeNull();
  expect(findBook(getShelf(), bookId)!.chapters).toHaveLength(1);
});

it("ensureChapter reports null for an unknown book", () => {
  expect(ensureChapter("nope")).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: FAIL — `createChapter` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/library-store.ts`:

```ts
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

export function renameChapter(bookId: string, chapterId: string, title: string) {
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
    chapters: b.chapters.map((c) =>
      c.id === chapterId ? { ...c, words } : c,
    ),
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: PASS, 25 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/library-store.ts src/lib/library-store.test.ts
git commit -m "Scope chapter operations to a book"
```

---

## Task 5: Migration

Two shapes can be sitting in storage: the previous phase's single-book manifest (`openchapter:manifest`), and — for anyone who never loaded that phase — the original spike key (`openchapter:spike:chapter-1`). Both become the first book on the shelf.

Chapter ids are already UUIDs, so bodies keep their keys and are never rewritten.

**Files:**
- Modify: `src/lib/library-store.ts`
- Modify: `src/lib/library-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append, extending the import with `migrateLegacy`:

```ts
it("migrates a single-book manifest onto the shelf", () => {
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({
      bookTitle: "The Salt Road",
      chapters: [
        { id: "c1", title: "Chapter One", words: 1204 },
        { id: "c2", title: "Chapter Two", words: 847 },
      ],
      lastOpenedId: "c2",
    }),
  );
  localStorage.setItem("openchapter:chapter:c1", '{"type":"doc"}');

  migrateLegacy();

  const [book] = getShelf().books;
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.id)).toEqual(["c1", "c2"]);
  expect(book.lastOpenedId).toBe("c2");
  expect(bookWordCount(book)).toBe(2051);
  // Bodies keep their keys — the ids are already unique.
  expect(localStorage.getItem("openchapter:chapter:c1")).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:manifest")).toBeNull();
});

it("migrates the original spike chapter", () => {
  localStorage.setItem("openchapter:spike:chapter-1", '{"type":"doc"}');

  migrateLegacy();

  const [book] = getShelf().books;
  expect(book.chapters).toHaveLength(1);
  const body = localStorage.getItem(`openchapter:chapter:${book.chapters[0].id}`);
  expect(body).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:spike:chapter-1")).toBeNull();
});

it("is idempotent — React runs effects twice in development", () => {
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({ bookTitle: "Once", chapters: [], lastOpenedId: null }),
  );

  migrateLegacy();
  migrateLegacy();

  expect(getShelf().books).toHaveLength(1);
});

it("does nothing when there is nothing to migrate", () => {
  migrateLegacy();
  expect(getShelf().books).toEqual([]);
});

it("leaves existing books alone", () => {
  const { bookId } = createBook("Already Here");
  localStorage.setItem(
    "openchapter:manifest",
    JSON.stringify({ bookTitle: "Old", chapters: [], lastOpenedId: null }),
  );

  migrateLegacy();

  expect(getShelf().books).toHaveLength(2);
  expect(findBook(getShelf(), bookId)?.title).toBe("Already Here");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: FAIL — `migrateLegacy` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/library-store.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/library-store.test.ts`
Expected: PASS, 30 tests.

- [ ] **Step 5: Delete the superseded store**

```bash
git rm src/lib/chapter-store.ts
```

This breaks `use-chapters.ts` and the components until Task 6–9 land. That is expected; the typecheck runs in Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/lib/library-store.ts src/lib/library-store.test.ts
git commit -m "Migrate the single-book manifest onto the shelf"
```

---

## Task 6: React bindings

**Files:**
- Create: `src/lib/use-library.ts`
- Delete: `src/lib/use-chapters.ts`

- [ ] **Step 1: Create `src/lib/use-library.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getBody,
  getServerBody,
  getServerShelf,
  getShelf,
  subscribeToBody,
  subscribeToShelf,
  type Shelf,
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

const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during SSR and the first render, true afterwards.
 *
 * Needed because an empty shelf means two different things: "no books yet" and
 * "storage hasn't been read yet". Without telling them apart, every valid page
 * would flash an empty or not-found screen on load.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
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
```

- [ ] **Step 2: Remove the superseded bindings**

```bash
git rm src/lib/use-chapters.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-library.ts
git commit -m "Point the React bindings at the shelf"
```

---

## Task 7: Routes

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/book/[bookId]/layout.tsx`
- Create: `src/app/book/[bookId]/page.tsx`
- Create: `src/app/book/[bookId]/chapter/[chapterId]/page.tsx`
- Delete: `src/app/chapter/[id]/page.tsx`

- [ ] **Step 1: Strip the sidebar from the root layout**

In `src/app/layout.tsx`, remove the `ChapterSidebar` import and replace the `<body>` element with:

```tsx
      <body className="h-full overflow-hidden bg-cream text-ink">
        {children}
      </body>
```

The sidebar moves down to the book layout so the shelf can render full-width.

- [ ] **Step 2: Create `src/app/book/[bookId]/layout.tsx`**

```tsx
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";

export default async function BookLayout(props: LayoutProps<"/book/[bookId]">) {
  const { bookId } = await props.params;

  return (
    // The shell never scrolls: the sidebar stays put and the manuscript column
    // scrolls inside it, which is what keeps the chapter list reachable from
    // the bottom of a long chapter.
    <div className="flex h-full">
      <ChapterSidebar bookId={bookId} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {props.children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/book/[bookId]/page.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureChapter, touchLastOpenedBook } from "@/lib/library-store";
import { useHydrated } from "@/lib/use-library";

/**
 * A book has no page of its own — it sends the writer to the chapter they had
 * open. Client-side, because the answer lives in localStorage and the server
 * cannot see it.
 */
export default function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const sent = useRef(false);

  useEffect(() => {
    if (!hydrated || sent.current) return;

    let cancelled = false;
    void params.then(({ bookId }) => {
      if (cancelled || sent.current) return;
      sent.current = true;

      const chapterId = ensureChapter(bookId);
      if (!chapterId) {
        router.replace("/");
        return;
      }
      touchLastOpenedBook(bookId);
      router.replace(`/book/${bookId}/chapter/${chapterId}`);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, params, router]);

  return null;
}
```

- [ ] **Step 4: Create `src/app/book/[bookId]/chapter/[chapterId]/page.tsx`**

```tsx
import { ChapterEditor } from "@/components/editor/chapter-editor";

export default async function ChapterPage(
  props: PageProps<"/book/[bookId]/chapter/[chapterId]">,
) {
  // params is a Promise in Next 16 and has to be awaited, even though the
  // chapter itself is read on the client — the route only supplies the ids.
  const { bookId, chapterId } = await props.params;
  return <ChapterEditor bookId={bookId} chapterId={chapterId} />;
}
```

- [ ] **Step 5: Remove the old route**

```bash
git rm -r "src/app/chapter"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/book
git commit -m "Scope the editor routes to a book"
```

---

## Task 8: Sidebar

**Files:**
- Modify: `src/components/sidebar/chapter-sidebar.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the whole file with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createChapter,
  deleteChapter,
  findBook,
  moveChapter,
  renameBook,
} from "@/lib/library-store";
import { useShelf } from "@/lib/use-library";

export function ChapterSidebar({ bookId }: { bookId: string }) {
  const shelf = useShelf();
  const book = findBook(shelf, bookId);
  const router = useRouter();
  const pathname = usePathname();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // The route is the source of truth for which chapter is open, so the sidebar
  // needs no state of its own to stay in sync with the editor.
  const prefix = `/book/${bookId}/chapter/`;
  const activeId = pathname.startsWith(prefix)
    ? decodeURIComponent(pathname.slice(prefix.length))
    : null;

  const chapters = book?.chapters ?? [];

  const handleCreate = () => {
    router.push(`/book/${bookId}/chapter/${createChapter(bookId)}`);
  };

  const handleDelete = (id: string, title: string) => {
    // A chapter is somebody's prose. Cheap dialog, but never silently.
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;

    const remaining = chapters.filter((c) => c.id !== id);
    deleteChapter(bookId, id);

    // Only navigate if the writer just deleted the chapter they were reading.
    if (id === activeId) {
      router.replace(
        remaining.length
          ? `/book/${bookId}/chapter/${remaining[0].id}`
          : `/book/${bookId}`,
      );
    }
  };

  const handleDrop = (to: number) => {
    if (dragIndex !== null) moveChapter(bookId, dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <aside
      className="flex w-(--sidebar-width) shrink-0 flex-col border-r
                 border-ink/10 bg-ink/[0.025]"
      aria-label="Chapters"
    >
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          className="rounded-sm font-sans text-xs text-warmgray outline-none
                     hover:text-burgundy focus-visible:ring-2
                     focus-visible:ring-gold/60"
        >
          ← All books
        </Link>
        <input
          value={book?.title ?? ""}
          onChange={(e) => renameBook(bookId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) renameBook(bookId, "Untitled Book");
          }}
          aria-label="Book title"
          spellCheck={false}
          className="mt-2 w-full truncate rounded-sm bg-transparent font-serif
                     text-base text-ink outline-none focus-visible:ring-2
                     focus-visible:ring-gold/60"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ol>
          {chapters.map((chapter, index) => {
            const isActive = chapter.id === activeId;

            return (
              <li
                key={chapter.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  // Without preventDefault the browser refuses the drop.
                  e.preventDefault();
                  setOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                className={`group relative rounded-sm ${
                  overIndex === index && dragIndex !== index
                    ? "before:absolute before:inset-x-2 before:-top-px before:h-px before:bg-gold"
                    : ""
                } ${dragIndex === index ? "opacity-40" : ""}`}
              >
                <Link
                  href={`/book/${bookId}/chapter/${chapter.id}`}
                  aria-current={isActive ? "page" : undefined}
                  // Native drag-and-drop is mouse-only, so reordering also
                  // needs a keyboard path or it is unreachable for some writers.
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveChapter(bookId, index, index - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveChapter(bookId, index, index + 1);
                    }
                  }}
                  className={`flex items-baseline gap-2 rounded-sm py-2 pr-8 pl-3
                              font-sans text-sm outline-none
                              focus-visible:ring-2 focus-visible:ring-gold/60 ${
                                isActive
                                  ? "bg-burgundy/8 text-burgundy"
                                  : "text-warmgray hover:text-ink"
                              }`}
                >
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-60">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{chapter.title}</span>
                  {chapter.words > 0 && (
                    <span className="shrink-0 text-xs tabular-nums opacity-50">
                      {chapter.words.toLocaleString()}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => handleDelete(chapter.id, chapter.title)}
                  aria-label={`Delete ${chapter.title}`}
                  className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm px-1.5
                             py-0.5 font-sans text-sm leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="px-2 pb-4">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full rounded-sm py-2 pl-3 text-left font-sans text-sm
                     text-warmgray outline-none hover:text-burgundy
                     focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          + New chapter
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/chapter-sidebar.tsx
git commit -m "Scope the sidebar to a book and link back to the shelf"
```

---

## Task 9: Editor

Only the store calls and the props change; the Tiptap surface, autosave wiring and status bar are untouched.

**Files:**
- Modify: `src/components/editor/chapter-editor.tsx`

- [ ] **Step 1: Update the imports**

Replace the two store imports with:

```tsx
import { findBook, renameChapter, saveBody, touchLastOpened } from "@/lib/library-store";
import { useChapterBody, useHydrated, useShelf } from "@/lib/use-library";
```

- [ ] **Step 2: Update the top-level component**

Replace `export function ChapterEditor(...)` through the end of its body with:

```tsx
export function ChapterEditor({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const raw = useChapterBody(chapterId);

  const book = findBook(shelf, bookId);
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null;

  // Remembering the open chapter is what lets a book's route land the writer
  // back where they left off, so it is worth a write on every visit.
  useEffect(() => {
    if (hydrated) touchLastOpened(bookId, chapterId);
  }, [hydrated, bookId, chapterId]);

  const initialContent = useMemo<JSONContent | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JSONContent;
    } catch {
      return null;
    }
  }, [raw]);

  // Nothing to render until storage has been read — see useHydrated.
  if (!hydrated) return null;
  if (!book || !chapter) return <MissingChapter />;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ChapterHeader
        bookTitle={book.title}
        title={chapter.title}
        bookId={bookId}
        chapterId={chapterId}
      />
      {/* Keyed on the stored text as well as the id, so a save from another tab
          reloads the surface rather than leaving this one silently stale. */}
      <EditorSurface
        key={`${chapterId}:${raw ?? ""}`}
        bookId={bookId}
        chapterId={chapterId}
        initialContent={initialContent}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update `ChapterHeader`**

```tsx
function ChapterHeader({
  bookTitle,
  title,
  bookId,
  chapterId,
}: {
  bookTitle: string;
  title: string;
  bookId: string;
  chapterId: string;
}) {
  return (
    <header className="pt-16 pb-10">
      <div className="mx-auto w-full max-w-(--measure-manuscript) px-6">
        <p className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
          {bookTitle}
        </p>
        {/* An input rather than a heading with contenteditable: the title is a
            single line of plain text, and a plain input gets the caret, undo
            and screen-reader behaviour right for free. */}
        <input
          value={title}
          onChange={(e) => renameChapter(bookId, chapterId, e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              renameChapter(bookId, chapterId, "Untitled chapter");
            }
          }}
          aria-label="Chapter title"
          spellCheck={false}
          className="mt-2 w-full rounded-sm bg-transparent font-serif text-3xl
                     text-ink outline-none focus-visible:ring-2
                     focus-visible:ring-gold/60"
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update `EditorSurface`'s signature and save call**

```tsx
function EditorSurface({
  bookId,
  chapterId,
  initialContent,
}: {
  bookId: string;
  chapterId: string;
  initialContent: JSONContent | null;
}) {
  const [words, setWords] = useState(0);

  const { schedule, status, lastSavedAt } = useAutosave<ChapterSnapshot>({
    save: ({ doc, words }) => saveBody(bookId, chapterId, doc, words),
  });
```

The rest of the function is unchanged.

- [ ] **Step 5: Point the not-found link at the shelf**

In `MissingChapter`, the `<Link href="/">` label becomes:

```tsx
          Back to your books
```

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/chapter-editor.tsx
git commit -m "Scope the editor to a book"
```

---

## Task 10: The shelf

**Files:**
- Create: `src/components/shelf/bookshelf.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/shelf/bookshelf.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bookWordCount,
  createBook,
  deleteBook,
  migrateLegacy,
  type Book,
} from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";

export function Bookshelf() {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const router = useRouter();

  // migrateLegacy is idempotent, but running it twice is still wasted work and
  // React runs effects twice in development.
  const migrated = useRef(false);
  useEffect(() => {
    if (!hydrated || migrated.current) return;
    migrated.current = true;
    migrateLegacy();
  }, [hydrated]);

  // Most recently opened first — the book you were writing yesterday is the
  // one you want today.
  const books = useMemo(
    () => [...shelf.books].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [shelf.books],
  );

  const handleCreate = () => {
    const { bookId, chapterId } = createBook();
    router.push(`/book/${bookId}/chapter/${chapterId}`);
  };

  const handleDelete = (book: Book) => {
    const words = bookWordCount(book);
    // The most destructive action in the app: this takes every chapter with it.
    const warning =
      words > 0
        ? `Delete “${book.title}” and all ${words.toLocaleString()} words in it? This cannot be undone.`
        : `Delete “${book.title}”? This cannot be undone.`;
    if (window.confirm(warning)) deleteBook(book.id);
  };

  if (!hydrated) return null;

  return (
    <main className="h-full overflow-y-auto px-6 py-20">
      <div className="mx-auto w-full max-w-(--measure-manuscript)">
        <h1 className="font-serif text-3xl text-ink">Your books</h1>

        {books.length === 0 ? (
          <p className="mt-6 font-sans text-sm text-warmgray">
            Nothing on the shelf yet.
          </p>
        ) : (
          <ol className="mt-10">
            {books.map((book, index) => (
              <li key={book.id} className="group relative">
                <Link
                  href={`/book/${book.id}`}
                  className="flex items-baseline gap-4 rounded-sm border-b
                             border-ink/8 py-4 pr-10 outline-none
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  <span className="flex-1 truncate font-serif text-lg text-ink
                                   group-hover:text-burgundy">
                    {book.title}
                  </span>
                  <span className="shrink-0 font-sans text-xs tabular-nums text-warmgray">
                    {book.chapters.length}{" "}
                    {book.chapters.length === 1 ? "chapter" : "chapters"}
                    {" · "}
                    {bookWordCount(book).toLocaleString()} words
                  </span>
                </Link>

                {index === 0 && (
                  <span className="pointer-events-none absolute -top-5 left-0
                                   font-sans text-xs tracking-[0.18em]
                                   text-gold uppercase">
                    Continue writing
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(book)}
                  aria-label={`Delete ${book.title}`}
                  className="absolute top-4 right-0 rounded-sm px-1.5 py-0.5
                             font-sans text-sm leading-none text-warmgray
                             opacity-0 outline-none transition-opacity
                             group-hover:opacity-60 hover:!opacity-100
                             hover:text-burgundy focus-visible:opacity-100
                             focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={handleCreate}
          className="mt-8 rounded-sm font-sans text-sm text-warmgray outline-none
                     hover:text-burgundy focus-visible:ring-2
                     focus-visible:ring-gold/60"
        >
          + New book
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { Bookshelf } from "@/components/shelf/bookshelf";

export default function Home() {
  return <Bookshelf />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shelf/bookshelf.tsx src/app/page.tsx
git commit -m "Add the shelf"
```

---

## Task 11: Verify the whole thing

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS, 30 tests.

- [ ] **Step 2: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no output, exit 0. `next typegen` must run first — `PageProps` and `LayoutProps` for the new routes are generated, and the old `/chapter/[id]` types have to go.

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: no output.

- [ ] **Step 4: Build**

Run: `npx next build`
Expected: success, with `/`, `/book/[bookId]`, and `/book/[bookId]/chapter/[chapterId]` in the route table and no `/chapter/[id]`.

- [ ] **Step 5: Check the routes respond**

With a dev server running (`npm run dev`, or reuse one already on :3000):

```bash
for p in "/" "/book/abc" "/book/abc/chapter/def"; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$p")"
done
```

Expected: `200` for all three. Unknown ids render the not-found screen client-side, not an HTTP error.

- [ ] **Step 6: Confirm Tailwind emitted the utilities**

Tailwind drops utilities it cannot parse rather than failing, so a typo in a class name is silent. Fetch the stylesheet and confirm the custom ones survived:

```bash
CSS_URL=$(curl -s http://localhost:3000/ | grep -o '/_next/static/[^"]*\.css' | head -1)
CSS=$(curl -s "http://localhost:3000$CSS_URL")
for u in "sidebar-width" "measure-manuscript" "bg-burgundy" "text-gold" "border-ink"; do
  printf "%-20s %s\n" "$u" "$(printf '%s' "$CSS" | grep -c "$u")"
done
```

Expected: every count ≥ 1.

- [ ] **Step 7: Manual check — the part no test covers**

The DOM behaviour has no automated coverage. In a browser:

1. Load `/` — the existing book appears on the shelf with its chapters and word counts intact (the migration).
2. Reload `/` — still one book, not two (idempotence).
3. Click it — lands in the last chapter you had open.
4. Type — the status bar goes "Unsaved changes" → "Saving…" → "Saved".
5. Drag a chapter in the sidebar; then focus one and press Alt+↑.
6. "← All books" returns to the shelf; the book is now top with "Continue writing".
7. Create a second book; confirm it opens on its own Chapter One and the two books' chapters stay separate.
8. Delete the second book and confirm the dialog names it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Verify the bookshelf phase end to end"
```

---

## Self-review notes

- **Spec coverage.** Storage layout → Task 2–4. Routing → Task 7. Shelf, ordering, continue-writing, create-with-first-chapter → Task 10. Migration incl. spike → Task 5. Book deletion cascade → Task 3. Hydration gate and corrupt-shelf fallback → Tasks 2 and 6. Testing list → Tasks 2–5. Covered.
- **`lastOpenedAt` was not in the design doc.** The design says the shelf orders most-recently-opened first, which one `lastOpenedBookId` cannot express; the field is the minimum needed to honour that line.
- **Naming consistency.** `findBook`/`bookWordCount`/`ensureChapter`/`migrateLegacy` are used identically in every task that references them. Chapter mutations all take `bookId` first.
- **Deliberately excluded.** Renaming a book from the shelf (it is renamable in the sidebar), reordering books, book-level metadata such as author or genre, and any Supabase work.
