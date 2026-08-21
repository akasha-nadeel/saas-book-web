import { beforeEach, expect, it } from "vitest";
import {
  createBook,
  createChapter,
  createMatterPages,
  findBook,
  getShelf,
  renameChapter,
  saveBody,
} from "@/lib/library-store";
import { loadChapters, runExport } from "@/lib/export";
import { printDocument } from "@/lib/export/print";
import { boundReaderPages } from "@/lib/reader/bound-pages";
import { DEFAULT_TYPESET } from "@/lib/export/typeset";
import { blocksToXhtml } from "@/lib/export/xhtml";
import { toBlocks, chapterNumeral } from "@/lib/export/blocks";

/**
 * A serious look at what actually comes out of each button.
 *
 * Not a substitute for `consistency.test.ts`, which holds the renderers to one
 * *order*. This asks a different question: does the thing a writer downloads
 * contain their book — every chapter, in order, with the formatting, the
 * pictures, the odd characters and the metadata intact, and nothing extra?
 */

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
/** A paragraph carrying marks, so formatting can be followed through. */
const marked = () => ({
  type: "paragraph",
  content: [
    { type: "text", text: "plain " },
    { type: "text", marks: [{ type: "bold" }], text: "bold" },
    { type: "text", text: " and " },
    { type: "text", marks: [{ type: "italic" }], text: "italic" },
  ],
});
const image = () => ({
  type: "image",
  attrs: {
    src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    alt: "a red dot",
  },
});

const ODD = "Odd: “curly” ‘quotes’ — em … & < > \" ' 🚀 日本語 é ñ";

/** Everything a book can carry, so nothing has an excuse to go missing. */
function fullBook() {
  const { bookId, chapterId } = createBook("The Salt Road", {
    author: "M. Reyes",
    genre: "Fantasy",
  });

  createMatterPages(bookId, [
    { part: "front", title: "Half-title page" },
    { part: "front", title: "Dedication" },
    { part: "front", title: "Prologue" },
    { part: "back", title: "Epilogue" },
    { part: "back", title: "Acknowledgements" },
  ]);

  const shelf = findBook(getShelf(), bookId)!;
  const idOf = (t: string) => shelf.chapters.find((c) => c.title === t)!.id;

  saveBody(bookId, idOf("Half-title page"), doc(p("The Salt Road")), 3);
  saveBody(bookId, idOf("Dedication"), doc(p("For Nadia.")), 2);
  saveBody(bookId, idOf("Prologue"), doc(p("Rain, an hour before dawn.")), 5);
  saveBody(bookId, idOf("Epilogue"), doc(p("A year later, the light.")), 5);
  saveBody(bookId, idOf("Acknowledgements"), doc(p("Thanks to Ana and Bo.")), 5);

  const two = createChapter(bookId);
  const three = createChapter(bookId);
  renameChapter(bookId, three, "The Fourth Lamp");

  saveBody(bookId, chapterId, doc(p("CHAP-ONE the harbour smelled of tar."), marked()), 8);
  saveBody(bookId, two, doc(p("CHAP-TWO " + ODD)), 8);
  saveBody(bookId, three, doc(p("CHAP-THREE the lamp was lit."), image()), 8);

  return findBook(getShelf(), bookId)!;
}

beforeEach(() => {
  localStorage.clear();
});

// --- what every format must carry ------------------------------------------

it("EPUB: carries every chapter, in order, once", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "epub", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);

  const files = Object.keys(zip.files).filter((f) => f.endsWith(".xhtml"));
  let all = "";
  for (const f of files) all += await zip.file(f)!.async("string");

  for (const m of ["CHAP-ONE", "CHAP-TWO", "CHAP-THREE"]) {
    expect(all.split(m).length - 1, `${m} appears exactly once`).toBe(1);
  }
  // Order, read off the spine rather than the file list.
  expect(all.indexOf("CHAP-ONE")).toBeLessThan(all.indexOf("CHAP-TWO"));
  expect(all.indexOf("CHAP-TWO")).toBeLessThan(all.indexOf("CHAP-THREE"));
});

it("EPUB: front and back matter both reach the file", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "epub", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);
  let all = "";
  for (const f of Object.keys(zip.files).filter((f) => f.endsWith(".xhtml")))
    all += await zip.file(f)!.async("string");

  expect(all).toContain("For Nadia.");
  expect(all).toContain("Rain, an hour before dawn.");
  expect(all).toContain("A year later, the light.");
  expect(all).toContain("Thanks to Ana and Bo.");
});

it("EPUB: formatting, pictures and odd characters survive", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "epub", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);
  let all = "";
  for (const f of Object.keys(zip.files).filter((f) => f.endsWith(".xhtml")))
    all += await zip.file(f)!.async("string");

  expect(all, "bold").toMatch(/<(strong|b)>bold<\/(strong|b)>/);
  expect(all, "italic").toMatch(/<(em|i)>italic<\/(em|i)>/);
  expect(all, "curly quotes").toContain("“curly”");
  expect(all, "em dash").toContain("—");
  expect(all, "emoji").toContain("🚀");
  expect(all, "CJK").toContain("日本語");
  // Escaped, not raw.
  expect(all, "ampersand escaped").toContain("&amp;");
  expect(all, "no raw angle bracket from prose").not.toContain("& < >");
  // The picture is packaged as a file rather than left as a data URL.
  const images = Object.keys(zip.files).filter((f) => /images\//.test(f));
  expect(images.length, "picture packaged").toBeGreaterThan(0);
  expect(all, "no data: URL left in the markup").not.toContain("data:image");
});

