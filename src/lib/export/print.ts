import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { toBlocks } from "./blocks";
import { escapeXml, blocksToXhtml } from "./xhtml";
import { typesetCss, type TypesetOptions } from "./typeset";
import { frontSections } from "./front-matter";

/** The anchor a contents entry points at. Positional, like the EPUB's files. */
const anchorFor = (index: number) => `page-${index + 1}`;

/**
 * A PDF, paginated by Paged.js and written by the browser.
 *
 * **Two engines, and the split is the point.** A browser already contains a
 * typesetter that breaks lines, keeps widows and orphans honest, embeds fonts
 * and writes PDF; replacing that with a PDF library would mean owning
 * line-breaking and justification, and the output would be worse. What the
 * browser does *not* do is paged media: `@page` margin boxes, running heads
 * that name the current chapter, and — the one that matters — the page number
 * of a cross-reference. So Paged.js does the pagination and the browser still
 * writes the bytes.
 *
 * What that buys, all of it previously impossible:
 *
 * - **A contents page with real folios.** `target-counter()` resolves each
 *   entry against the chapter's own anchor, so the numbers are the pages the
 *   chapters actually land on. This was the honest reason the contents list
 *   carried no page numbers: Chrome does not implement `target-counter`, and a
 *   guessed folio sends a reader to the wrong page.
 * - **Running heads in the margin box** rather than a `position: fixed` element
 *   floated over the text, which is what this used before.
 * - **A page number on every page.**
 *
 * What it still is not: "print-ready" in the trade sense. There is no bleed, no
 * crop marks and no CMYK — the last is a property of the PDF the browser
 * writes, and no amount of pagination changes it. Every screen that names this
 * export still says so.
 *
 * Rendered into a hidden iframe rather than the page itself. Printing the app
 * would carry the rails, the panel and the editor's chrome into the PDF, and
 * unpicking that with print styles is a far worse job than building the
 * document we actually want.
 */
export async function printBook(
  book: Book,
  chapters: LoadedChapter[],
  typeset: TypesetOptions,
): Promise<void> {
  /* Generated title / copyright / contents pages, then the chapters. Front and
     back matter carry no number — only body chapters do.

     The print path passes an `href` now, where it used to pass nothing on the
     reasoning that "paper has nowhere to go". It still has nowhere to go — the
     anchor is not there to be followed, it is there for `target-counter` to
     find, which is how the folio beside each entry is worked out. `typeset.ts`
     strips the link's colour and underline so it reads as set type. */
  const front = frontSections(book, chapters, typeset, (i) => `#${anchorFor(i)}`)
    .map((s) => s.html)
    .join("\n");

  const body = chapters
    .map((chapter, i) => {
      const xhtml = blocksToXhtml(toBlocks(chapter.doc));
      const number =
        chapter.number !== null
          ? `\n  <p class="chapter-number">${chapter.number}</p>`
          : "";
      /* `string-set` on the heading is what feeds the running head: the margin
         box prints whichever chapter title is current on that page. */
      return `<section id="${anchorFor(i)}">${number}
  <h1>${escapeXml(chapter.title)}</h1>
${xhtml}
</section>`;
    })
    .join("\n");

  const content = `${front}\n${body}`;
  const css = typesetCss(typeset, true);

  const frame = document.createElement("iframe");
  /* Off-screen and *sized*, not 0×0. A frame with no width has no width to
     break lines against, and Paged.js measures the real box to decide where a
     page ends — at zero it would paginate against nothing. `visibility:hidden`
     would do the same. Far off-screen keeps it laying out while staying out of
     the writer's way. */
  frame.setAttribute(
    "style",
    "position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;",
  );
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Could not open a print view.");
  }

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeXml(
      book.title,
    )}</title></head><body></body></html>`,
  );
  doc.close();

  /* Loaded here rather than at the top of the file: it is the better part of a
     megabyte, and a writer who never exports a PDF should never download it —
     the rule `docx` and `jszip` already follow. */
  const { Previewer } = await import("pagedjs");

  /* **Paged.js renders into the iframe but writes its stylesheets into *this*
     document**, and that split is the one thing to know about this integration.
     `preview()` puts the finished `.pagedjs_page` boxes wherever it is told,
     and CSS does not cross a document boundary — so without the copy below the
     iframe holds correctly paginated pages with nothing styling them, and the
     PDF comes out as unstyled running text. Measured: 788px-wide page boxes
     that should have been 528px.

     Everything is cloned rather than a known subset: Paged.js writes more than
     one sheet, the count and the ids are its business, and a filter here would
     be a guess about another library's internals that breaks silently when it
     changes. Marked so the cleanup below can find them again. */
  const before = new Set(document.querySelectorAll("style"));

  await new Previewer().preview(content, [{ _: css }], doc.body);

  for (const style of document.querySelectorAll("style")) {
    if (before.has(style)) continue;
    style.dataset.ocPrint = "1";
    const copy = doc.createElement("style");
    copy.textContent = style.textContent;
    doc.head.appendChild(copy);
  }

  /* The frame's own stylesheets are gone once it is removed, but Paged.js's are
     in the *app's* head and would otherwise stay there for the rest of the
     session — a second export would then stack another copy. */
  const cleanUp = () => {
    for (const style of document.querySelectorAll<HTMLStyleElement>(
      "style[data-oc-print]",
    )) {
      style.remove();
    }
    frame.remove();
  };

  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  // Long enough for the print dialog to have taken its snapshot. Removing the
  // frame while the dialog is still open cancels the job in some browsers.
  window.setTimeout(cleanUp, 60_000);
}
