import { describe, expect, it } from "vitest";
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
  const sections = frontSections(
    book,
    [
      { title: "Dedication", number: null, doc: { type: "doc", content: [] } },
      { title: "The Last Lamp", number: 1, doc: { type: "doc", content: [] } },
      { title: "Epilogue", number: null, doc: { type: "doc", content: [] } },
    ],
    { ...opts, titlePage: false, copyright: false },
  );
  const html = sections[0].html;
  // Body chapters carry a number; front and back matter are listed by name.
  expect(html).toContain("1. The Last Lamp");
  expect(html).toContain("<li>Dedication</li>");
  expect(html).toContain("<li>Epilogue</li>");
});

// "1. Chapter One" was what shipped, and it says the same thing twice. The
// numeral is the app's, the word is the writer's, and the writer's wins.
it("drops the numeral when the title already carries the number", () => {
  const sections = frontSections(book, chapters, {
    ...opts,
    titlePage: false,
    copyright: false,
  });
  expect(sections[0].html).toContain("<li>Chapter One</li>");
  expect(sections[0].html).not.toContain("1. Chapter One");
});

// A contents page nobody can tap is a page read once. Paper gets none, because
// an anchor on paper is a dead blue word.
it("links each chapter when the format has somewhere to link to", () => {
  const sections = frontSections(
    book,
    chapters,
    { ...opts, titlePage: false, copyright: false },
    (i) => `chapter-${String(i + 1).padStart(2, "0")}.xhtml`,
  );
  expect(sections[0].html).toContain('<a href="chapter-02.xhtml">Chapter One</a>');
});

it("leaves the contents unlinked when no target is given", () => {
  const sections = frontSections(book, chapters, {
    ...opts,
    titlePage: false,
    copyright: false,
  });
  expect(sections[0].html).not.toContain("<a href=");
});

/**
 * A page the writer wrote wins over the one we would generate.
 *
 * Three of the generated pages can also be written by hand now that front
 * matter is a list, and a book carrying both got two title pages on
 * consecutive sheets.
 */
describe("generated pages stand down for written ones", () => {
  const chapter = (
    title: string,
    matter?: "front" | "back",
  ): LoadedChapter => ({
    title,
    doc: { type: "doc", content: [] },
    number: matter ? null : 1,
    ...(matter ? { matter } : {}),
  });

  const options = {
    ...DEFAULT_TYPESET,
    titlePage: true,
    copyright: true,
    contents: true,
  };
  const written = { ...book, author: "Marguerite Hale" };

  it("generates all three when the writer has written none", () => {
    expect(
      frontSections(written, [chapter("Chapter One")], options).map(
        (s) => s.id,
      ),
    ).toEqual(["title", "copyright", "contents"]);
  });

  it("leaves out the one the writer has written", () => {
    const ids = frontSections(
      written,
      [chapter("Title page", "front"), chapter("Chapter One")],
      options,
    ).map((s) => s.id);
    expect(ids).not.toContain("title");
    expect(ids).toEqual(["copyright", "contents"]);
  });

  it("matches the title however it is cased or spaced", () => {
    expect(
      frontSections(
        written,
        [chapter("  copyright page ", "front"), chapter("Chapter One")],
        options,
      ).map((s) => s.id),
    ).not.toContain("copyright");
  });

  /*
   * A back-matter page called "Title page" is a strange thing to have, and it
   * is still not the book's title page — so it silences nothing. The check is
   * about which sheet opens the book, not about the words on a tab.
   */
  it("only front-matter pages stand anything down", () => {
    expect(
      frontSections(
        written,
        [chapter("Chapter One"), chapter("Title page", "back")],
        options,
      ).map((s) => s.id),
    ).toContain("title");
  });

  it("hands the job back when the page is renamed to something else", () => {
    expect(
      frontSections(
        written,
        [chapter("Copyright and permissions", "front"), chapter("Chapter One")],
        options,
      ).map((s) => s.id),
    ).toContain("copyright");
  });
});

/**
 * The title page's imprint block — the publisher and year that sit at the foot
 * of the sheet, under a rule.
 *
 * The rule these guard is "nothing is invented to fill the page": a
 * self-published first novel carries neither field, and the block must vanish
 * rather than print an empty rule over white space.
 */
describe("the title page's imprint", () => {
  const titleOf = (b: Book) =>
    frontSections(b, chapters, {
      ...opts,
      copyright: false,
      contents: false,
    })[0].html;

  it("prints the publisher and the year of publication", () => {
    const html = titleOf({
      ...book,
      publishing: { publisher: "Salt House", published: "2026-08-16" },
    });
    expect(html).toContain("Salt House");
    // The year alone: a title page carries a year, not a filing date.
    expect(html).toContain("<p>2026</p>");
    expect(html).not.toContain("2026-08-16");
  });

  it("leaves the foot off a book with neither", () => {
    const html = titleOf(book);
    expect(html).not.toContain("title-imprint");
  });

  it("prints a publisher with no date, and a date with no publisher", () => {
    expect(titleOf({ ...book, publishing: { publisher: "Salt House" } })).toContain(
      "title-imprint",
    );
    expect(titleOf({ ...book, publishing: { published: "2026-08-16" } })).toContain(
      "<p>2026</p>",
    );
  });

  // `published` is stored as YYYY-MM-DD, but nothing enforces it on an
  // imported book — and half a date under an author's name is worse than none.
  it("ignores a date it cannot read a year out of", () => {
    const html = titleOf({ ...book, publishing: { published: "soon" } });
    expect(html).not.toContain("title-imprint");
  });

  it("keeps the title, subtitle and author in their own block", () => {
    const html = titleOf(book);
    expect(html).toContain("title-block");
    expect(html).toContain("Silent Wind");
    expect(html).toContain("A. Writer");
  });
});
