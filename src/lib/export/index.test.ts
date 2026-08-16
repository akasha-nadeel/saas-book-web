import { beforeEach, expect, it } from "vitest";
import {
  createBook,
  createChapter,
  createMatterPage,
  findBook,
  getShelf,
  saveBody,
  setBookAuthor,
} from "@/lib/library-store";
import {
  buildMarkdownFile,
  checkStoreReadiness,
  fileSize,
  loadChapters,
  slugify,
} from "@/lib/export";

beforeEach(() => {
  localStorage.clear();
});

it("slugifies a book title for a filename", () => {
  expect(slugify("The Salt Road")).toBe("the-salt-road");
  expect(slugify("  Mixed  CASE  ")).toBe("mixed-case");
  expect(slugify("A Book: Part Two!")).toBe("a-book-part-two");
  expect(slugify("—")).toBe("untitled");
});

it("reports a file size the way a file manager does", () => {
  expect(fileSize(1)).toBe("1 byte");
  expect(fileSize(940)).toBe("940 bytes");
  expect(fileSize(1024)).toBe("1 KB");
  expect(fileSize(422_000)).toBe("412 KB");
  expect(fileSize(1_468_006)).toBe("1.4 MB");
  // Past ten megabytes the decimal is noise: nobody weighs an upload limit to
  // a tenth of a megabyte at that size.
  expect(fileSize(24_000_000)).toBe("23 MB");
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

/**
 * The markdown follows the same rule the EPUB does — see `printsHeading`. It
 * used to head every page, so a copyright sheet arrived in the file as
 * "## Copyright page", which is a heading no published book carries.
 */
it("heads a real division and not a piece of apparatus", () => {
  const { bookId } = createBook("The Salt Road");
  const book0 = findBook(getShelf(), bookId)!;
  const contents = createMatterPage(bookId, "front", "Table of contents");
  const dedication = createMatterPage(bookId, "front", "Dedication");
  const text = (t: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });
  saveBody(bookId, contents!, text("Chapter One .... 1"), 4);
  saveBody(bookId, dedication!, text("For Ada."), 2);
  void book0;

  const book = findBook(getShelf(), bookId)!;
  const md = buildMarkdownFile(book, loadChapters(book));

  expect(md).not.toContain("## Table of contents");
  expect(md).toContain("Chapter One .... 1");
  expect(md).toContain("## Dedication");
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

/**
 * A copyright page naming somebody else.
 *
 * The finding itself is the old part; what is asserted here is that it **comes
 * with the way to the page**. It is raised on the last screen of the export
 * wizard, about one of up to sixteen front-matter pages, and a writer told
 * "your copyright page is wrong" with no link is a writer left to go and find
 * it. Only the code that found the page knows which one it is, so if this
 * stops carrying a link nothing downstream can put one back.
 */
it("points at the copyright page it is complaining about", () => {
  const { bookId } = createBook("The Salt Road");
  setBookAuthor(bookId, "Mara Okonkwo");
  const pageId = createMatterPage(bookId, "front", "Copyright page")!;
  saveBody(
    bookId,
    pageId,
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Copyright © 2026 A. N. Author" }],
        },
      ],
    },
    4,
  );

  const book = findBook(getShelf(), bookId)!;
  const issue = checkStoreReadiness(book, null).find(
    (i) => i.field === "copyright-name",
  );

  expect(issue?.message).toContain("Mara Okonkwo");
  expect(issue?.link).toEqual({
    href: `/book/${bookId}/chapter/${pageId}`,
    label: "Open the copyright page",
  });
});

it("says nothing about a copyright page that names the author", () => {
  const { bookId } = createBook("The Salt Road");
  setBookAuthor(bookId, "Mara Okonkwo");
  const pageId = createMatterPage(bookId, "front", "Copyright page")!;
  saveBody(
    bookId,
    pageId,
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Copyright © 2026 Mara Okonkwo" }],
        },
      ],
    },
    4,
  );

  const book = findBook(getShelf(), bookId)!;
  expect(
    checkStoreReadiness(book, null).some((i) => i.field === "copyright-name"),
  ).toBe(false);
});
