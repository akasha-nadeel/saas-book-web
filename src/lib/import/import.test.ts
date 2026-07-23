import { expect, it } from "vitest";
import { countWords, toDoc, type Block } from "@/lib/import/blocks";
import { parseHtml } from "@/lib/import/html";
import { parseText } from "@/lib/import/plain-text";
import { splitIntoChapters } from "@/lib/import/split";
import { titleFromFileName } from "@/lib/import/index";

// --- plain text ------------------------------------------------------------

it("treats blank lines as paragraph breaks and rejoins wrapped lines", () => {
  const blocks = parseText(
    "The road ran west,\nand the salt began.\n\nShe did not look back.",
    false,
  );

  // Two paragraphs, not three lines: the wrap inside the first is not a break.
  const text = blocks.map((b) => b.inline.map((i) => i.text).join(""));
  expect(text).toEqual([
    "The road ran west, and the salt began.",
    "She did not look back.",
  ]);
});

it("treats one-line-per-paragraph files as paragraphs", () => {
  // No blank line anywhere, so every line stands alone. Rejoining here would
  // weld the whole manuscript into a single paragraph.
  const blocks = parseText("First para.\nSecond para.\nThird para.", false);
  expect(blocks).toHaveLength(3);
});

it("keeps blank lines, which are scene breaks", () => {
  const blocks = parseText("One.\n\n\nTwo.", false);
  expect(blocks.some((b) => b.inline.length === 0)).toBe(true);
});

it("does not read markdown syntax in a plain text file", () => {
  const [block] = parseText("# Not a heading **not bold**", false);
  expect(block.type).toBe("paragraph");
  expect(block.inline[0].text).toBe("# Not a heading **not bold**");
});

// --- markdown --------------------------------------------------------------

it("reads markdown headings and caps them at three levels", () => {
  const blocks = parseText("# One\n\n#### Four", true);
  expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
  // The editor offers three levels; an h4 chapter would otherwise read as prose.
  expect(blocks[1]).toMatchObject({ type: "heading", level: 3 });
});

it("reads bold and italic", () => {
  const [block] = parseText("A **bold** and *italic* line.", true);
  expect(block.inline).toEqual([
    { text: "A " },
    { text: "bold", bold: true },
    { text: " and " },
    { text: "italic", italic: true },
    { text: " line." },
  ]);
});

it("drops horizontal rules, which carry no prose", () => {
  const blocks = parseText("One.\n\n---\n\nTwo.", true);
  expect(blocks.map((b) => b.inline[0]?.text)).toEqual(["One.", "Two."]);
});

// --- html ------------------------------------------------------------------

it("reads headings, paragraphs and emphasis from html", () => {
  const blocks = parseHtml(
    "<h2>Chapter One</h2><p>She <em>ran</em>, and <strong>kept</strong> running.</p>",
  );

  expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
  expect(blocks[1].inline).toEqual([
    { text: "She " },
    { text: "ran", italic: true },
    { text: ", and " },
    { text: "kept", bold: true },
    { text: " running." },
  ]);
});

it("ignores scripts and styles", () => {
  const blocks = parseHtml(
    "<style>p { color: red }</style><p>Real text.</p><script>alert(1)</script>",
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0].inline[0].text).toBe("Real text.");
});

it("does not turn a wrapper div into a paragraph", () => {
  // Word and Google Docs nest paragraphs several divs deep. Counting the
  // wrappers would double every paragraph in the book.
  const blocks = parseHtml("<div><div><p>One.</p><p>Two.</p></div></div>");
  expect(blocks).toHaveLength(2);
});

it("merges adjacent runs carrying the same marks", () => {
  const [block] = parseHtml("<p><b>one</b><b> two</b></p>");
  expect(block.inline).toEqual([{ text: "one two", bold: true }]);
});

// --- splitting -------------------------------------------------------------

