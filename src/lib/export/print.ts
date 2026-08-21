import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import { chapterNumeral, printsHeading, toBlocks } from "./blocks";
import { printsFolio } from "@/lib/matter";
import { escapeXml, blocksToXhtml } from "./xhtml";
import { trimById, typesetCss, type Trim, type TypesetOptions } from "./typeset";
import { bindBook, frontSections } from "./front-matter";

/**
 * The anchor a contents entry points at. Positional, like the EPUB's files.
 *
 * **The `oc-` is load-bearing and cost a wrong number on every contents page.**
 * These were `page-1`, `page-2`… — and Paged.js gives *its own page elements*
 * exactly those ids. So the document held two `#page-1`s, and the
 * `target-counter` handler resolves an anchor with a bare
 * `querySelector(href)`, which returns the one earlier in the document: the
 * page div. Every entry therefore printed the page whose number happened to
 * equal the chapter's position — Chapter Four read 4 while starting on page 7 —
 * and it looked plausible enough to survive a glance, which is what makes it
 * the worst kind of wrong. Namespaced, nothing of ours can collide with
 * anything of theirs.
 */
const anchorFor = (index: number) => `oc-ch-${index + 1}`;

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
  /**
   * Confine the book's own styling to one element's subtree.
   *
   * The export passes nothing: it renders into a frame of its own where the
   * book is the whole document. The wizard's review renders into the *app's*
   * document — Paged.js lays out against the styles in the document the script
   * is running in — so it passes the host's selector and the app around it is
   * left alone. See `typesetCss`, which is where the two exceptions live.
   */
  scope?: string,
): { content: string; css: string } {
  /* Generated title / copyright / contents pages, then the chapters. Front and
     back matter carry no number — only body chapters do.

     The print path passes an `href` now, where it used to pass nothing on the
     reasoning that "paper has nowhere to go". It still has nowhere to go — the
     anchor is not there to be followed, it is there for `target-counter` to
     find, which is how the folio beside each entry is worked out. `typeset.ts`
     strips the link's colour and underline so it reads as set type. */
  const front = frontSections(book, chapters, typeset, (i) => `#${anchorFor(i)}`);

  /* **The whole book in one bound order**, generated pages among the writer's
     own rather than in a block at the front — see `bindBook`. This used to emit
     the three generated pages and then every chapter in load order, which put a
     book's own half-title behind the contents page. The EPUB has always bound
     them properly; now the same function answers for both, so a PDF and an
     EPUB of one manuscript are the same book. */
  const content = bindBook(chapters, front)
    .map((page) => {
      if (page.kind === "generated") return page.section.html;

      const { chapter, index } = page;
      const xhtml = blocksToXhtml(toBlocks(chapter.doc));
      /* The numeral, by the rule every renderer now shares. It was printed for
         every body chapter here, so a book keeping the default titles opened
         each chapter with a standing "1" above the words "Chapter One". */
      const numeral = chapterNumeral(chapter);
      const number =
        numeral !== null
          ? `\n  <p class="chapter-number">${numeral}</p>`
          : "";
      /* `string-set` on the heading is what feeds the running head: the margin
         box prints whichever chapter title is current on that page. Apparatus
         pages carry none — see `printsHeading` — which also, and rightly,
         leaves the running head naming the last real division rather than
         printing "Copyright page" across the top of the sheet. */
      const heading = printsHeading(chapter)
        ? `\n  <h1>${escapeXml(chapter.title)}</h1>`
        : "";
      /* The anchor keeps the chapter's *loaded* index, never its bound
         position — the contents page's `target-counter` hrefs are built from
         the same index, so renumbering here would point every folio at the
         wrong sheet. */
      /* **A class rather than a position.** The folio used to be dropped by
         `@page :first`, which is right only while the title page is the first
         sheet; a half-title in front of it pushed a number under the book's
         title. `printsFolio` answers for the kind of page instead, and the
         named page in `typesetCss` hangs off this class. */
      const bare = printsFolio(chapter.matter ?? "body", chapter.title)
        ? ""
        : ` class="no-folio"`;
      return `<section id="${anchorFor(index)}"${bare}>${number}${heading}
${xhtml}
</section>`;
    })
    .join("\n");

  return { content, css: typesetCss(typeset, true, scope) };
}

