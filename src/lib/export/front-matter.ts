import { isGenericChapterTitle, type Book } from "@/lib/library-store";
import type { LoadedChapter } from "./blocks";
import type { TypesetOptions } from "./typeset";
import { escapeXml } from "./xhtml";
import { isApparatusPage, matterSectionIndex } from "@/lib/matter";

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

/**
 * The title page, set the way a title page is set.
 *
 * **Two blocks with the sheet between them**, which is the shape every printed
 * book uses: the title, its subtitle and the author near the top third, and the
 * imprint down at the foot. It used to be one run of three lines starting a
 * third of the way down, so a book with a publisher printed it directly under
 * the author's name like a fourth credit.
 *
 * **Nothing is invented to fill it.** The imprint block prints the publisher
 * and the year of publication *if the book carries them* and disappears
 * entirely if it does not — a self-published first novel with neither gets a
 * title, an author and a lot of quiet paper, which is exactly what that book's
 * title page looks like. The ornament is drawn only when there is an imprint
 * for it to sit above, because a divider dividing nothing is decoration.
 *
 * The year rather than the whole date: a title page carries the year of
 * publication, and `published` is stored as `YYYY-MM-DD` because that is what a
 * shop asks for.
 */
function titlePage(book: Book): string {
  const subtitle = book.subtitle
    ? `\n      <p class="book-subtitle">${escapeXml(book.subtitle)}</p>`
    : "";
  const author = book.author
    ? `\n      <p class="book-author">${escapeXml(book.author)}</p>`
    : "";

  const publisher = book.publishing?.publisher?.trim();
  const year = book.publishing?.published?.slice(0, 4);
  const imprint = [
    publisher ? `<p>${escapeXml(publisher)}</p>` : null,
    year && /^\d{4}$/.test(year) ? `<p>${escapeXml(year)}</p>` : null,
  ].filter(Boolean);

  /* The divider above the imprint is a CSS rule rather than a printer's
     ornament. A glyph like ❦ is the traditional mark and is the one thing here
     that could arrive as an empty box: an e-reader substitutes a font it has,
     and coverage of the dingbat range is not something an EPUB can rely on. A
     border draws in every reader and is invisible to a screen reader, which a
     decorative character is not. */
  const foot = imprint.length
    ? `\n    <div class="title-imprint">
${imprint.map((line) => `      ${line}`).join("\n")}
    </div>`
    : "";

  return `<section class="front-page title-page">
    <div class="title-block">
      <p class="book-title">${escapeXml(book.title)}</p>${subtitle}${author}
    </div>${foot}
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
/**
 * The copyright page as plain lines, in order.
 *
 * **Split out from the markup so the Word file can say the same thing.** The
 * DOCX writer builds paragraphs rather than HTML, and a second copy of this
 * notice living there would be two copyright statements that agree until one
 * of them is edited. Every rule above — the fiction disclaimer only for
 * fiction, the publisher and ISBN only when the book carries them — belongs to
 * this function, so every format inherits it.
 */
export function copyrightLines(book: Book, holder: string): string[] {
  const year = new Date().getFullYear();
  const publisher = book.publishing?.publisher?.trim();
  const isbn = book.publishing?.isbn?.trim();
  const fiction = book.genre !== "Memoir" && book.genre !== "Other";
  return [
    book.title,
    `Copyright © ${year} ${holder}`,
    "All rights reserved.",
    "No part of this book may be reproduced in any form without written permission from the author, except brief quotations in a review.",
    fiction
      ? "This is a work of fiction. Names, characters, places and incidents are the product of the author’s imagination or are used fictitiously."
      : null,
    publisher ? `Published by ${publisher}` : null,
    isbn ? `ISBN ${isbn}` : null,
  ].filter((line): line is string => Boolean(line));
}

function copyrightPage(book: Book, holder: string): string {
  const lines = copyrightLines(book, holder).map(
    (line) => `<p>${escapeXml(line)}</p>`,
  );
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
      if (!href) return `      <li>${label}</li>`;
      /* **The leader and the folio are drawn by CSS, from this markup.** The
         span is the dotted rule; the page number is a `target-counter` on the
         link in `typeset.ts`, resolved against the anchor this href points at.
         Both are empty here on purpose — a number written into the markup would
         be a number this module had to know, and it cannot. */
      return `      <li><a href="${href(i)}"><span class="toc-title">${label}</span><span class="toc-dots"></span></a></li>`;
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
 * The book without the written pages the writer asked us to replace.
 *
 * **One filter, applied before anything reads the book, is the whole of the
 * override** — and that is why it is done this way round rather than by
 * teaching each renderer about the choice. Take the page out of `chapters` and
 * `writtenPages` no longer sees it, so `frontSections` generates ours without
 * being told to; the body loops that print every page no longer emit theirs;
 * and the EPUB spine, the PDF flow, the Word file and the review screen all
 * agree, because all four are built from this one list. Threading a second
 * flag through each of them is how they end up disagreeing about which pages
 * are in the book.
 *
 * Matched the same way `writtenPages` matches — by title, through
 * `GENERATED_BY_TITLE`, front matter only — so the two can never disagree
 * about which page is which.
 *
 * Nothing is deleted: this is a filter over a list that was loaded for one
 * export, and the writer's page is untouched in the store.
 */
export function withoutReplaced(
  chapters: LoadedChapter[],
  replace: readonly string[] | undefined,
): LoadedChapter[] {
  if (!replace || replace.length === 0) return chapters;
  const drop = new Set(replace);
  return chapters.filter((chapter) => {
    if (chapter.matter !== "front") return true;
    const id = GENERATED_BY_TITLE[chapter.title.trim().toLowerCase()];
    return !id || !drop.has(id);
  });
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

/**
 * Where each generated section belongs among the standard front-matter pages.
 *
 * Read out of `MATTER_SECTIONS` rather than written down, so the one list that
 * says what order a book is bound in stays the only one.
 */
const GENERATED_RANK: Record<string, number> = {
  title: matterSectionIndex("front", "Title page"),
  copyright: matterSectionIndex("front", "Copyright page"),
  contents: matterSectionIndex("front", "Table of contents"),
};

/** One page of the bound book: either a generated section or a written page. */
export type BoundPage =
  | { kind: "generated"; section: FrontSection }
  | {
      kind: "chapter";
      chapter: LoadedChapter;
      /**
       * Its position in the *loaded* list, not in this one.
       *
       * The exporters name their files and anchors positionally —
       * `chapter-03.xhtml` is the fourth loaded chapter whatever order it is
       * bound in — so a reordered list must never renumber. Every consumer
       * takes the id from here.
       */
      index: number;
    };

/**
 * The whole book in the order it is bound.
 *
 * **The generated pages sit among the writer's own, not in front of them** —
 * and until this existed only the EPUB knew that. It was `spineOrder` in
 * `epub.ts`, a private answer to a question three other renderers were also
 * answering, each by emitting the generated block first and the chapters
 * after. That was right while front matter was a single page nobody made, and
 * became wrong the moment a book could carry its own half-title. Measured on
 * one book with a half-title, a dedication and an epigraph:
 *
 *   EPUB:  half-title, [title], [copyright], dedication, epigraph, [contents]
 *   PDF:   [title], [copyright], [contents], half-title, dedication, epigraph
 *   Word:  the same as the PDF
 *
 * — three files, three books, one manuscript. The EPUB's was the correct one
 * and the other two opened on a generated title page with the half-title that
 * should have led the book stranded behind the contents.
 *
 * So the arithmetic moves here and all four read it, the export wizard's
 * preview included. That last one is why this could not simply be fixed twice
 * more in place: a preview built from its own idea of the order is a preview
 * that says the file is wrong, or that a wrong file is right.
 *
 * Each generated section takes its own slot in the binding order
 * (`GENERATED_RANK`); a page the writer named themselves ranks `Infinity` and
 * sorts to the end of the front matter, which is the only honest answer for a
 * page whose position only they know. The body and the back matter follow in
 * the order they were loaded — they are the writer's sequence and nothing here
 * has any business reordering them.
 */
export function bindBook(
  chapters: readonly LoadedChapter[],
  sections: readonly FrontSection[],
): BoundPage[] {
  const front: { page: BoundPage; rank: number; seq: number }[] = [];
  const rest: BoundPage[] = [];

  chapters.forEach((chapter, index) => {
    const page: BoundPage = { kind: "chapter", chapter, index };
    if (chapter.matter === "front") {
      front.push({
        page,
        rank: matterSectionIndex("front", chapter.title),
        seq: index,
      });
    } else {
      rest.push(page);
    }
  });

  sections.forEach((section, i) => {
    // `seq` below every chapter's, so a generated page and a written one of the
    // same rank put the generated one first. It cannot happen today — a written
    // page suppresses its generated twin — but a tie has to resolve somehow.
    front.push({
      page: { kind: "generated", section },
      rank: GENERATED_RANK[section.id] ?? -1,
      seq: -sections.length + i,
    });
  });

  front.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
  return [...front.map((f) => f.page), ...rest];
}
