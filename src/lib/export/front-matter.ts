import type { Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import type { TypesetOptions } from "./typeset";
import { escapeXml } from "./xhtml";

/**
 * The book's generated front matter — the pages a writer does not type but a
 * finished book has: a title page, a copyright page, a contents list.
 *
 * Format-neutral XHTML, so the same section serves the PDF (printed inline) and
 * the EPUB (each its own file in the spine). Which pages appear is the writer's
 * choice, made in the export dialog; a page with nothing to say — a copyright
 * with no name — is left out rather than printed blank.
 */

export interface FrontSection {
  /** Stable id for the EPUB filename and spine. */
  id: string;
  /** The <section> markup, styled by typeset.ts. */
  html: string;
}

function titlePage(book: Book): string {
  const subtitle = book.subtitle
    ? `\n    <p class="book-subtitle">${escapeXml(book.subtitle)}</p>`
    : "";
  const author = book.author
    ? `\n    <p class="book-author">${escapeXml(book.author)}</p>`
    : "";
  return `<section class="front-page title-page">
    <p class="book-title">${escapeXml(book.title)}</p>${subtitle}${author}
  </section>`;
}

function copyrightPage(book: Book): string {
  const year = new Date().getFullYear();
  const holder = book.author?.trim() || book.title;
  return `<section class="front-page copyright">
    <p>${escapeXml(book.title)}</p>
    <p>Copyright &#169; ${year} ${escapeXml(holder)}</p>
    <p>All rights reserved.</p>
    <p>No part of this book may be reproduced in any form without written permission from the author, except brief quotations in a review.</p>
  </section>`;
}

function contentsPage(chapters: LoadedChapter[]): string {
  const items = chapters
    .map(
      (c) =>
        `      <li>${c.number !== null ? `${c.number}. ` : ""}${escapeXml(c.title)}</li>`,
    )
    .join("\n");
  return `<section class="front-page contents">
    <h1>Contents</h1>
    <ol>
${items}
    </ol>
  </section>`;
}

/**
 * The chosen front-matter sections, in the order they appear in a book: title,
 * then copyright, then contents. `chapters` is the book's ordered chapters, used
 * to build the contents list.
 */
export function frontSections(
  book: Book,
  chapters: LoadedChapter[],
  options: TypesetOptions,
): FrontSection[] {
  const sections: FrontSection[] = [];
  if (options.titlePage) sections.push({ id: "title", html: titlePage(book) });
  if (options.copyright)
    sections.push({ id: "copyright", html: copyrightPage(book) });
  if (options.contents)
    sections.push({ id: "contents", html: contentsPage(chapters) });
  return sections;
}
