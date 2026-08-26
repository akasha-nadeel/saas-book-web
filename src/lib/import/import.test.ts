import { expect, it } from "vitest";
import { countWords, paragraph, toDoc, type Block } from "@/lib/import/blocks";
import { parseHtml } from "@/lib/import/html";
import { parseText } from "@/lib/import/plain-text";
import {
  importAsksFirst,
  importSummary,
  looksLikeChapterLine,
  looksLikeMatterLine,
  partOfImport,
  splitIntoChapters,
  summaryParts,
  summaryPhrase,
} from "@/lib/import/split";
import { importFile, titleFromFileName } from "@/lib/import/index";

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

/**
 * `declared` — one document the file itself marked out, which only an EPUB can
 * say. These three are the round-trip bug: exporting a one-chapter book and
 * importing it back gave a chapter named after the *book*, with the chapter's
 * own heading still sitting in its prose. Re-exporting then printed both.
 */
it("reads a lone heading in a declared document as that document's name", () => {
  const book = splitIntoChapters(
    [head("Chapter One", 1), para("The tide went out.")],
    "The Salt Ledger",
    true,
  );

  expect(book.chapters).toHaveLength(1);
  // Its own name, not the book's.
  expect(book.chapters[0].title).toBe("Chapter One");
});

it("takes the heading out of the prose when it names the document", () => {
  const book = splitIntoChapters(
    [head("Chapter One", 1), para("The tide went out.")],
    "The Salt Ledger",
    true,
  );

  // Left in, the exporter prints it under the chapter title it duplicates.
  const nodes = (book.chapters[0].doc.content ?? []) as { type?: string }[];
  expect(nodes.map((n) => n.type)).not.toContain("heading");
});

it("still splits a declared document that holds several chapters", () => {
  // A spine file carrying the whole book: one H1 title over H2 chapters. The
  // lone H1 must not win here, or the book comes back as a single chapter.
  const book = splitIntoChapters(
    [
      head("The Salt Road", 1),
      head("Chapter One", 2),
      para("She left at dawn."),
      head("Chapter Two", 2),
      para("The road turned."),
    ],
    "fallback",
    true,
  );

  expect(book.chapters.map((c) => c.title)).toEqual([
    "Chapter One",
    "Chapter Two",
  ]);
});

/**
 * The number and the name on two lines — the shape most manuscripts use, and
 * the one that used to leave a chapter titled "Chapter Two" with its real name
 * sitting in its own prose. See `nameFromLeadingHeading` in `split.ts`.
 */
it("lifts a chapter's real name out of the prose when its title is only a number", () => {
  const book = splitIntoChapters(
    [
      head("Chapter One", 1),
      head("The House by the Sea", 2),
      para("The bus reached Mirissa shortly after noon."),
      head("Chapter Two", 1),
      head("The Keeper's Journal", 2),
      para("The lamp had not been lit for a year."),
    ],
    "fallback",
  );

  expect(book.chapters.map((c) => c.title)).toEqual([
    "The House by the Sea",
    "The Keeper's Journal",
  ]);
  // And the heading is gone from the body, or the exporter prints both.
  for (const chapter of book.chapters) {
    const nodes = (chapter.doc.content ?? []) as { type?: string }[];
    expect(nodes.map((n) => n.type)).not.toContain("heading");
  }
});

it("counts the words of the body it kept, not the heading it lifted", () => {
  const book = splitIntoChapters(
    [head("Chapter One", 1), head("The House by the Sea", 2), para("One two three.")],
    "The Salt Ledger",
    true,
  );

  expect(book.chapters[0].words).toBe(3);
});

/**
 * The guard that matters most: under a chapter the writer *named*, a heading is
 * their own subhead. Taking it would be losing text they wrote.
 */
