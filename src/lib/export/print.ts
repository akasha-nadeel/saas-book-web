import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { toBlocks } from "./blocks";
import { escapeXml, blocksToXhtml } from "./xhtml";
import { typesetCss, type TypesetOptions } from "./typeset";
import { frontSections } from "./front-matter";

/**
 * A PDF, by way of the browser's own print engine.
 *
 * No PDF library. A browser already contains a typesetter that paginates, keeps
 * widows and orphans honest, embeds fonts and writes PDF — adding a megabyte of
 * JavaScript to do a worse job of it would be a strange trade.
 *
 * What this is not: "print-ready" in the trade sense. There is no bleed, no
 * crop marks and no CMYK, because a browser cannot produce them. It sets the
 * trim size through @page and produces a clean interior PDF, which is what a
 * writer proofing their book actually wants; a printer's file is a conversation
 * with the printer.
 *
 * Rendered into a hidden iframe rather than the page itself. Printing the app
 * would carry the rails, the panel and the editor's chrome into the PDF, and
 * unpicking that with print styles is a far worse job than building the
 * document we actually want.
 */
export function printBook(
  book: Book,
  chapters: LoadedChapter[],
  typeset: TypesetOptions,
): void {
  // Generated title / copyright / contents pages, then the chapters. Front and
  // back matter carry no number — only body chapters do.
  const front = frontSections(book, chapters, typeset)
    .map((s) => s.html)
    .join("\n");

  const body = chapters
    .map((chapter) => {
      const xhtml = blocksToXhtml(toBlocks(chapter.doc));
      const number =
        chapter.number !== null
          ? `\n  <p class="chapter-number">${chapter.number}</p>`
          : "";
      return `<section>${number}
  <h1>${escapeXml(chapter.title)}</h1>
${xhtml}
</section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(book.title)}</title>
    <style>${typesetCss(typeset, true)}</style>
  </head>
  <body>
    ${front}
    ${body}
  </body>
</html>`;

  const frame = document.createElement("iframe");
  // Off-screen rather than display:none — a hidden frame does not lay out, and
  // a frame that has not laid out has nothing to paginate.
  frame.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;",
  );
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Could not open a print view.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Long enough for the print dialog to have taken its snapshot. Removing the
    // frame while the dialog is still open cancels the job in some browsers.
    window.setTimeout(() => frame.remove(), 60_000);
  };

  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}
