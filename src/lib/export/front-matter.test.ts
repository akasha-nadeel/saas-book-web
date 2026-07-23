import { expect, it } from "vitest";
import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { DEFAULT_TYPESET } from "./typeset";
import { frontSections } from "./front-matter";

const book: Book = {
  id: "b",
  title: "Silent Wind",
  subtitle: "A novel",
  author: "A. Writer",
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
};

const doc = { type: "doc", content: [] };
const chapters: LoadedChapter[] = [
  { title: "Dedication", doc, number: null },
  { title: "Chapter One", doc, number: 1 },
  { title: "Chapter Two", doc, number: 2 },
  { title: "Epilogue", doc, number: null },
];

const opts = { ...DEFAULT_TYPESET, titlePage: true, copyright: true, contents: true };

it("generates the three front-matter pages when all are on", () => {
  const sections = frontSections(book, chapters, opts);
  expect(sections.map((s) => s.id)).toEqual(["title", "copyright", "contents"]);
});

it("leaves out pages that are switched off", () => {
  const sections = frontSections(book, chapters, {
    ...opts,
    copyright: false,
    contents: false,
  });
  expect(sections.map((s) => s.id)).toEqual(["title"]);
});

it("puts the title, subtitle and author on the title page", () => {
  const [title] = frontSections(book, chapters, { ...opts, copyright: false, contents: false });
  expect(title.html).toContain("Silent Wind");
  expect(title.html).toContain("A novel");
  expect(title.html).toContain("A. Writer");
});

it("dates the copyright and names the author as holder", () => {
  const sections = frontSections(book, chapters, { ...opts, titlePage: false, contents: false });
  const year = new Date().getFullYear();
  expect(sections[0].html).toContain(`${year}`);
  expect(sections[0].html).toContain("A. Writer");
});

it("numbers only the body chapters in the contents", () => {
  const sections = frontSections(book, chapters, { ...opts, titlePage: false, copyright: false });
  const html = sections[0].html;
  // Body chapters carry a number; front and back matter are listed by name.
  expect(html).toContain("1. Chapter One");
  expect(html).toContain("2. Chapter Two");
  expect(html).toContain("<li>Dedication</li>");
  expect(html).toContain("<li>Epilogue</li>");
});