/**
 * Lay the book out on pages inside `into`, and answer how many there were.
 *
 * **Paged.js renders where it is told but writes its stylesheets into the
 * document this script is running in**, and that split is the one thing to
 * know about this integration. CSS does not cross a document boundary, so
 * rendering into an iframe without carrying the styles over leaves correctly
 * paginated pages with nothing styling them — measured, 788px page boxes that
 * should have been 528.
 *
 * Everything Paged.js added is cloned rather than a known subset: it writes
 * more than one sheet, the count and the ids are its business, and a filter
 * here would be a guess about another library's internals that breaks silently
 * when it changes.
 *
 * **What it writes is the *book's* stylesheet, and that is why it may not be
 * left behind.** `typesetCss` is written for a document that is nothing but a
 * book, so it styles bare `body`, `h1` and `p` — and injected into the app's
 * own document those rules restyle the app: measured, the export wizard's own
 * headings came out centred in Georgia small-caps, with `p { text-indent:
 * 1.5em }` on every paragraph of the interface around it. Nothing scopes them,
 * and nothing could: Paged.js relies on those bare rules reaching the pages it
 * renders.
 *
 * So a caller rendering into another document gets the styles moved rather
 * than copied — the frame needs them and this document must not have them.
 * `printBook` used to leave its set in the app for the sixty seconds it waits
 * on the print dialog, which is a wizard that restyles itself after every PDF
 * export.
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

    if (target === document) {
      // Rendering into this very document: the rules have to stay where they
      // are, and the caller takes them out again on the way off screen.
      adoptedStyles.push(style as HTMLStyleElement);
      continue;
    }

    const copy = target.createElement("style");
    copy.textContent = cssTextOf(style as HTMLStyleElement);
    target.head.appendChild(copy);
    // Moved, not copied. See the note above.
    style.remove();
  }

  return { pages: flow.total, adoptedStyles };
}

/**
 * Everything a stylesheet says, including what was never written in its text.
 *
 * **`textContent` is not the stylesheet, and believing it was printed a
 * contents page of zeros.** Paged.js resolves each `target-counter` after the
 * pages are laid out — it finds which page the anchor landed on and then calls
 * `insertRule` to reset that entry's counter (see its
 * `modules/generated-content/target-counters.js`). A rule added that way lives
 * in the CSSOM and never appears in the element's text, so copying the text
 * carried every rule *except* the answers, and in the print frame the counters
 * were never reset. `counter()` on an unset counter is 0 — so every folio in
 * the printed contents read `0`, while the wizard's review, which renders in
 * this same document and needs no copy at all, showed the real numbers. A
 * preview and a file disagreeing about the page numbers is the worst version
 * of that disagreement, because the numbers look plausible in both.
 *
 * Falls back to the text when the sheet cannot be read — a stylesheet that has
 * not been parsed yet has no `cssRules`, and reading one from another origin
 * throws. Neither happens here; both are cheaper to handle than to prove
 * impossible.
 */
function cssTextOf(style: HTMLStyleElement): string {
  const sheet = style.sheet;
  if (!sheet) return style.textContent ?? "";
  try {
    return Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
  } catch {
    return style.textContent ?? "";
  }
}

/** Take Paged.js's stylesheets back out of the app's head. */
export function dropPagedStyles(styles: HTMLStyleElement[]) {
  for (const style of styles) style.remove();
}

/**
 * The PDF, rendered where the page numbers come out right.
 *
 * **The book is laid out by a browser that has nothing else on it**, through
 * `/api/export/pdf`, and what comes back is a file this app can hand over and
 * name. Two things forced the move off the writer's own machine, and neither
 * could be fixed here:
 *
 * - **Every contents folio printed `0`.** Paged.js asks
 *   `window.getComputedStyle(page)` — the *top* window — which page a chapter
 *   landed on, and the pages were inside a hidden iframe. One document cannot
 *   answer for another's elements, so it counted from zero and stopped.
 *   Measured; and carrying its stylesheets across correctly (see `cssTextOf`)
 *   did not help, because the numbers were already wrong when they were
 *   written down.
 * - **A print dialog is not an export.** Whether a file was saved, or under
 *   what name, was never knowable — so this answered `null` and the writer got
 *   no confirmation at all.
 *
 * **The dialog is still the fallback and that is deliberate.** A copy of this
 * app with no browser configured behind the route answers 501, and everything
 * below runs exactly as it did — the same iframe, the same `window.print()`.
 * That path still returns `null`, because on that path the outcome still is not
 * ours to state. So the return type says which happened: a blob is a file we
 * produced, `null` is a dialog we opened.
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
): Promise<Blob | null> {
  const doc = printDocument(book, chapters, typeset);

  /* The rendered file, when there is a browser behind the route. Any failure
     at all — no Chrome configured, a layout that fell over, an offline
     machine — falls through to the dialog rather than to an error, because the
     dialog is a working export and this is an improvement on it. */
  const rendered = await renderOnServer(doc, book.title, trimById(typeset.trim));
  if (rendered) return rendered;

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

  /* A dialog, not a file. What the writer did with it is theirs and unknowable
     from here, so nothing is claimed — see `ExportDoneDialog`. */
  return null;
}

/**
 * Ask the server for the finished PDF, or answer null and let the dialog do it.
 *
 * **Every failure is a fallback rather than an error**, which is what makes
 * this safe to put in front of a working export: an installation with no
 * browser configured answers 501, a machine with no network throws, a book
 * that will not lay out answers 500, and all three land on the print dialog
 * that has always been here. The writer's export never fails because of this
 * route; at worst it happens the old way.
 *
 * The manuscript goes, as typeset markup. That is stated on the export screen
 * before the press and on `/privacy`, and it is the only route in this app that
 * carries the whole book.
 */
async function renderOnServer(
  doc: { content: string; css: string },
  title: string,
  /* The trim goes explicitly rather than being read back out of the CSS: Paged.js
     rewrites the `@page` rule it is given, so the size in the stylesheet is not
     the size Chrome ends up seeing. See `pageSize` in the route. */
  trim: Trim,
): Promise<Blob | null> {
  try {
    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...doc,
        title,
        width: trim.width,
        height: trim.height,
      }),
    });
    if (!response.ok) {
      // 501 is the expected answer on an installation without a browser, and
      // is not worth a console error; anything else is worth knowing about.
      if (response.status !== 501) {
        console.error("[export] the PDF route refused", response.status);
      }
      return null;
    }
    const blob = await response.blob();
    // A zero-length body is a failure that answered 200; treat it as one.
    return blob.size > 0 ? blob : null;
  } catch (err) {
    console.error("[export] could not reach the PDF route", err);
    return null;
  }
}
