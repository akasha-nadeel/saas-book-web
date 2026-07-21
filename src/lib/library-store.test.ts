import { beforeEach, expect, it, vi } from "vitest";
import {
  bookWordCount,
  createBook,
  createChapter,
  deleteBook,
  deleteChapter,
  ensureChapter,
  findBook,
  getShelf,
  migrateLegacy,
  moveChapter,
  renameBook,
  renameChapter,
  saveBody,
  touchLastOpened,
  touchLastOpenedBook,
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
  // the next task — this one should stand on its own.
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

const titlesOf = (bookId: string) =>
  findBook(getShelf(), bookId)!.chapters.map((c) => c.title);

it("appends chapters in order", () => {
  const { bookId } = createBook();
  createChapter(bookId, "Chapter Two");
  createChapter(bookId, "Chapter Three");
  expect(titlesOf(bookId)).toEqual([
    "Chapter One",
    "Chapter Two",
    "Chapter Three",
  ]);
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
  expect(titlesOf(bookId)).toEqual([
    "Chapter Three",
    "Chapter One",
    "Chapter Two",
  ]);

  moveChapter(bookId, 0, 2);
  expect(titlesOf(bookId)).toEqual([
    "Chapter One",
    "Chapter Two",
    "Chapter Three",
  ]);
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

  expect(
    localStorage.getItem(`openchapter:chapter:${chapterId}`),
  ).not.toBeNull();
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
  const body = localStorage.getItem(
    `openchapter:chapter:${book.chapters[0].id}`,
  );
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
