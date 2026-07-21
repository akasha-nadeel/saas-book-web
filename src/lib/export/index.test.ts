import { beforeEach, expect, it } from "vitest";
import {
  createBook,
  createChapter,
  findBook,
  getShelf,
  saveBody,
} from "@/lib/library-store";
import { buildMarkdownFile, loadChapters, slugify } from "@/lib/export";

beforeEach(() => {
  localStorage.clear();
});

it("slugifies a book title for a filename", () => {
  expect(slugify("The Salt Road")).toBe("the-salt-road");
  expect(slugify("  Mixed  CASE  ")).toBe("mixed-case");
  expect(slugify("A Book: Part Two!")).toBe("a-book-part-two");
  expect(slugify("—")).toBe("untitled");
});

it("loads every chapter of a book in order", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  const second = createChapter(bookId, "Chapter Two");
  saveBody(bookId, chapterId, { type: "doc" }, 0);
  saveBody(bookId, second, { type: "doc" }, 0);

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book).map((c) => c.title)).toEqual([
    "Chapter One",
    "Chapter Two",
  ]);
});

it("loads a single chapter when one is named", () => {
  const { bookId } = createBook("The Salt Road");
  const second = createChapter(bookId, "Chapter Two");

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book, second).map((c) => c.title)).toEqual([
    "Chapter Two",
  ]);
});

it("treats a never-saved chapter as empty rather than failing", () => {
  const { bookId } = createBook("The Salt Road");
  const book = findBook(getShelf(), bookId)!;

  const [chapter] = loadChapters(book);
  expect(chapter.doc.content ?? []).toEqual([]);
});

it("survives a corrupt body", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  localStorage.setItem(`openchapter:chapter:${chapterId}`, "{ not json");

  const book = findBook(getShelf(), bookId)!;
  expect(loadChapters(book)[0].doc.content ?? []).toEqual([]);
});

it("compiles a whole book with a title and chapter headings", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  saveBody(
    bookId,
    chapterId,
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "It began." }] },
      ],
    },
    2,
  );

  const book = findBook(getShelf(), bookId)!;
  expect(buildMarkdownFile(book, loadChapters(book))).toBe(
    "# The Salt Road\n\n## Chapter One\n\nIt began.",
  );
});

it("omits the book title when exporting a single chapter", () => {
  const { bookId, chapterId } = createBook("The Salt Road");
  saveBody(
    bookId,
    chapterId,
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "It began." }] },
      ],
    },
    2,
  );

  const book = findBook(getShelf(), bookId)!;
  const chapters = loadChapters(book, chapterId);
  expect(buildMarkdownFile(book, chapters, { single: true })).toBe(
    "# Chapter One\n\nIt began.",
  );
});
