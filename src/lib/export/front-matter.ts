import { isGenericChapterTitle, type Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import type { TypesetOptions } from "./typeset";
import { escapeXml } from "./xhtml";
import { isApparatusPage } from "@/lib/matter";

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

/**
 * The copyright page.
 *
 * Only ever called with an author — see `frontSections`. It used to fall back
 * to the *title* as the rights holder when the author was blank, which printed
 * "Copyright © 2026 Untitled" onto the second page of a finished book: a legal
 * statement naming the wrong party, which is worse than no page at all.
 *
 * The publisher and ISBN lines are printed only when there are any. A book with
 * no imprint is self-published, and saying so is the writer's business rather
 * than ours.
 *
 * **The fiction disclaimer is printed only for a book that is fiction.** It is
 * the standard line and a reviewer expects it — but "Names, characters, places
 * and incidents are the product of the author's imagination" printed at the
 * front of somebody's memoir is a statement that their life did not happen.
 * `Memoir` and `Other` therefore get the page without it; a writer of
 * narrative non-fiction can type their own disclaimer on a front-matter page,
 * where a wrong one generated for them could not be found and removed.
 */
function copyrightPage(book: Book, holder: string): string {
  const year = new Date().getFullYear();
  const publisher = book.publishing?.publisher?.trim();
  const isbn = book.publishing?.isbn?.trim();
  const fiction = book.genre !== "Memoir" && book.genre !== "Other";
  const lines = [
    `<p>${escapeXml(book.title)}</p>`,
    `<p>Copyright &#169; ${year} ${escapeXml(holder)}</p>`,
    `<p>All rights reserved.</p>`,
    `<p>No part of this book may be reproduced in any form without written permission from the author, except brief quotations in a review.</p>`,
    fiction
      ? `<p>This is a work of fiction. Names, characters, places and incidents are the product of the author&#8217;s imagination or are used fictitiously.</p>`
      : null,
    publisher ? `<p>Published by ${escapeXml(publisher)}</p>` : null,
    isbn ? `<p>ISBN ${escapeXml(isbn)}</p>` : null,
  ].filter(Boolean);
  return `<section class="front-page copyright">
    ${lines.join("\n    ")}
  </section>`;
}

/**
 * The visible contents.
 *
 * **`href` is what makes this a table of contents rather than a list of
 * names.** In a printed book the page number is the link; on an e-reader there
 * are no page numbers, so a contents page that cannot be tapped is one a
 * reader looks at once and never opens again. The EPUB passes each chapter's
 * own file; the print PDF passes nothing, because paper has nowhere to go and
 * an anchor there would be a dead blue word.
 *
 * The numeral is dropped when the title already carries it — "1. Chapter One"
 * says the same thing twice, and "Chapter One" is this app's own default
 * title, so nearly every book exported it that way.
 */
function contentsPage(
  chapters: LoadedChapter[],
  href?: (index: number) => string,
): string {
  /* **Apparatus is not listed**, and a contents page listing itself least of
     all. Filtered rather than sliced, and the *original* index is what the href
     is built from: the exporters name files positionally, so a page left off
     this list still has to point at the file it actually is. */
  const items = chapters
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !isApparatusPage(c.matter ?? "body", c.title))
    .map(({ c, i }) => {
      const numbered = c.number !== null && !isGenericChapterTitle(c.title);
      const label = `${numbered ? `${c.number}. ` : ""}${escapeXml(c.title)}`;
      return `      <li>${href ? `<a href="${href(i)}">${label}</a>` : label}</li>`;
    })
    .join("\n");
  return `<section class="front-page contents">
    <h1>Contents</h1>
    <ol>
${items}
    </ol>
  </section>`;
}

/**
 * The generated pages a writer has already written for themselves.
 *
 * **Three of these pages can come from either side**, and until front matter
 * became a list of pages only one side existed. Now a writer can hold a page
 * called "Title page" and leave the Title page switch on, and get two — one
 * theirs, one ours, on consecutive sheets, which is the kind of thing a shop's
 * reviewer notices and a writer does not until it is listed.
 *
 * So a written page wins and the generated one stands down. That way round
 * because ours is the fallback: it is assembled from fields, it exists so that
 * a book which said nothing still opens properly, and the moment somebody has
 * set their own words on the page there is nothing left for it to add.
 *
 * Matched by title, which is what the writer sees and what `MATTER_SECTIONS`
 * offers — so ticking "Copyright page" in the setup dialog is enough, and
 * renaming it to "Copyright and permissions" hands the job back to us, which is
 * the safe direction to be wrong in.
 *
 * `chapters` has already had its untouched pages filtered out (see
 * `loadChapters`), so a page that is still all `[placeholders]` does not count
 * as written and does not silence anything.
 */
export const GENERATED_BY_TITLE: Record<string, string> = {
  "title page": "title",
  "copyright page": "copyright",
  "table of contents": "contents",
};

/** Which generated pages this book already has a written page for. Exported
 *  so the export screen can say so beside the switch rather than leaving a
 *  writer to notice the missing page in the finished file. */
export function writtenPages(chapters: LoadedChapter[]): Set<string> {
  const out = new Set<string>();
  for (const chapter of chapters) {
    if (chapter.matter !== "front") continue;
    const id = GENERATED_BY_TITLE[chapter.title.trim().toLowerCase()];
    if (id) out.add(id);
  }
  return out;
}

/**
 * The chosen front-matter sections, in the order they appear in a book: title,
 * then copyright, then contents. `chapters` is the book's ordered chapters, used
 * to build the contents list — and to see which of these pages the writer has
 * already written for themselves.
 */
export function frontSections(
  book: Book,
  chapters: LoadedChapter[],
  options: TypesetOptions,
  /** Where each chapter lives, when the format has somewhere to link to. */
  href?: (index: number) => string,
): FrontSection[] {
  const written = writtenPages(chapters);
  const sections: FrontSection[] = [];
  if (options.titlePage && !written.has("title"))
    sections.push({ id: "title", html: titlePage(book) });

  /* **No author, no copyright page** — the one case where asking for a page
     produces none. A copyright notice names who holds the rights; with nobody
     to name, the old code put the *title* there, so a book exported before the
     author field was filled in carried "Copyright © 2026 Untitled" as its
     second page. A missing page is a gap the writer can see and fill. A page
     asserting the wrong rights holder is one they have to already know is
     wrong. The export screen says so beside the toggle. */
  const holder = book.author?.trim();
  if (options.copyright && holder && !written.has("copyright"))
    sections.push({ id: "copyright", html: copyrightPage(book, holder) });

  /* The contents is the one that stands down least readily, and deliberately:
     a hand-written contents page in an EPUB cannot be tapped, and this one
     links. It still yields — a writer who wrote their own meant it — but note
     that the *nav document* is written either way, so the reader's own
     contents menu is never lost with it. */
  if (options.contents && !written.has("contents"))
    sections.push({ id: "contents", html: contentsPage(chapters, href) });
  return sections;
}
