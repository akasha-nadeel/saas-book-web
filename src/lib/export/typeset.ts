/**
 * How an exported book is set.
 *
 * Every option here changes the bytes that come out. Nothing is offered that
 * the exporters do not honour — a checkbox that only moves a preview is worse
 * than no checkbox, because the writer finds out at the printer.
 *
 * The stylesheet built here is used twice: inside the EPUB, and by the print
 * view that produces a PDF. Those are the two outputs where typesetting is
 * ours to decide. Word takes its own styles from the .docx, and Markdown has
 * no typesetting at all, so both ignore this.
 */

export type TemplateId = "manuscript" | "classic" | "romance";

export interface Template {
  id: TemplateId;
  name: string;
  /** The face it sets in, named as a reader would recognise it. */
  face: string;
  description: string;
  /** A real font stack, not a single name that may not be installed. */
  stack: string;
  /** Body size in points, which is how print type is measured. */
  bodyPt: number;
  leading: number;
  /** Chapter openers in small caps and letterspacing, as classic settings do. */
  headingCaps: boolean;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "manuscript",
    name: "Manuscript",
    face: "Times New Roman",
    description: "Double-spaced and plain, the way agents ask for it.",
    stack: '"Times New Roman", Times, serif',
    bodyPt: 12,
    leading: 2,
    headingCaps: false,
  },
  {
    id: "classic",
    name: "Classic",
    face: "Georgia",
    description: "A book face at book size, for reading rather than marking up.",
    stack: "Georgia, Cambria, \"Times New Roman\", serif",
    bodyPt: 12,
    leading: 1.5,
    headingCaps: true,
  },
  {
    id: "romance",
    name: "Romance",
    face: "Palatino",
    description: "Wider set and more generous, as the genre is usually printed.",
    stack: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    bodyPt: 11.5,
    leading: 1.62,
    headingCaps: true,
  },
];

