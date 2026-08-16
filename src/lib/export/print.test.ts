import { expect, it } from "vitest";
import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { DEFAULT_TYPESET } from "./typeset";
import { printDocument } from "./print";

const book: Book = {
  id: "b",
  title: "Salt Ledger",
  subtitle: "",
  author: "Marguerite Hale",
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
};

const doc = { type: "doc", content: [] };
const chapters: LoadedChapter[] = [
  { title: "Chapter One", doc, number: 1 },
  { title: "Chapter Two", doc, number: 2 },
];

/**
 * **The anchor names are namespaced, and this is the test not to "fix".**
 *
 * Paged.js gives its own page elements `id="page-1"`, `id="page-2"`… and its
 * `target-counter` handler resolves a contents entry with a bare
 * `querySelector(href)` — which returns whichever match comes first in the
 * document, and the pages always do. While our chapter sections were also
 * called `page-N`, every folio on the contents page silently became the
 * chapter's *position* rather than its page: Chapter Four printed 4 and
 * started on page 7.
 *
 * A wrong number that looks right is worse than no number, and this one sits
 * under a caption promising the pages the chapters actually land on. So the
 * prefix is asserted rather than trusted.
 */
it("names chapter anchors out of Paged.js's own id space", () => {
  const { content } = printDocument(book, chapters, DEFAULT_TYPESET);

  expect(content).toContain('id="oc-ch-1"');
  expect(content).toContain('id="oc-ch-2"');
  expect(content).not.toMatch(/id="page-\d+"/);
});

/**
 * **The four renderers have to agree about which pages are headed**, and for a
 * long time three of them did not: the EPUB suppressed a heading on apparatus
 * while the PDF, the Word file and the markdown printed one, so a single book
 * came out of this app with a sheet headed "Copyright page" in three formats
 * and set correctly in the fourth. `printsHeading` is the one rule now, and
 * these guard the two ends of it.
 */
it("prints no heading on an apparatus page", () => {
  const { content } = printDocument(
    book,
    [
      { title: "Copyright page", doc, number: null, matter: "front" },
      { title: "Chapter One", doc, number: 1 },
    ],
    DEFAULT_TYPESET,
  );

  expect(content).not.toContain("<h1>Copyright page</h1>");
  expect(content).toContain("<h1>Chapter One</h1>");
});

it("keeps the heading on a real division of the book", () => {
  const { content } = printDocument(
    book,
    [
      { title: "Dedication", doc, number: null, matter: "front" },
      { title: "About the author", doc, number: null, matter: "back" },
    ],
    DEFAULT_TYPESET,
  );

  expect(content).toContain("<h1>Dedication</h1>");
  expect(content).toContain("<h1>About the author</h1>");
});

it("points every contents entry at an anchor that exists", () => {
  const { content } = printDocument(book, chapters, {
    ...DEFAULT_TYPESET,
    contents: true,
  });

  const hrefs = [...content.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const id of hrefs) expect(content).toContain(`id="${id}"`);
});