it("leaves a subheading alone when the chapter already has a real name", () => {
  const book = splitIntoChapters(
    [
      head("The Salt Road", 1),
      head("A morning in June", 2),
      para("She left at dawn."),
      head("The Long Way Back", 1),
      head("A night in October", 2),
      para("The road turned."),
    ],
    "fallback",
  );

  expect(book.chapters.map((c) => c.title)).toEqual([
    "The Salt Road",
    "The Long Way Back",
  ]);
  const nodes = (book.chapters[0].doc.content ?? []) as { type?: string }[];
  expect(nodes.map((n) => n.type)).toContain("heading");
});

it("leaves a numbered chapter alone when its body opens with prose", () => {
  const book = splitIntoChapters(
    [
      head("Chapter One", 1),
      para("She left at dawn."),
      head("Chapter Two", 1),
      para("The road turned."),
    ],
    "fallback",
  );

  expect(book.chapters.map((c) => c.title)).toEqual(["Chapter One", "Chapter Two"]);
});

it("never lifts a heading that would leave the chapter empty", () => {
  // A lone heading under a numbered title is a contents entry, not a name to
  // promote — taking it would leave a titled chapter with nothing in it.
  const book = splitIntoChapters(
    [head("Chapter One", 1), head("The House by the Sea", 2)],
    "The Salt Ledger",
    true,
  );

  expect(book.chapters[0].title).toBe("Chapter One");
});

