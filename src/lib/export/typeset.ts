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
  // A real book opens on a title page and lists its contents; copyright needs a
  // name the writer may not have set, so it is off until asked for.
  titlePage: true,
  copyright: false,
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

  // Margins scale with the trim: a 5-inch page cannot carry the same inch of
  // white as a letter page and still hold a line of text.
  const side = Math.max(0.5, Math.min(1, trim.width * 0.14));
  const ends = Math.max(0.5, Math.min(1, trim.height * 0.09));

  return `
${forPrint ? `@page { size: ${trim.width}in ${trim.height}in; margin: ${ends}in ${side}in; }` : ""}
${
  // The running head: the book's title in the top margin of every printed page,
  // on the outer (right) edge. A fixed element the browser repeats per page.
  // It only reads cleanly with the browser's own centred header switched off —
  // which the export dialog asks the writer to do.
  forPrint
    ? `.running-head {
  position: fixed;
  top: ${(ends * 0.4).toFixed(2)}in;
  left: 0;
  right: 0;
  text-align: right;
  padding-right: ${side}in;
  margin: 0;
  text-indent: 0;
  font-size: ${(t.bodyPt * 0.8).toFixed(1)}pt;
  color: #555;
  ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.05em;" : "font-style: italic;"}
}`
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

/* Generated front matter. Each opens its own page in print (the section rule
   above), and an e-reader paginates as it likes. */
.front-page {
  text-indent: 0;
}
.title-page {
  text-align: center;
  ${forPrint ? "padding-top: 30%;" : "padding-top: 4em;"}
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
.contents h1 { page-break-before: avoid; break-before: avoid; }
.contents ol { list-style: none; padding: 0; margin: 1.5em 0 0; }
.contents li { text-indent: 0; margin: 0.4em 0; }
`.trim();
}
