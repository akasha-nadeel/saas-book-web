import { beforeEach, expect, it } from "vitest";
import {
  createBook,
  createChapter,
  renameChapter,
  saveBody,
  findBook,
  getShelf,
} from "@/lib/library-store";
import { chapterText, searchChapters } from "@/lib/search";

beforeEach(() => {
  localStorage.clear();
});

const doc = (text: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text }] },
  ],
});

it("pulls plain text out of a stored document, title included", () => {
  const raw = JSON.stringify(doc("The crystal glowed in the dark."));
  expect(chapterText("Opening", raw)).toBe(
    "Opening The crystal glowed in the dark.",
  );
});

it("survives a corrupt body", () => {
  expect(chapterText("Title", "{ not json")).toBe("Title");
});

it("finds a word in a chapter's prose", () => {
  const { bookId, chapterId } = createBook();
  saveBody(bookId, chapterId, doc("Maya found the crystal at last."), 6);

  const hits = searchChapters(findBook(getShelf(), bookId)!, "crystal");
  expect(hits).toHaveLength(1);
  expect(hits[0].match).toBe("crystal");
  expect(hits[0].count).toBe(1);
});

it("counts every occurrence and matches case-insensitively", () => {
  const { bookId, chapterId } = createBook();
  saveBody(bookId, chapterId, doc("Wind, wind, and more WIND."), 5);

  const hits = searchChapters(findBook(getShelf(), bookId)!, "wind");
  expect(hits[0].count).toBe(3);
});

it("searches every chapter and returns them in reading order", () => {
  const { bookId, chapterId } = createBook();
  renameChapter(bookId, chapterId, "One");
  saveBody(bookId, chapterId, doc("a shadow moved"), 3);
  const two = createChapter(bookId, "Two");
  saveBody(bookId, two, doc("another shadow"), 2);

  const hits = searchChapters(findBook(getShelf(), bookId)!, "shadow");
  expect(hits.map((h) => h.title)).toEqual(["One", "Two"]);
});

it("ignores a one-character query", () => {
  const { bookId, chapterId } = createBook();
  saveBody(bookId, chapterId, doc("something"), 1);
  expect(searchChapters(findBook(getShelf(), bookId)!, "s")).toEqual([]);
});

it("also matches a chapter title", () => {
  const { bookId, chapterId } = createBook();
  renameChapter(bookId, chapterId, "The Crystal of Light");
  saveBody(bookId, chapterId, doc("plain body text"), 3);

  const hits = searchChapters(findBook(getShelf(), bookId)!, "crystal");
  expect(hits).toHaveLength(1);
});