const para = (text: string): Block => ({
  type: "paragraph",
  inline: [{ text }],
});
const head = (text: string, level: 1 | 2 | 3): Block => ({
  type: "heading",
  level,
  inline: [{ text }],
});

it("splits on the heading level that repeats", () => {
  const book = splitIntoChapters(
    [
      head("The Salt Road", 1),
      head("Chapter One", 2),
      para("She left at dawn."),
      head("Chapter Two", 2),
      para("The road turned."),
    ],
    "fallback",
  );

  // The lone h1 is the book's title, not a chapter divider.
  expect(book.title).toBe("The Salt Road");
  expect(book.chapters.map((c) => c.title)).toEqual([
    "Chapter One",
    "Chapter Two",
  ]);
});

it("falls back to the file name when the document does not name itself", () => {
  const book = splitIntoChapters(
    [head("One", 1), para("a"), head("Two", 1), para("b")],
    "My Manuscript",
  );
  expect(book.title).toBe("My Manuscript");
  expect(book.chapters).toHaveLength(2);
});

it("splits on chapter lines when there are no headings", () => {
  const book = splitIntoChapters(
    [
      para("Chapter One"),
      para("She left at dawn."),
      para("Chapter Two"),
      para("The road turned."),
    ],
    "fallback",
  );
  expect(book.chapters.map((c) => c.title)).toEqual([
    "Chapter One",
    "Chapter Two",
  ]);
});

it("does not mistake a sentence starting with 'Chapter' for a divider", () => {
  const book = splitIntoChapters(
    [
      para(
        "Chapter headings were the least of her problems that morning, and the rest of it only got worse from there.",
      ),
    ],
    "fallback",
  );
  expect(book.chapters).toHaveLength(1);
});

it("folds text before the first chapter break into the first chapter", () => {
  const book = splitIntoChapters(
    [para("An epigraph."), para("Chapter One"), para("She left.")],
    "fallback",
  );

  // No separate "Opening" chapter — the lead-in joins the first chapter, so no
  // words are lost and the book reads as clean Chapter 1, 2, 3.
  expect(book.chapters).toHaveLength(1);
  expect(book.chapters[0].title).toBe("Chapter One");
  // Both the epigraph and the body survived the fold.
  expect(book.chapters[0].words).toBeGreaterThanOrEqual(4);
});

it("returns one chapter when nothing suggests a division", () => {
  const book = splitIntoChapters([para("a"), para("b")], "My Book");
  expect(book.chapters).toHaveLength(1);
  expect(book.chapters[0].title).toBe("My Book");
});

it("always returns at least one chapter", () => {
  // The routes assume a book has somewhere to open.
  const book = splitIntoChapters([], "Empty");
  expect(book.chapters).toHaveLength(1);
});

it("drops headings that have nothing under them", () => {
  // A table of contents would otherwise import as a run of empty chapters.
  const book = splitIntoChapters(
    [head("One", 1), head("Two", 1), head("Three", 1), para("Real text.")],
    "fallback",
  );
  expect(book.chapters).toHaveLength(1);
  expect(book.chapters[0].title).toBe("Three");
});

// --- document building -----------------------------------------------------

it("counts words the way the editor does", () => {
  expect(countWords([para("one two three"), para("four")])).toBe(4);
  expect(countWords([para("")])).toBe(0);
});

it("builds an empty paragraph without an empty content array", () => {
  // Tiptap rejects { type: "paragraph", content: [] } on load.
  const doc = toDoc([para("")]);
  expect(doc.content[0]).toEqual({ type: "paragraph" });
});

it("carries marks into the document", () => {
  const doc = toDoc([{ type: "paragraph", inline: [{ text: "x", bold: true }] }]);
  expect(doc.content[0]).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }],
  });
});

// --- file names ------------------------------------------------------------

it("makes a book title out of a file name", () => {
  expect(titleFromFileName("the_salt_road.docx")).toBe("the salt road");
  expect(titleFromFileName("My-Novel-Draft-3.md")).toBe("My Novel Draft 3");
});
