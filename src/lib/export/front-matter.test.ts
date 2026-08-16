import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { DEFAULT_TYPESET } from "./typeset";
import { bindBook, frontSections, withoutReplaced } from "./front-matter";

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
  // The title and the leader are separate elements so the folio can sit at the
  // far end of the line — see the `target-counter` rule in typeset.ts.
  expect(sections[0].html).toContain('<a href="chapter-02.xhtml">');
  expect(sections[0].html).toContain('<span class="toc-title">Chapter One</span>');
  expect(sections[0].html).toContain('<span class="toc-dots"></span>');
});

/**
 * The folio is never written into the markup, and this is the test that keeps
 * it that way.
 *
 * A page number here would have to be one this module worked out, and it cannot
 * — the pages do not exist until the document is laid out. It comes from
 * `target-counter` at render time instead, which is the difference between a
 * real number and a plausible one.
 */
it("writes no page number of its own into the contents", () => {
  const html = frontSections(
    book,
    chapters,
    { ...opts, titlePage: false, copyright: false },
    (i) => `#page-${i + 1}`,
  )[0].html;

  expect(html).toContain('class="toc-dots"');
  // Nothing between the leader and the end of the entry.
  expect(html).toMatch(/<span class="toc-dots"><\/span><\/a>/);
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

  /**
   * The writer can ask for ours instead, and the whole of that is one filter.
   *
   * The pair of tests that matter are the two halves of the same press: their
   * page leaves the book, *and* ours starts being generated — because the
   * second falls out of the first rather than being arranged separately. If
   * these ever disagree, the export is emitting two contents pages or none.
   */
  describe("withoutReplaced", () => {
    const pages = [
      chapter("Title page", "front"),
      chapter("Table of contents", "front"),
      chapter("Chapter One"),
    ];

    it("is the same list when nothing is being replaced", () => {
      expect(withoutReplaced(pages, [])).toBe(pages);
      expect(withoutReplaced(pages, undefined)).toBe(pages);
    });

    it("drops only the page that was asked about", () => {
      expect(withoutReplaced(pages, ["contents"]).map((c) => c.title)).toEqual([
        "Title page",
        "Chapter One",
      ]);
    });

    it("makes the generated page appear, which is the point of it", () => {
      const kept = frontSections(written, pages, options).map((s) => s.id);
      expect(kept).not.toContain("contents");

      const swapped = frontSections(
        written,
        withoutReplaced(pages, ["contents"]),
        options,
      ).map((s) => s.id);
      expect(swapped).toContain("contents");
    });

    it("leaves a body chapter of the same name alone", () => {
      const body = [chapter("Title page"), chapter("Chapter One")];
      expect(withoutReplaced(body, ["title"])).toHaveLength(2);
    });

    it("replaces more than one at a time", () => {
      expect(
        withoutReplaced(pages, ["title", "contents"]).map((c) => c.title),
      ).toEqual(["Chapter One"]);
    });
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

// ---------------------------------------------------------------------------
// The order a book is bound in
// ---------------------------------------------------------------------------

/*
 * **These assert positions, and they are the ones not to "fix".** The whole
 * point of `bindBook` is that four renderers and one preview stopped answering
 * "what page is first" for themselves. Loosen an expectation here and the
 * formats are free to drift apart again, silently — which is exactly how a
 * book came to open on a generated title page in the PDF and on its own
 * half-title in the EPUB.
 */
describe("bindBook", () => {
  const mixedFront: LoadedChapter[] = [
    { title: "Half-title page", doc, number: null, matter: "front" },
    { title: "Dedication", doc, number: null, matter: "front" },
    { title: "Prologue", doc, number: null, matter: "front" },
    { title: "Chapter One", doc, number: 1, matter: "body" },
    { title: "Chapter Two", doc, number: 2, matter: "body" },
    { title: "Acknowledgements", doc, number: null, matter: "back" },
  ];
  const generated = [
    { id: "title", html: "" },
    { id: "copyright", html: "" },
    { id: "contents", html: "" },
  ];

  const names = (chapters: LoadedChapter[], sections = generated) =>
    bindBook(chapters, sections).map((page) =>
      page.kind === "generated" ? `[${page.section.id}]` : page.chapter.title,
    );

  it("binds the generated pages among the writer's own, not in front of them", () => {
    expect(names(mixedFront)).toEqual([
      "Half-title page",
      "[title]",
      "[copyright]",
      "Dedication",
      "[contents]",
      "Prologue",
      "Chapter One",
      "Chapter Two",
      "Acknowledgements",
    ]);
  });

  it("leaves the body and the back matter in the order they were loaded", () => {
    // The writer's own sequence. Nothing here has any business sorting it.
    const bound = names(mixedFront).slice(-3);

    expect(bound).toEqual(["Chapter One", "Chapter Two", "Acknowledgements"]);
  });

  it("sorts a page the writer named themselves to the end of the front matter", () => {
    // Nothing is known about its position but that it is front matter, and
    // last is the only honest answer.
    const named: LoadedChapter[] = [
      { title: "A note on the map", doc, number: null, matter: "front" },
      { title: "Chapter One", doc, number: 1, matter: "body" },
    ];

    expect(names(named)).toEqual([
      "[title]",
      "[copyright]",
      "[contents]",
      "A note on the map",
      "Chapter One",
    ]);
  });

  it("keeps each chapter's loaded index, whatever position it is bound at", () => {
    // The exporters name files and anchors positionally, so a reordering that
    // renumbered would point every contents folio at the wrong page.
    const bound = bindBook(mixedFront, generated);
    const prologue = bound.find(
      (page) => page.kind === "chapter" && page.chapter.title === "Prologue",
    );

    expect(prologue).toMatchObject({ index: 2 });
  });

  it("is the whole book when there is nothing generated", () => {
    expect(names(mixedFront, [])).toEqual([
      "Half-title page",
      "Dedication",
      "Prologue",
      "Chapter One",
      "Chapter Two",
      "Acknowledgements",
    ]);
  });
});
