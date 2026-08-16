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
import { loadChapters } from "@/lib/export";
import { buildEpub, spineOrder } from "@/lib/export/epub";
import { printDocument } from "@/lib/export/print";
import { bindBook, frontSections } from "@/lib/export/front-matter";
import { DEFAULT_TYPESET } from "@/lib/export/typeset";
import type { LoadedChapter } from "@/lib/export/blocks";

/**
 * One manuscript, one book — whichever button is pressed.
 *
 * **This is the test that would have caught the drift, and there was no test
 * shaped like it.** Every renderer had its own passing tests and each was
 * right about itself; what nothing asked was whether they agreed. They did
 * not: on a book carrying its own half-title the EPUB bound the generated
 * title page *after* it, as a printed book does, while the PDF, the Word file
 * and the wizard's own EPUB preview each emitted the three generated pages
 * first and left the half-title stranded behind the contents. The chapter
 * openers disagreed the same way — one numeral, two numerals, or none,
 * depending on the format.
 *
 * So these compare the formats against each other rather than against a fixed
 * string. A future change that moves the order is welcome to move it; what it
 * may not do is move it in one place. Nothing here asserts a *look*, because
 * the formats genuinely differ there — a PDF has pages and an EPUB reflows —
 * only that the same pages come out in the same order with the same openers.
 */

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

/** A book with front matter of its own, so the binding order has work to do. */
function boundBook() {
  const { bookId, chapterId } = createBook("The Salt Road", {
    author: "M. Reyes",
    genre: "Fantasy",
  });

  createMatterPages(bookId, [
    { part: "front", title: "Half-title page" },
    { part: "front", title: "Dedication" },
    { part: "front", title: "Prologue" },
    { part: "back", title: "Acknowledgements" },
  ]);

  const shelf = findBook(getShelf(), bookId)!;
  const idOf = (title: string) =>
    shelf.chapters.find((c) => c.title === title)!.id;

  // Filled in, or `loadChapters` drops them as untouched scaffolding.
  saveBody(bookId, idOf("Half-title page"), doc(p("The Salt Road")), 3);
  saveBody(bookId, idOf("Dedication"), doc(p("For Nadia.")), 2);
  saveBody(bookId, idOf("Prologue"), doc(p("Rain, an hour before dawn.")), 5);
  saveBody(bookId, idOf("Acknowledgements"), doc(p("Thanks to Ana and Bo.")), 5);

  const second = createChapter(bookId);
  const third = createChapter(bookId);
  // One chapter keeps the default title and one is named, which is the whole
  // of what the numeral rule turns on.
  renameChapter(bookId, third, "The Fourth Lamp");
  for (const id of [chapterId, second, third]) {
    saveBody(bookId, id, doc(p("The harbour smelled of tar.")), 6);
  }

  return findBook(getShelf(), bookId)!;
}

beforeEach(() => {
  localStorage.clear();
});

/** The pages the PDF lays out, in order, named the way the EPUB names them. */
function pdfOrder(chapters: LoadedChapter[], html: string): string[] {
  const out: string[] = [];
  for (const part of html.split(/(?=<section[ >])/)) {
    if (!part.startsWith("<section")) continue;
    const generated = /class="front-page ([a-z-]+)"/.exec(part);
    if (generated) {
      out.push(generated[1] === "title-page" ? "title" : generated[1]);
      continue;
    }
    const anchor = /id="oc-ch-(\d+)"/.exec(part);
    out.push(chapters[Number(anchor![1]) - 1].title);
  }
  return out;
}

it("binds the PDF and the EPUB in the same order", async () => {
  const book = boundBook();
  const chapters = loadChapters(book);

  const { content } = printDocument(book, chapters, DEFAULT_TYPESET);
  const pdf = pdfOrder(chapters, content);

  // The EPUB's spine, read back as titles so the two lists are comparable.
  const front = frontSections(book, chapters, DEFAULT_TYPESET);
  const spine = spineOrder(
    chapters.map((c) => ({
      title: c.title,
      xhtml: "",
      ...(c.matter ? { matter: c.matter } : {}),
    })),
    front.map((s) => s.id),
  );
  const epub = spine.map((id) => {
    const at = /^chapter-(\d+)$/.exec(id);
    return at ? chapters[Number(at[1]) - 1].title : id;
  });

  expect(pdf).toEqual(epub);
  // And it is the order a book is bound in, not the order it was stored in.
  expect(pdf).toEqual([
    "Half-title page",
    "title",
    "copyright",
    "Dedication",
    "contents",
    "Prologue",
    "Chapter One",
    "Chapter Two",
    "The Fourth Lamp",
    "Acknowledgements",
  ]);
});

it("opens every chapter the same way in the PDF and the EPUB", async () => {
  const book = boundBook();
  const chapters = loadChapters(book);

  const { content } = printDocument(book, chapters, DEFAULT_TYPESET);
  const inPdf = [...content.matchAll(/class="chapter-number">(\d+)</g)].map(
    (m) => m[1],
  );

  const blob = await buildEpub(book, chapters, DEFAULT_TYPESET, {});
  const text = await blob.text();
  const inEpub = [...text.matchAll(/class="chapter-number">(\d+)</g)].map(
    (m) => m[1],
  );

  expect(inPdf).toEqual(inEpub);
  // Only the named chapter carries one: the other two *are* their numbers.
  expect(inPdf).toEqual(["3"]);
});

it("shows the wizard's EPUB preview the order the packager writes", () => {
  const book = boundBook();
  const chapters = loadChapters(book);

  /* The preview builds its sheets straight from `bindBook`, exactly as
     `review-pane.tsx` does. Asserting the shared call is what stops the two
     coming apart again — the preview used to list the generated pages first
     and so showed a first page the file does not have. */
  const preview = bindBook(
    chapters,
    frontSections(book, chapters, DEFAULT_TYPESET),
  ).map((page) =>
    page.kind === "generated" ? page.section.id : page.chapter.title,
  );

  expect(preview[0]).toBe("Half-title page");
  expect(preview.indexOf("title")).toBe(1);
  expect(preview.indexOf("contents")).toBeLessThan(
    preview.indexOf("Prologue"),
  );
});
