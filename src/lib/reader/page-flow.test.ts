import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/library-store";
import { DEFAULT_TYPESET } from "@/lib/export/typeset";
import { boundReaderPages, type LoadedPage } from "@/lib/reader/bound-pages";
import { withFolios } from "@/lib/reader/page-flow";

/**
 * Page numbers on a previewed contents page.
 *
 * `paginate` itself needs real layout and jsdom has none, so what is tested
 * here is the half that does not: turning a laid-out book into the numbers the
 * contents prints. The rest of the module is exercised through the browser.
 */

const book: Book = {
  id: "b",
  title: "The Salt Ledger",
  author: "Ada Vance",
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 0,
};

const page = (
  id: string,
  title: string,
  matter: "front" | "body" | "back",
  number: number | null = null,
): LoadedPage => ({
  id,
  title,
  matter,
  number,
  label: null,
  html: `<p>${title}</p>`,
});

/** The generated contents, as it leaves `frontSections` for a screen. */
function contentsHtml(pages: LoadedPage[]): string {
  const bound = boundReaderPages(book, pages, DEFAULT_TYPESET);
  const contents = bound.find((p) => p.id === "generated:contents");
  if (!contents) throw new Error("no contents page was generated");
  return contents.html;
}

describe("the contents page a screen gets", () => {
  it("carries a leader and an empty folio slot for each chapter", () => {
    /* Empty because nothing can know the numbers yet: the contents is one of
       the pages being measured. It used to be a bare <li> with no leader, which
       made the previewed contents a visibly different page from the printed
       one. */
    const html = contentsHtml([
      page("c1", "The Fourth Lamp", "body", 1),
      page("c2", "Salt and Iron", "body", 2),
    ]);

    expect(html).toContain('<span class="toc-dots"></span>');
    expect(html).toContain('<span class="toc-folio" data-page-of="0"></span>');
    expect(html).toContain('<span class="toc-folio" data-page-of="1"></span>');
  });

  it("names the loaded index, not the bound position", () => {
    /* The exporters name their files and anchors positionally and a bound order
       must never renumber them — the same rule `BoundPage.index` carries. Here a
       half-title takes bound position 0 while the first chapter is loaded index
       1, and the slot has to say 1. */
    const html = contentsHtml([
      page("h", "Half-title page", "front"),
      page("c1", "The Fourth Lamp", "body", 1),
    ]);

    // Apparatus is not listed at all, so the only slot is the chapter's.
    expect(html).not.toContain("Half-title");
    expect(html).toContain('data-page-of="1"');
  });
});

describe("withFolios", () => {
  const html =
    '<ol><li><span class="toc-line"><span class="toc-title">One</span>' +
    '<span class="toc-dots"></span>' +
    '<span class="toc-folio" data-page-of="0"></span></span></li>' +
    '<li><span class="toc-line"><span class="toc-title">Two</span>' +
    '<span class="toc-dots"></span>' +
    '<span class="toc-folio" data-page-of="1"></span></span></li></ol>';

  it("writes the measured page into each slot", () => {
    const filled = withFolios(html, (source) => (source === 0 ? 4 : 11));

    expect(filled).toContain(">4</span>");
    expect(filled).toContain(">11</span>");
  });

  it("leaves a slot empty rather than guessing", () => {
    /* An entry with no number reads as a gap; a wrong number reads as a fact.
       The house rule about invented figures, on the one page where a plausible
       wrong number would be completely believable. */
    const filled = withFolios(html, (source) => (source === 0 ? 4 : null));

    expect(filled).toContain(">4</span>");
    expect(filled).toContain('data-page-of="1"></span>');
  });

  it("leaves markup with no slots exactly as it was", () => {
    // Every other page in the book goes through the same call.
    const prose = "<p>Maya met Ethan on a rainy evening.</p>";
    expect(withFolios(prose, () => 3)).toBe(prose);
  });
});
