import { beforeEach, expect, it, vi } from "vitest";
import {
  bookWordCount,
  createBook,
  deleteBook,
  findBook,
  getShelf,
  renameBook,
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
