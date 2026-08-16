import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { toBlocks } from "./blocks";
import { escapeXml, blocksToXhtml } from "./xhtml";
import { typesetCss, type TypesetOptions } from "./typeset";
import { frontSections } from "./front-matter";

/** The anchor a contents entry points at. Positional, like the EPUB's files. */
const anchorFor = (index: number) => `page-${index + 1}`;

/**
 * The document the PDF is made of: its markup and its stylesheet.
 *
 * Pulled out so the review screen and the export can never show different
 * books. A preview built from a second code path is a preview that drifts —
 * it agrees on the day it is written and quietly stops agreeing later, which
 * is the one thing a "check before you export" step must not do. Both callers
 * take this and hand it to `paginate` below.
 */
export function printDocument(
  book: Book,
  chapters: LoadedChapter[],
  typeset: TypesetOptions,
): { content: string; css: string } {
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

  return { content: `${front}\n${body}`, css: typesetCss(typeset, true) };
}

/**
 * Lay the book out on pages inside `into`, and answer how many there were.
 *
 * **Paged.js renders where it is told but writes its stylesheets into the
 * document this script is running in**, and that split is the one thing to
 * know about this integration. CSS does not cross a document boundary, so
 * rendering into an iframe without carrying the styles over leaves correctly
 * paginated pages with nothing styling them — measured, 788px page boxes that
 * should have been 528. Rendering into *this* document needs no copy at all,
 * which is why the review screen passes an element of its own and only the
 * print path pays for the copying.
 *
 * Everything Paged.js added is cloned rather than a known subset: it writes
 * more than one sheet, the count and the ids are its business, and a filter
 * here would be a guess about another library's internals that breaks silently
 * when it changes.
 */
export async function paginate(
  { content, css }: { content: string; css: string },
  into: HTMLElement,
): Promise<{ pages: number; adoptedStyles: HTMLStyleElement[] }> {
  /* Loaded here rather than at the top of the file: it is the better part of a
     megabyte, and a writer who never exports a PDF should never download it —
     the rule `docx` and `jszip` already follow. */
  const { Previewer } = await import("pagedjs");

  const before = new Set(document.querySelectorAll("style"));
  const flow = await new Previewer().preview(content, [{ _: css }], into);

  const adoptedStyles: HTMLStyleElement[] = [];
  const target = into.ownerDocument;
  for (const style of document.querySelectorAll("style")) {
    if (before.has(style)) continue;
    (style as HTMLStyleElement).dataset.ocPrint = "1";
    adoptedStyles.push(style as HTMLStyleElement);
    if (target === document) continue; // Same document: already in effect.
    const copy = target.createElement("style");
    copy.textContent = style.textContent;
    target.head.appendChild(copy);
  }

  return { pages: flow.total, adoptedStyles };
}

/** Take Paged.js's stylesheets back out of the app's head. */
export function dropPagedStyles(styles: HTMLStyleElement[]) {
  for (const style of styles) style.remove();
}

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
  const doc = printDocument(book, chapters, typeset);

  const frame = document.createElement("iframe");
  /* Off-screen and *sized*, not 0x0. A frame with no width has no width to
     break lines against, and Paged.js measures the real box to decide where a
     page ends - at zero it would paginate against nothing. `visibility:hidden`
     would do the same. Far off-screen keeps it laying out while staying out of
     the writer's way. */
  frame.setAttribute(
    "style",
    "position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;",
  );
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const inner = frame.contentDocument;
  if (!inner) {
    frame.remove();
    throw new Error("Could not open a print view.");
  }

  inner.open();
  inner.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeXml(
      book.title,
    )}</title></head><body></body></html>`,
  );
  inner.close();

  const { adoptedStyles } = await paginate(doc, inner.body);

  /* Paged.js's stylesheets are in the *app's* head, not the frame's, and would
     otherwise stay there for the rest of the session - a second export would
     stack another copy. */
  const cleanUp = () => {
    dropPagedStyles(adoptedStyles);
    frame.remove();
  };

  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  // Long enough for the print dialog to have taken its snapshot. Removing the
  // frame while the dialog is still open cancels the job in some browsers.
  window.setTimeout(cleanUp, 60_000);
}
