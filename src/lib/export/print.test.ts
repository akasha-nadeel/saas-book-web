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

it("points every contents entry at an anchor that exists", () => {
  const { content } = printDocument(book, chapters, {
    ...DEFAULT_TYPESET,
    contents: true,
  });

  const hrefs = [...content.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const id of hrefs) expect(content).toContain(`id="${id}"`);
});