it("EPUB: the metadata is the book's own", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "epub", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);
  const opf = await zip.file("OEBPS/content.opf")!.async("string");

  expect(opf).toContain("The Salt Road");
  expect(opf).toContain("M. Reyes");
  expect(opf).toMatch(/<dc:language>/);
  expect(opf).toMatch(/<dc:identifier/);
});

it("DOCX: carries every chapter once, with the matter pages", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "docx", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);
  const xml = await zip.file("word/document.xml")!.async("string");
  const text = xml.replace(/<[^>]+>/g, "");

  for (const m of ["CHAP-ONE", "CHAP-TWO", "CHAP-THREE"]) {
    expect(text.split(m).length - 1, `${m} once`).toBe(1);
  }
  expect(text.indexOf("CHAP-ONE")).toBeLessThan(text.indexOf("CHAP-TWO"));
  expect(text).toContain("For Nadia.");
  expect(text).toContain("Thanks to Ana and Bo.");
  expect(text, "emoji").toContain("🚀");
  expect(text, "curly quotes").toContain("“curly”");
});

it("Markdown: built and correct, even though nothing reaches it", async () => {
  const book = fullBook();
  const out = await runExport({ book, format: "markdown", manuscript: false });
  const md = await out!.blob.text();

  for (const m of ["CHAP-ONE", "CHAP-TWO", "CHAP-THREE"]) {
    expect(md.split(m).length - 1, `${m} once`).toBe(1);
  }
  expect(md.indexOf("CHAP-ONE")).toBeLessThan(md.indexOf("CHAP-TWO"));
  expect(md, "bold").toContain("**bold**");
  expect(md, "italic").toMatch(/[*_]italic[*_]/);
  expect(md).toContain("For Nadia.");
});

it("PDF: the markup handed to the renderer holds the whole book, once", () => {
  const book = fullBook();
  const { content } = printDocument(
    book,
    loadChapters(book),
    DEFAULT_TYPESET,
  );
  for (const m of ["CHAP-ONE", "CHAP-TWO", "CHAP-THREE"]) {
    expect(content.split(m).length - 1, `${m} once`).toBe(1);
  }
  expect(content.indexOf("CHAP-ONE")).toBeLessThan(content.indexOf("CHAP-TWO"));
  expect(content).toContain("For Nadia.");
  expect(content).toContain("Thanks to Ana and Bo.");
  expect(content).toContain("🚀");
});

// --- the one that matters most ---------------------------------------------

/**
 * **Does the Preview show the book the export builds?**
 *
 * `boundReaderPages` is what the wizard's Preview mounts, and it calls the
 * export's own `withoutReplaced → frontSections → bindBook`. So the two should
 * agree page for page. This compares the prose the reader would show against
 * the prose the EPUB carries, in order.
 */
it("Preview and export show the same pages in the same order", async () => {
  const book = fullBook();

  const pages = boundReaderPages(book, loadChapters(book).map((c) => ({
    ...c,
    id: "x",
    label: null,
    html: blocksToXhtml(toBlocks(c.doc)),
  })), DEFAULT_TYPESET);

  const previewMarkers = pages
    .map((p) => p.html)
    .join("\n")
    .match(/CHAP-(ONE|TWO|THREE)/g);

  const out = await runExport({ book, format: "epub", manuscript: false });
  const zip = await (await import("jszip")).default.loadAsync(out!.blob);
  let all = "";
  for (const f of Object.keys(zip.files).filter((f) => f.endsWith(".xhtml")))
    all += await zip.file(f)!.async("string");
  const exportMarkers = all.match(/CHAP-(ONE|TWO|THREE)/g);

  // Both sides must actually hold the three chapters — `toEqual(null, null)`
  // would pass while proving nothing, which is the trap this test could set.
  expect(previewMarkers, "preview markers").toEqual([
    "CHAP-ONE",
    "CHAP-TWO",
    "CHAP-THREE",
  ]);
  expect(exportMarkers).toEqual(previewMarkers);
});

/**
 * **The opener a writer sees and the opener the file prints.**
 *
 * These disagreed: the reading view spelled "Chapter Three" from
 * `chapterLabel`, while every renderer printed a bare numeral from
 * `chapterNumeral`. Same rule, two renderings, on the most visible line of a
 * named chapter's opening page. Both ask `chapterNumeral` now.
 */
it("the preview's chapter opener is the numeral the file prints", () => {
  const book = fullBook();
  const loaded = loadChapters(book);

  const named = loaded.find((c) => c.title === "The Fourth Lamp")!;
  const generic = loaded.find((c) => c.title === "Chapter Two")!;

  // What `book-pages.tsx` and `page-preview.tsx` now compute.
  const openerFor = (c: typeof named) => {
    const n = chapterNumeral({ title: c.title, number: c.number });
    return n === null ? null : String(n);
  };

  // A named chapter carries its number; a chapter that is still called
  // "Chapter Two" is its own label and carries nothing.
  expect(openerFor(named)).toBe("3");
  expect(openerFor(generic)).toBeNull();
});