it("lifts a heading that merely repeats a numbered title", () => {
  // "Chapter One" over "Chapter One" — promoting is how the duplicate goes.
  const book = splitIntoChapters(
    [head("Chapter 1", 1), head("Chapter One", 2), para("The tide went out.")],
    "The Salt Ledger",
    true,
  );

  expect(book.chapters[0].title).toBe("Chapter One");
  const nodes = (book.chapters[0].doc.content ?? []) as { type?: string }[];
  expect(nodes.map((n) => n.type)).not.toContain("heading");
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

/* --- front and back matter from a file that declares nothing ---------------
 *
 * An EPUB carries an `epub:type` on every document and the importer believes
 * it (see `archive.test.ts`). A Word file, a Markdown file and a plain text
 * file carry headings and no more, so until this existed every one of those
 * headings became a body chapter — a manuscript opening with a half-title, a
 * title page and a copyright page arrived as three chapters of a novel that
 * has none.
 * ------------------------------------------------------------------------- */

const asFile = (text: string, name: string) =>
  new File([text], name, { type: "text/markdown" });

/** The shape of a real manuscript: apparatus, then the story, then the rest. */
const MANUSCRIPT = [
  "# Half-title page",
  "The Lighthouse Beyond the Rain",
  "# Title page",
  "A Novel",
  "# Copyright page",
  "Copyright 2026",
  "# Dedication",
  "For everyone who left.",
  "# Preface",
  "Some places stay with us.",
  "# Chapter One",
  "The bus reached Mirissa after noon.",
  "# Chapter Two",
  "Arun barely slept.",
  "# Epilogue",
  "One year later.",
  "# Acknowledgements",
  "Thank you.",
  "# Glossary",
  "Amma — mother.",
].join("\n\n");

/**
 * The whole way through, on the file shape that caused this: `#` marks the
 * chapter and `##` names it. Covers what the unit tests above cannot — that
 * markdown's own heading levels come out such that the number is the divider
 * and the name is the block underneath it.
 */
it("imports a numbered manuscript under the names its headings carry", async () => {
  const file = asFile(
    [
      "# Chapter One",
      "## The House by the Sea",
      "The bus reached Mirissa after noon.",
      "# Chapter Two",
      "## The Keeper's Journal",
      "The lamp had not been lit for a year.",
    ].join("\n\n"),
    "novel.md",
  );

  const book = await importFile(file);

  expect(book.chapters.map((c) => c.title)).toEqual([
    "The House by the Sea",
    "The Keeper's Journal",
  ]);
  for (const chapter of book.chapters) {
    const nodes = (chapter.doc.content ?? []) as { type?: string }[];
    expect(nodes.map((n) => n.type)).not.toContain("heading");
  }
});

it("files a manuscript's apparatus as front and back matter", async () => {
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"));
  const part = (title: string) =>
    book.chapters.find((c) => c.title === title)?.matter ?? "body";

  expect(part("Half-title page")).toBe("front");
  expect(part("Title page")).toBe("front");
  expect(part("Copyright page")).toBe("front");
  expect(part("Dedication")).toBe("front");
  // "Preface" is not a title `MATTER_SECTIONS` carries — the slot is "Preface
  // or introduction" — so it lands by way of the alias table, under the
  // catalogue's name rather than the manuscript's.
  expect(part("Preface or introduction")).toBe("front");

  expect(part("Epilogue")).toBe("back");
  expect(part("Acknowledgements")).toBe("back");
  expect(part("Glossary")).toBe("back");
});

it("files a page under the catalogue's name, not the manuscript's", async () => {
  // A Word file shouts its headings. Left alone, `HALF-TITLE PAGE` sat in the
  // panel beside the app's own `Half-title page` as a second, unrelated row —
  // one division showing as two, in two different cases, with nothing matching
  // on name able to see they were the same.
  const book = await importFile(
    asFile(
      "# HALF-TITLE PAGE\n\nThe Lighthouse\n\n# Chapter One\n\nOne.\n\n# GLOSSARY\n\nAmma — mother.",
      "novel.md",
    ),
  );
  const titles = book.chapters.map((c) => c.title);
  expect(titles).toContain("Half-title page");
  expect(titles).toContain("Glossary");
  expect(titles).not.toContain("HALF-TITLE PAGE");
  // A heading it does not recognise keeps its own spelling and its own place.
  expect(titles).toContain("Chapter One");
});

it("leaves the story in the body", async () => {
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"));
  const body = book.chapters.filter((c) => !c.matter).map((c) => c.title);
  // The whole risk of reading headings for a part: a chapter taken out of the
  // book is worse than a page left in it.
  expect(body).toEqual(["Chapter One", "Chapter Two"]);
});

it("keeps the prose with the page it was written on", async () => {
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"));
  const dedication = book.chapters.find((c) => c.title === "Dedication");
  expect(dedication?.matter).toBe("front");
  expect(JSON.stringify(dedication?.doc)).toContain("For everyone who left.");
});

it("does not tag a heading it does not recognise", async () => {
  /* The example was "The End" until that heading joined the import-only
     table - see `IMPORT_ONLY` in matter.ts. What this test protects is
     unchanged, and is the more important half of the rule: a name the
     catalogue does not carry is a *chapter*, and stays where it was put. */
  const book = await importFile(
    asFile("# Chapter One\n\nOne.\n\n# The Last Light\n\nDone.", "novel.md"),
  );
  expect(book.chapters.every((c) => !c.matter)).toBe(true);
});

// --- what the import decided ----------------------------------------------

/**
 * The whole reason this pair exists: a manuscript that closes on "END".
 *
 * Before the import-only table that heading was not in the catalogue, so it was
 * a chapter — the last one — and it spent a chapter number. Everything after a
 * stray like that counts one too high, and the writer sees it as chapter nine
 * printing "Chapter Ten" with nothing on screen saying why.
 */
it("does not make a chapter out of the line a manuscript ends on", async () => {
  const book = await importFile(
    asFile(
      [
        "# Chapter One",
        "The bus reached Mirissa after noon.",
        "# Chapter Two",
        "Arun barely slept.",
        "# END",
        "Thank you for reading.",
      ].join("\n\n"),
      "novel.md",
    ),
  );

  const body = book.chapters.filter((c) => (c.matter ?? "body") === "body");
  expect(body.map((c) => c.title)).toEqual(["Chapter One", "Chapter Two"]);

  // Kept, not dropped — and under the catalogue's spelling rather than the
  // manuscript's shouted one.
  const end = book.chapters.find((c) => c.title === "The End");
  expect(end?.matter).toBe("back");
});

it("counts what an import decided, by part", async () => {
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"));
  const summary = importSummary(book.chapters);

  // Half-title, title, copyright, dedication, preface.
  expect(summary.front).toBe(5);
  expect(summary.body).toBe(2);
  // Epilogue, acknowledgements, glossary.
  expect(summary.back).toBe(3);
  expect(summary.front + summary.body + summary.back).toBe(
    book.chapters.length,
  );
});

it("counts a chapter that says nothing about its part as body", () => {
  // Absence means the body everywhere else in the store, and this has to agree
  // or the banner reports a book the panel does not show.
  expect(importSummary([{}, {}, { matter: "front" }])).toEqual({
    front: 1,
    body: 2,
    back: 0,
  });
  expect(importSummary([])).toEqual({ front: 0, body: 0, back: 0 });
});

// --- what an import says about itself --------------------------------------

it("names the two matter parts as pages and only the body as chapters", () => {
  // The bug this closes: the add-or-replace dialog counted the file's matter
  // pages and called all of them chapters, so eight back-matter pages were
  // announced as "8 chapters" and offered a chapter number.
  expect(summaryParts({ front: 5, body: 2, back: 3 })).toEqual([
    "5 front pages",
    "2 chapters",
    "3 back pages",
  ]);
  expect(summaryParts({ front: 1, body: 1, back: 1 })).toEqual([
    "1 front page",
    "1 chapter",
    "1 back page",
  ]);
});

it("leaves a part with nothing in it out rather than printing a zero", () => {
  // Most imports are chapters and nothing else, and "0 front pages" is noise
  // on the common case.
  expect(summaryParts({ front: 0, body: 12, back: 0 })).toEqual(["12 chapters"]);
  expect(summaryParts({ front: 0, body: 0, back: 8 })).toEqual(["8 back pages"]);
  expect(summaryParts({ front: 0, body: 0, back: 0 })).toEqual([]);
});

it("phrases the count so it can sit inside a sentence", () => {
  expect(summaryPhrase({ front: 0, body: 0, back: 8 })).toBe("8 back pages");
  expect(summaryPhrase({ front: 2, body: 10, back: 0 })).toBe(
    "2 front pages and 10 chapters",
  );
  expect(summaryPhrase({ front: 5, body: 2, back: 3 })).toBe(
    "5 front pages, 2 chapters and 3 back pages",
  );
  // Never an empty string: the callers drop this straight into a sentence.
  expect(summaryPhrase({ front: 0, body: 0, back: 0 })).toBe("nothing");
});

/**
 * **The question is only worth asking when Replace has something to mean.**
 *
 * Replace clears the body and spares every front- and back-matter page, so a
 * file carrying no chapters gives both answers nothing to do: Add would number
 * named pages on from the last chapter, and Replace would delete the writer's
 * chapters in exchange for pages that cannot fill them.
 */
it("asks only when the book has writing and the file has chapters", () => {
  const chapters = { front: 0, body: 3, back: 0 };
  const pagesOnly = { front: 0, body: 0, back: 8 };

  expect(importAsksFirst(true, chapters)).toBe(true);
  // A file of back matter alone goes straight in, whatever is already written.
  expect(importAsksFirst(true, pagesOnly)).toBe(false);
  // An empty book has nothing to lose either way.
  expect(importAsksFirst(false, chapters)).toBe(false);
  expect(importAsksFirst(false, pagesOnly)).toBe(false);
});

// --- importing one part of a book on its own --------------------------------

/**
 * A real back-matter document with **no heading styles at all** — the shape a
 * writer actually produces, and the one the whole-book importer reads as a
 * single page called "Epilogue" because `CHAPTER_LINE` is a closed vocabulary.
 */
const BACK_MATTER = [
  "Epilogue",
  "Six months later, Julian lived in a cabin entirely off the grid.",
  "Afterword",
  "Writing The Code of Echoes was an exercise in exploring control.",
  "Acknowledgements",
  "Thank you to my editor, Sarah Jenkins, for helping me trim the fat.",
  "About the Author",
  "Elias Thorne is a former software engineer who now writes fiction.",
  "Also by the Author",
  "The Silicon Vein. Ghost in the Server. Analog Dreams.",
  "A Word About Reviews",
  "If you enjoyed this short novel, please consider leaving a review.",
  "Excerpt from the next book: The Echo Protocol",
  "The radio static hadn't just been a phantom frequency.",
  "Glossary",
  "Core, The: the centralized quantum processing unit.",
].join("\n\n");

it("opens a page at a division name once the writer has named the part", () => {
  const line = paragraph("Afterword");
  expect(looksLikeMatterLine(line, "back")).toBe(true);
  // Not at the other end of the book, and not a chapter divider on its own.
  expect(looksLikeMatterLine(line, "front")).toBe(false);
  expect(looksLikeChapterLine(line)).toBe(false);
});

/**
 * **This is the test the feature exists for.**
 *
 * Unscoped, the file above splits once — only "Epilogue" is in the standing
 * divider vocabulary, so the other seven divisions arrive buried inside it and
 * the import looks broken when the file was fine. Naming the part is what
 * widens the vocabulary, and it widens it only to that part's own page names.
 */
it("splits a back-matter file the whole-book importer would not", async () => {
  const whole = await importFile(asFile(BACK_MATTER, "back.txt"));
  expect(whole.chapters).toHaveLength(1);

  /* Eight pages, where the whole-book read found one. Seven arrive in the
     catalogue's spelling because `taggedByName` recognised them on the way
     through; the excerpt keeps the writer's own heading, because the general
     rule cannot see past its colon — `partOfImport` is what settles that one,
     and the test below is where it does. */
  const scoped = await importFile(asFile(BACK_MATTER, "back.txt"), "back");
  expect(scoped.chapters.map((c) => c.title)).toEqual([
    "Epilogue",
    "Afterword",
    "Acknowledgements",
    "About the author",
    "Also by the author",
    "A word about reviews",
    "Excerpt from the next book: The Echo Protocol",
    "Glossary",
  ]);
});

it("keeps what belongs to the part and names what does not", async () => {
  const scoped = await importFile(asFile(BACK_MATTER, "back.txt"), "back");
  const { kept, leftOut } = partOfImport(scoped.chapters, "back");

  expect(leftOut).toEqual([]);
  // Every page tagged, and renamed to the catalogue's own spelling.
  expect(kept.every((c) => c.matter === "back")).toBe(true);
  expect(kept.map((c) => c.title)).toEqual([
    "Epilogue",
    "Afterword",
    "Acknowledgements",
    "About the author",
    "Also by the author",
    "A word about reviews",
    "An excerpt from the next book",
    "Glossary",
  ]);
});

it("lands nothing from a manuscript aimed at the wrong card", async () => {
  // The mis-drop. Nothing is forced into the back of the book, and every piece
  // is named rather than dropped in silence.
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"), "back");
  const { kept, leftOut } = partOfImport(book.chapters, "front");

  expect(kept.map((c) => c.title)).toContain("Half-title page");
  expect(leftOut.length).toBeGreaterThan(0);
  expect(leftOut).toContain("Epilogue");
});

it("reads the body as everything the catalogue did not claim", async () => {
  const book = await importFile(asFile(MANUSCRIPT, "novel.md"));
  const { kept, leftOut } = partOfImport(book.chapters, "body");

  expect(kept.every((c) => !c.matter)).toBe(true);
  expect(kept).toHaveLength(importSummary(book.chapters).body);
  expect(leftOut).toContain("Half-title page");
  expect(leftOut).toContain("Glossary");
});
