import { beforeEach, expect, it } from "vitest";
import {
  bookWordCount,
  createBook,
  findBook,
  getShelf,
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