export function templateById(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Trim sizes, in inches. The names are what a printer's form asks for. */
export interface Trim {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const TRIMS: readonly Trim[] = [
  { id: "5x8", label: "5″ × 8″ — trade paperback", width: 5, height: 8 },
  { id: "5.25x8", label: "5.25″ × 8″ — digest", width: 5.25, height: 8 },
  { id: "5.5x8.5", label: "5.5″ × 8.5″ — US trade", width: 5.5, height: 8.5 },
  { id: "6x9", label: "6″ × 9″ — royal", width: 6, height: 9 },
  { id: "letter", label: "8.5″ × 11″ — US Letter", width: 8.5, height: 11 },
  { id: "a4", label: "8.27″ × 11.69″ — A4", width: 8.27, height: 11.69 },
];

export function trimById(id: string): Trim {
  return TRIMS.find((t) => t.id === id) ?? TRIMS[0];
}

/**
 * The white a page keeps around its text, in inches.
 *
 * Margins scale with the trim: a 5-inch page cannot carry the same inch of
 * white as a letter page and still hold a line of text.
 *
 * Exported because the export wizard's preview draws the same page, and a
 * preview computed from its own arithmetic is a preview that drifts. This is
 * the one place the numbers live; `typesetCss` and the sheet on screen both
 * ask it, so the page a writer approves is the page that prints.
 */
export function trimMargins(trim: Trim): { side: number; ends: number } {
  return {
    side: Math.max(0.5, Math.min(1, trim.width * 0.14)),
    ends: Math.max(0.5, Math.min(1, trim.height * 0.09)),
  };
}

export interface TypesetOptions {
  template: TemplateId;
  trim: string;
  /** Chapters print their title only, with no "1" above it. */
  hideChapterNumbers: boolean;
  /** A raised initial on the first paragraph of each chapter. */
  dropCaps: boolean;
  /** Generate a title page from the book's title and author. */
  titlePage: boolean;
  /** Generate a copyright page. */
  copyright: boolean;
  /** Generate a contents page listing the chapters. */
  contents: boolean;
}

export const DEFAULT_TYPESET: TypesetOptions = {
  template: "classic",
  // A full sheet by default, so a browser saving to A4 or Letter fills the page
  // rather than centring a small book page on it. A true book trim is a click
  // away, for a writer who will set their print paper to match.
  trim: "a4",
  hideChapterNumbers: false,
  dropCaps: false,
  // A real book opens on a title page, states its copyright, and lists its
  // contents — so all three are on. Copyright was off for a while, on the
  // reasoning that it needs a name the writer may not have set; that was the
  // right worry and the wrong lever. Defaulting it off meant every book
  // exported by somebody who never opened this step shipped with no copyright
  // page at all, which is the one piece of front matter a shop's reviewers
  // actually look for. The name is handled where it can be handled honestly:
  // `frontSections` leaves the page out when there is no author to put on it.
  titlePage: true,
  copyright: true,
  contents: true,
};

/**
 * The stylesheet for a set book.
 *
 * @param forPrint adds the @page rule that fixes the trim size. An EPUB has no
 * page — the reader's device decides — so including it there would be a
 * statement about paper that nothing can honour.
 */
export function typesetCss(
  options: TypesetOptions,
  forPrint: boolean,
): string {
  const t = templateById(options.template);
  const trim = trimById(options.trim);

  const { side, ends } = trimMargins(trim);

  return `
${
  /* **The page, and what sits in its margins.**
​
     Paged.js implements these boxes; the browser does not, which is why the
     running head used to be a `position: fixed` element floated over the text
     and why the contents page carried no folios. Both are ordinary paged-media
     CSS now.

     The head names the *chapter*, not the book — that is what a running head is
     for, and the book's title is on the cover, the title page and the spine
     already. It is set from `string-set` on each `h1`, so it follows the
     manuscript rather than being passed in. The first page of a chapter carries
     no head and no folio: a number under the chapter opening is the mark of a
     document rather than a book. */
  forPrint
    ? `@page {
  size: ${trim.width}in ${trim.height}in;
  margin: ${ends}in ${side}in;
  @top-center {
    content: string(chaptertitle);
    font-family: ${t.stack};
    font-size: ${(t.bodyPt * 0.8).toFixed(1)}pt;
    color: #555;
    ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.05em;" : "font-style: italic;"}
  }
  @bottom-center {
    content: counter(page);
    font-family: ${t.stack};
    font-size: ${(t.bodyPt * 0.85).toFixed(1)}pt;
    color: #555;
  }
}
/* The title page takes neither: a folio under a book's title is the mark of a
   document. Front matter is the first page of the document, so :first is all
   this needs — the copyright and contents pages that follow do carry a folio,
   as they do in a printed book. (No backticks in here: this is inside a
   template literal, and one would end the string.) */
@page :first { @top-center { content: none; } @bottom-center { content: none; } }`
    : ""
}
body {
  font-family: ${t.stack};
  font-size: ${t.bodyPt}pt;
  line-height: ${t.leading};
  ${forPrint ? "margin: 0;" : "margin: 1em;"}
  text-align: justify;
  hyphens: auto;
}
h1 {
  font-family: ${t.stack};
  font-weight: normal;
  text-align: center;
  font-size: ${(t.bodyPt * 1.6).toFixed(1)}pt;
  margin: ${forPrint ? "2.4em 0 1.6em" : "2em 0 1em"};
  ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.06em;" : ""}
  ${
    /* What the running head says on the pages that follow. Read from the
       heading rather than passed in, so it is always the chapter the reader is
       actually in. Ignored outside Paged.js, which is why it costs the EPUB
       nothing. */
    forPrint ? "string-set: chaptertitle content(text);" : ""
  }
}
${
  // Each chapter (and each generated front-matter page) is its own <section>,
  // so the page break goes on the section — not the h1, which would break every
  // chapter's heading onto its own page and leave the number stranded. The very
  // first section stays put, so the book does not open on a blank sheet.
  forPrint
    ? `section { page-break-before: always; break-before: page; }
body > section:first-of-type { page-break-before: avoid; break-before: avoid; }`
    : ""
}
.chapter-number {
  display: ${options.hideChapterNumbers ? "none" : "block"};
  text-align: center;
  font-size: ${(t.bodyPt * 1.4).toFixed(1)}pt;
  color: #555;
  margin-bottom: 0.4em;
}
p { margin: 0; text-indent: 1.5em; orphans: 2; widows: 2; }
h1 + p, blockquote + p, .scene-break + p, .figure + p { text-indent: 0; }
/* Centred and right-aligned paragraphs drop the indent, as they do in the
   editor and the reading view, so the printed page matches the page it was
   written on. Left keeps its indent: aligning prose left does not un-indent it.
   A line placed flush carries its own inline text-indent and needs no rule. */
p[style*="text-align:center"],
p[style*="text-align:right"] { text-indent: 0; }
${
  options.dropCaps
    ? `h1 + p::first-letter {
  float: left;
  font-size: ${(t.bodyPt * 3.2).toFixed(1)}pt;
  line-height: 0.82;
  padding: 0.06em 0.08em 0 0;
  font-family: ${t.stack};
}`
    : ""
}
.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
blockquote { margin: 1.5em; font-style: italic; text-indent: 0; }
.figure { text-align: center; text-indent: 0; margin: 1.5em 0; }
.figure img { max-width: 100%; height: auto; }
/* A picture the prose runs alongside, as the editor and the reading view set
   it. The margin is on the inner side only, so the picture stays flush with the
   text margin it sits against. */
.figure[data-wrap="left"] { float: left; margin: 0.25em 1.4em 0.8em 0; }
.figure[data-wrap="right"] { float: right; margin: 0.25em 0 0.8em 1.4em; }
.figure[data-wrap] img { width: 100%; }
/* A chapter has to reach past a picture it wraps, or a short one would end
   level with its words and leave the picture hanging below them. */
section::after { content: ""; display: block; clear: both; }

/* Generated front matter. Each opens its own page in print (the section rule
   above), and an e-reader paginates as it likes. */
.front-page {
  text-indent: 0;
}
/* **The title block near the top third, the imprint at the foot.** Both blocks
   are centred and the paper between them is the composition — a title page that
   simply starts a third of the way down and runs on reads as the first page of
   a document rather than the first page of a book.

   In print the section is a whole sheet, so it is given the page's height to
   push the imprint down to; on an e-reader there is no page to fill, and a
   fixed height there would either strand the imprint mid-screen or scroll. */
.title-page {
  text-align: center;
  ${
    forPrint
      ? `display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: calc(${trim.height}in - ${(ends * 2).toFixed(3)}in);
  padding-top: 18%;
  padding-bottom: 4%;`
      : "padding-top: 4em;"
  }
}
/* A short centred rule over the imprint, standing in for the printer's ornament
   a title page traditionally carries here. Drawn rather than typed: see the
   note in front-matter.ts about dingbat coverage in e-reader fonts. */
/* The rule is a pseudo-element so it can be short while the words under it are
   not: capping the block itself wrapped "Salt House Press" onto two lines at
   six ems, which is a publisher's name broken in half on a title page. */
.title-imprint::before {
  content: "";
  display: block;
  width: 6em;
  margin: 0 auto 1.1em;
  border-top: 1px solid #999;
}
.title-imprint p {
  margin: 0 0 0.3em;
  text-indent: 0;
  font-size: ${(t.bodyPt * 0.95).toFixed(1)}pt;
}
.title-page .book-title {
  font-size: ${(t.bodyPt * 2.2).toFixed(1)}pt;
  font-weight: normal;
  ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.06em;" : ""}
  margin: 0 0 0.8em;
  page-break-before: avoid;
  break-before: avoid;
}
.title-page .book-subtitle {
  font-size: ${(t.bodyPt * 1.3).toFixed(1)}pt;
  font-style: italic;
  margin: 0 0 1.5em;
}
.title-page .book-author {
  font-size: ${(t.bodyPt * 1.2).toFixed(1)}pt;
  margin: 0;
}
.copyright {
  ${forPrint ? "padding-top: 60%;" : "padding-top: 4em;"}
  font-size: ${(t.bodyPt * 0.9).toFixed(1)}pt;
  text-align: left;
}
.copyright p { text-indent: 0; margin: 0 0 0.6em; }
/* **The heading is centred, and it was not.** Every other heading in the book
   inherits the body's justification, which for a one-word heading means it sits
   hard against the left margin — so "Contents" started where a paragraph starts
   while the running head above it was centred on the page, and the page looked
   like it had been assembled rather than set. A contents heading is centred in
   every printed book. */
.contents h1 {
  text-align: center;
  page-break-before: avoid;
  break-before: avoid;
  margin-bottom: 2em;
}
.contents ol {
  list-style: none;
  padding: 0;
  /* A measure of its own. Chapter names are short, and run to the full width of
     a page they leave an arm's length of white between the name and nothing. */
  margin: 0 auto;
  max-width: 22em;
}
.contents li {
  text-indent: 0;
  margin: 0.55em 0;
  /* Never justified: a two-word chapter title stretched across the measure is
     the classic broken-contents look. */
  text-align: left;
}
/* The chapters are the page; a link colour would make them look like something
   to click in a printed book and like a warning in a dark e-reader theme. */
.contents a { color: inherit; text-decoration: none; }
${
  /* **The leader and the folio, in print only.**
​
     The number is `target-counter`, which asks what page the anchor in the
     `href` actually landed on. It is real: it cannot be off by one, because
     nobody counted. This is the whole reason the PDF is paginated by Paged.js —
     Chrome does not implement `target-counter`, so before this the contents
     page had no honest number to print and printed none.

     Nothing here reaches the EPUB, which is reflowable and has no page numbers
     to point at; there the entry is a link and that is the right answer. */
  forPrint
    ? `.contents a {
  display: flex;
  align-items: baseline;
}
.contents .toc-dots {
  flex: 1;
  margin: 0 0.4em;
  /* Sat on the baseline, the dots collide with descenders in the title beside
     them; lifted, they run through the middle of the line as a leader does. */
  border-bottom: 1px dotted #777;
  transform: translateY(-0.28em);
}
.contents a::after {
  content: target-counter(attr(href), page);
  font-variant-numeric: tabular-nums;
}`
    : ""
}
`.trim();
}
