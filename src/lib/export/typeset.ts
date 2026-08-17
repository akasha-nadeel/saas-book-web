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
 *
 * **The two take different units, and that is not a detail.** A PDF has a real
 * page, so it is set in real points. An EPUB has no page: the reader chooses
 * the size on a control every e-reader puts in its menu, and a stylesheet
 * stating `font-size: 11pt` takes that control away — an accessibility failure
 * before it is a typographic one. So the EPUB's root is `100%` and everything
 * below it is a multiple in `em`. See `size` inside `typesetCss`, and the tests
 * that hold it.
 */

import type { PageMetrics } from "@/lib/page-setup";

export type TemplateId = "manuscript" | "classic" | "romance";

export interface Template {
  id: TemplateId;
  name: string;
  /** The face it sets in, named as a reader would recognise it. */
  face: string;
  description: string;
  /** A real font stack, not a single name that may not be installed. */
  stack: string;
  /**
   * Body size in points, at the reference trim.
   *
   * **The trim decides the size now, not this** — see `bookSetting`. This is
   * what the face is set at on a 6×9 page, and it is what `manuscript` keeps
   * whatever page it is put on. A book template's real size comes from the
   * trim, because the length of a line is a fact about the page width.
   */
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
    bodyPt: 11,
    /* 1.35, down from 1.5. Print sets 120–140% of the type size; 1.5 is a
       screen value, and it was doing double duty as compensation for a line
       that ran 84 characters. The measure is fixed at the source now. */
    leading: 1.35,
    headingCaps: true,
  },
  {
    id: "romance",
    name: "Romance",
    face: "Palatino",
    description: "Wider set and more generous, as the genre is usually printed.",
    stack: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    bodyPt: 11,
    /* Still the most generous of the three, and now inside the range a book is
       actually set in. "Wider set and more generous" is carried by the face and
       this leading rather than by a measure nobody could read comfortably. */
    leading: 1.4,
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
  /* **"most common" rather than "recommended".** It is the trim most
     self-published paperbacks are printed at, which is a fact a writer can
     check; whether it is right for *their* book is theirs to decide. The house
     rule is that this app reports facts and refuses verdicts, and the badges it
     already carries follow it — EPUB says "Store-ready" because a shop takes
     only that one, and Markdown says "Soon" because it is unfinished. */
  {
    id: "6x9",
    label: "6″ × 9″ — royal · most common",
    width: 6,
    height: 9,
  },
  { id: "letter", label: "8.5″ × 11″ — US Letter", width: 8.5, height: 11 },
  { id: "a4", label: "8.27″ × 11.69″ — A4", width: 8.27, height: 11.69 },
];

export function trimById(id: string): Trim {
  return TRIMS.find((t) => t.id === id) ?? TRIMS[0];
}

/**
 * How a book is set on a given page: the size of the type and the white around
 * it.
 *
 * **The page decides the type size, and that is the whole of this change.**
 * Every template used to carry one fixed size and the margins were always 14%
 * of the page width — so the *measure*, the length of a line, was whatever fell
 * out. Measured against the app's own font stack (Georgia averages 0.447em per
 * character in running prose), 12pt gave:
 *
 *     5×8     48 characters      too narrow
 *     6×9     58                 acceptable
 *     A4      84                 too wide
 *     Letter  87                 too wide
 *
 * The target is 66 characters a line, and 45–75 is the tolerable band. So only
 * one trim in six was right, and the two office sizes were far past the
 * ceiling. Too narrow is not just ugly either: shorter lines mean more of them,
 * which means more pages, and a paperback is priced by the page.
 *
 * A real book does the opposite of scaling everything together — a smaller page
 * takes *smaller type* and *smaller* margins. So the recipe is per trim, and it
 * is a table rather than a formula because it is a set of typographic
 * judgements, not an equation: each row is the size and margin that land that
 * page near 66 characters.
 *
 * Exported because the export wizard's preview draws the same page, and a
 * preview computed from its own arithmetic is a preview that drifts. This is
 * the one place the numbers live; `typesetCss` and the sheet on screen both ask
 * it, so the page a writer approves is the page that prints.
 */
export interface BookSetting {
  /** Body size in points. */
  sizePt: number;
  /** Line height as a multiple of the size. */
  leading: number;
  /** Left and right margin, in inches. */
  side: number;
  /** Top and bottom margin, in inches. */
  ends: number;
}

/**
 * The size and margins each trim is set at, by id.
 *
 * The right-hand figure is the measure each row produces at that size, in
 * characters — worked out from the 0.447em average above, which is a
 * measurement of the real font rather than a rule of thumb. A change here
 * should be checked against it; a test walks every trim and fails outside
 * 45–75.
 */
const TRIM_SETTING: Record<string, { sizePt: number; side: number; ends: number }> = {
  "5x8": { sizePt: 10, side: 0.6, ends: 0.65 }, // 61
  "5.25x8": { sizePt: 10.5, side: 0.65, ends: 0.65 }, // 61
  "5.5x8.5": { sizePt: 10.5, side: 0.7, ends: 0.7 }, // 63
  "6x9": { sizePt: 11, side: 0.75, ends: 0.75 }, // 66
  /* The two office sizes are not book trims and cannot be made into them, but
     they are chosen for proofs and for readers who want a big page — so they
     get margins wide enough to pull the line back under the ceiling rather
     than a measure nobody can read. */
  letter: { sizePt: 11, side: 1.75, ends: 1 }, // 73
  a4: { sizePt: 11, side: 1.7, ends: 1 }, // 71
};

/** Where a trim this build does not know falls back to. */
const FALLBACK = TRIM_SETTING["6x9"];

export function bookSetting(template: Template, trim: Trim): BookSetting {
  /*
   * **Standard manuscript format is a specification, not a design.** An agent
   * asks for 12pt double-spaced with one-inch margins, and it is the same on
   * whatever paper it is printed on — so this template ignores the table
   * entirely. Resizing it to suit a 5×8 page would break the one thing it
   * exists to do, and the writer would find out from the agent.
   */
  if (template.id === "manuscript") {
    return { sizePt: 12, leading: template.leading, side: 1, ends: 1 };
  }

  const setting = TRIM_SETTING[trim.id] ?? FALLBACK;
  return {
    sizePt: setting.sizePt,
    leading: template.leading,
    side: setting.side,
    ends: setting.ends,
  };
}

/**
 * How many characters a line of this setting holds.
 *
 * **A measurement, not a guess**: 0.447em is the average width of a character
 * of English prose in Georgia, taken with canvas text metrics over a passage of
 * the app's own sample text. Palatino came out at 0.450 and Times at 0.408, so
 * one figure covers the book faces closely enough for a check — this is here to
 * catch a trim set badly, not to typeset anything.
 *
 * Used by the export screen to say what a trim does, and by the tests to fail
 * a row that drifts out of the readable band.
 */
export function measureIn(setting: BookSetting, trim: Trim): number {
  const textWidthPt = (trim.width - setting.side * 2) * 72;
  return Math.round(textWidthPt / (0.447 * setting.sizePt));
}

/**
 * The same setting, said the way the reading view asks for it.
 *
 * **This pair exists so the export wizard's Preview can be set like the file
 * rather than like the editor.** `BookPages` draws its sheets from a
 * `PageMetrics` and sets its prose from the `--ms-*` custom properties, and it
 * was being handed the *book's* page setup and typography — so a writer who
 * chose 5×8 and Romance on the Layout step was shown 6×9 in Garamond and told
 * by the step's own deck that it was "the trim and typography you have set".
 * Every line broke in a different place from the file's.
 *
 * They live here, next to `bookSetting` and `templateById`, for the reason
 * `bookSetting` itself is exported: a preview that computes its own page is a
 * preview that drifts. `typesetCss` and these two read the one table, so the
 * page a writer approves is the page that prints.
 *
 * Note what is *not* here: nothing reads `pageSetupOf(book)` or
 * `typographyOf(book)`. Those are the writing surface's settings and the
 * read-through stays paired with them — see `BookPages`, which takes these only
 * when it is standing in for the file.
 */
export function typesetMetrics(options: TypesetOptions): PageMetrics {
  const trim = trimById(options.trim);
  const { side, ends } = bookSetting(templateById(options.template), trim);
  return {
    width: trim.width,
    height: trim.height,
    top: ends,
    bottom: ends,
    left: side,
    right: side,
  };
}

/**
 * The `--ms-*` variables for a book set by this template.
 *
 * Every value mirrors a rule in `typesetCss`, and the mirroring is the whole
 * point — change one and change the other:
 *
 * - the face and size come from the template and `bookSetting`, as `${root}`
 *   and `size()` do;
 * - `justify` is `${root} { text-align: justify }`;
 * - the indent is `${s}p { text-indent: 1.5em }`, in the pixels the reading
 *   view measures in;
 * - the paragraph gap is nought, because that rule is `${s}p { margin: 0 }`.
 *   A book is set with an indent *or* a space between paragraphs and never
 *   both — see `paragraphStyleSettings` in typography.ts, which makes the same
 *   choice for the writing surface.
 *
 * Points and inches become pixels at 96 to the inch, exactly as
 * `typographyVars` does it, so the two are interchangeable at the call site.
 */
export function typesetVars(options: TypesetOptions): Record<string, string> {
  const template = templateById(options.template);
  const { sizePt, leading } = bookSetting(template, trimById(options.trim));
  const sizePx = sizePt * (96 / 72);
  return {
    "--ms-font": template.stack,
    "--ms-size": `${sizePx.toFixed(2)}px`,
    "--ms-leading": String(leading),
    "--ms-align": "justify",
    "--ms-indent": `${(sizePx * 1.5).toFixed(2)}px`,
    "--ms-para-gap": "0px",
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
  /**
   * Generated pages the writer has asked for *instead of* their own.
   *
   * **The three switches above cannot answer this on their own.** A written
   * page wins over a generated one (see `writtenPages`), so on a book that has
   * its own contents page the Contents switch was on and produced nothing —
   * the dead control this app refuses. The switch could not simply be defaulted
   * off either, because turning it back on would still have produced nothing.
   *
   * So the conflict gets a state of its own. An id in here means: leave the
   * writer's own page out of this export and use ours. Empty is the default and
   * the answer in every ordinary case, which is why this is optional — a book
   * with no clash never mentions it.
   *
   * It is a choice about *this export*, never about the book: nothing is
   * deleted, and the page is back next time.
   */
  replaceWritten?: readonly string[];
}

export const DEFAULT_TYPESET: TypesetOptions = {
  template: "classic",
  /* **6×9, the commonest self-published trim.**
​
     It was A4 — office paper — so that a browser saving to A4 or Letter filled
     the sheet rather than centring a small book page on it. That was a fact
     about the *print dialog*, and there is no print dialog any more: the PDF is
     laid out by a browser on the server at exactly the page size asked for, so
     the reason is spent. What is left is a default that ought to be the shape a
     book is actually printed in. Both office sizes are still on the list for
     proofs. */
  trim: "6x9",
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
 *
 * @param scope confines the presentational rules to one element's subtree.
 *
 * **This sheet is written for a document that is nothing but a book**, so it
 * styles bare `body`, `h1`, `p`, `ul` and `pre`. That is right for a file and
 * wrong for the export wizard's PDF review, which renders into the *app's* own
 * document because Paged.js lays pages out against the styles in the document
 * the script is running in. Unscoped, the wizard's own headings came out
 * centred in Georgia small-caps with a first-line indent on every paragraph of
 * the interface.
 *
 * Pass a selector and every rule that could match something outside the book
 * is written under it. Pass nothing — which is what every caller does today —
 * and the output is exactly what it always was.
 *
 * **Nothing passes a scope as of 2026-08-17, and this is kept anyway.** The
 * wizard's PDF review was the one caller: it paginated inside the app to show
 * the writer their pages, and this is what stopped the book's stylesheet
 * setting the interface like a novel. That pane shows the finished PDF from
 * `/api/export/pdf` now, so nothing renders a book into the app's document any
 * more. It stays because the hazard is one code change away from returning —
 * `paginate` still exists and still renders wherever it is told — and because
 * a guard with tests on it is cheaper to keep than to rediscover.
 *
 * **Two rules stay unscoped even then, and that is the load-bearing part.**
 * Paged.js does not merely apply this CSS, it *reads* some of it and matches
 * those selectors against its own source document — which is not inside the
 * scope. `string-set` on `h1` is what feeds the running head, and the
 * `page-break` rules on `section` are what start each chapter on a fresh
 * sheet; scoped, both silently stop working and the preview loses its running
 * heads and opens on a blank page. Neither has any effect on screen — a
 * `string-set` is invisible and a `page-break` only applies to paged media —
 * so leaving them global costs the app nothing. This is why `string-set` is
 * split out of the `h1` block rather than living in it.
 */
export function typesetCss(
  options: TypesetOptions,
  forPrint: boolean,
  scope = "",
): string {
  const t = templateById(options.template);
  const trim = trimById(options.trim);

  /* The size, the leading and the margins together, because on a book they are
     one decision — see `bookSetting`. `bodyPt` is the size at the reference
     trim and is deliberately *not* read here. */
  const { sizePt, leading, side, ends } = bookSetting(t, trim);

  /**
   * A size, in the unit the format is entitled to.
   *
   * **A PDF gets points and an EPUB must not**, and that is the whole of this
   * function. A PDF has a real page, so a real measurement is the only honest
   * thing to put on it. A reflowable EPUB has no page at all: the *reader*
   * chooses the size, on a control every e-reader puts in its menu — and a
   * stylesheet that states `font-size: 11pt` on the body takes that control
   * away. It is an accessibility failure before it is a typographic one, and
   * both KDP and the EPUB accessibility guidance say the same thing: the base
   * size of a reflowable book is the reader's to set.
   *
   * So the EPUB's root is `100%` — whatever the device is set to — and every
   * size below it is a multiple in `em`. Nothing about the *design* changes:
   * these were all written as multiples of the body size already, so a heading
   * is 1.6 times the prose either way. What changes is who decides how big the
   * prose is.
   *
   * It also quietly ends a second oddity. `bookSetting` picks a size from the
   * **trim**, which is a fact about a sheet of paper — so an EPUB exported at
   * 5×8 shipped 10pt type and the same book at A4 shipped 11pt, a difference
   * that means nothing to a device with no trim. In `em` the trim stops
   * reaching the EPUB at all, which is correct.
   */
  const size = (multiple: number) =>
    forPrint ? `${(sizePt * multiple).toFixed(1)}pt` : `${multiple}em`;

  /** Prefix for a rule that must not reach past the book. */
  const s = scope ? `${scope} ` : "";
  /** What carries the book's inherited typography: the document, or the host. */
  const root = scope || "body";

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
    font-size: ${(sizePt * 0.8).toFixed(1)}pt;
    color: #555;
    ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.05em;" : "font-style: italic;"}
  }
  @bottom-center {
    content: counter(page);
    font-family: ${t.stack};
    font-size: ${(sizePt * 0.85).toFixed(1)}pt;
    color: #555;
  }
}
/* The title page takes neither: a folio under a book's title is the mark of a
   document. Front matter is the first page of the document, so :first is all
   this needs — the copyright and contents pages that follow do carry a folio,
   as they do in a printed book. (No backticks in here: this is inside a
   template literal, and one would end the string.) */
@page :first { @top-center { content: none; } @bottom-center { content: none; } }
/* **A chapter opening page carries no running head, and this is what stops it
   printing the chapter title twice.** The head is set from string-set on the
   h1, so on the very page that h1 appears it repeated the words directly above
   themselves - measured on a real export, CHAPTER ONE as a running head over
   CHAPTER ONE as the title. No published book does that: the opening page of a
   chapter takes no head at all.

   Every section is given a named page, so Paged.js marks the page that *starts*
   one - as opposed to a page continuing it - with its own first-page class
   (addPageAttributes in modules/paged-media/atpage.js keys that on the start
   element having no data-split-from). Only the head is dropped. The folio
   stays, because a drop folio on a chapter opening is what a printed book
   does, and because it is the number the contents page points at. */
section { page: chapter; }
@page chapter:first { @top-center { content: none; } }`
    : ""
}
${root} {
  font-family: ${t.stack};
  font-size: ${forPrint ? `${sizePt}pt` : "100%"};
  line-height: ${leading};
  ${forPrint ? "margin: 0;" : "margin: 1em;"}
  text-align: justify;
  hyphens: auto;
}
${s}h1 {
  font-family: ${t.stack};
  font-weight: normal;
  text-align: center;
  font-size: ${size(1.6)};
  margin: ${forPrint ? "2.4em 0 1.6em" : "2em 0 1em"};
  ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.06em;" : ""}
}
${
  /* What the running head says on the pages that follow. Read from the heading
     rather than passed in, so it is always the chapter the reader is actually
     in. Ignored outside Paged.js, which is why it costs the EPUB nothing.

     **In its own unscoped rule**, because Paged.js reads this one rather than
     applying it: it matches the selector against its own source document, which
     a scoped preview's host element does not contain. Scoped, the running heads
     simply stop appearing. It has no effect on screen, so global costs nothing. */
  forPrint ? "h1 { string-set: chaptertitle content(text); }" : ""
}
${
  /* Each chapter (and each generated front-matter page) is its own <section>,
     so the page break goes on the section — not the h1, which would break every
     chapter's heading onto its own page and leave the number stranded. The very
     first section stays put, so the book does not open on a blank sheet.

     **Unscoped for the same reason `string-set` is**: Paged.js reads these
     against its own source document rather than applying them to the rendered
     page, so a scoped preview would put every chapter back on one sheet and
     open the book on a blank one. A `page-break` has no effect on screen, so
     the app is untouched by it. */
  forPrint
    ? `section { page-break-before: always; break-before: page; }
body > section:first-of-type { page-break-before: avoid; break-before: avoid; }`
    : ""
}
${s}.chapter-number {
  display: ${options.hideChapterNumbers ? "none" : "block"};
  text-align: center;
  font-size: ${size(1.4)};
  color: #555;
  margin-bottom: 0.4em;
}
${s}p { margin: 0; text-indent: 1.5em; orphans: 2; widows: 2; }
${s}h1 + p, ${s}blockquote + p, ${s}.scene-break + p, ${s}.figure + p { text-indent: 0; }
/* Centred and right-aligned paragraphs drop the indent, as they do in the
   editor and the reading view, so the printed page matches the page it was
   written on. Left keeps its indent: aligning prose left does not un-indent it.
   A line placed flush carries its own inline text-indent and needs no rule. */
${s}p[style*="text-align:center"],
${s}p[style*="text-align:right"] { text-indent: 0; }
${
  options.dropCaps
    ? `${s}h1 + p::first-letter {
  float: left;
  font-size: ${size(3.2)};
  line-height: 0.82;
  padding: 0.06em 0.08em 0 0;
  font-family: ${t.stack};
}`
    : ""
}
${s}.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
${s}blockquote { margin: 1.5em; font-style: italic; text-indent: 0; }
${
  /* **Lists say what they look like, rather than hoping something else does.**
​
     This stylesheet used to leave `ul`, `ol`, `li` and `pre` entirely alone and
     take whatever the user-agent gave them. That is a bet on the reading
     environment, and it lost in two places at once:
​
     - **The export wizard's PDF review** renders into the *app's* document to
       be measured (see `paginate`), and Tailwind's preflight resets
       `ol, ul { list-style: none; margin: 0; padding: 0 }`. So a chapter with
       a bulleted list previewed as a column of bare sentences while the PDF —
       laid out in a clean frame where the defaults survive — printed proper
       bullets. The preview was wrong about the file, which is the one thing it
       may not be.
     - **An e-reader is under no obligation either.** A reading system supplies
       its own default sheet, and several set lists flush with no marker. A book
       whose lists depend on somebody else's defaults is a book that looks
       different in every app it is opened in.
​
     Stated here, all three outputs that use this sheet agree, and they agree
     with the editor — which re-declares the same two rules for the same reason
     (`.manuscript .tiptap ul` in globals.css). `text-indent: 0` because the
     body's first-line indent inherits and would otherwise push the first line
     of every item away from its own bullet. The contents page keeps its own
     `list-style: none`, which is more specific and still wins. */ ""
}
/* The same measurements the writing surface uses (the .manuscript .tiptap rules
   in globals.css), so a list is the same shape on the page it was written on,
   in the read-through, and in the file. (No backticks in this comment: it sits
   inside a template literal and one would end the string.) */
${s}ul, ${s}ol { margin: 1em 0; padding-left: 1.5em; text-indent: 0; }
${s}ul { list-style: disc; }
${s}ol { list-style: decimal; }
${s}li { margin: 0.25em 0; text-indent: 0; }
/* A sublist belongs to the item above it, not to the run of prose: the outer
   margins would otherwise open a paragraph-sized gap inside a single item. */
${s}ul ul, ${s}ul ol, ${s}ol ul, ${s}ol ol { margin: 0.25em 0; }
/* Code keeps its shape and its own face, and wraps rather than running off the
   page — there is no horizontal scrolling in a book. */
${s}pre { margin: 1em 0; text-indent: 0; white-space: pre-wrap; overflow-wrap: break-word; }
${s}pre, ${s}code { font-family: "Courier New", Courier, monospace; font-size: 0.9em; }
${s}.figure { text-align: center; text-indent: 0; margin: 1.5em 0; }
${s}.figure img { max-width: 100%; height: auto; }
/* A picture the prose runs alongside, as the editor and the reading view set
   it. The margin is on the inner side only, so the picture stays flush with the
   text margin it sits against. */
${s}.figure[data-wrap="left"] { float: left; margin: 0.25em 1.4em 0.8em 0; }
${s}.figure[data-wrap="right"] { float: right; margin: 0.25em 0 0.8em 1.4em; }
${s}.figure[data-wrap] img { width: 100%; }
/* A chapter has to reach past a picture it wraps, or a short one would end
   level with its words and leave the picture hanging below them. */
${s}section::after { content: ""; display: block; clear: both; }

/* Generated front matter. Each opens its own page in print (the section rule
   above), and an e-reader paginates as it likes.

   **The reading view sets these same pages too, and its rules are in
   globals.css under "Generated front matter, on a reading-view page".** That is
   the screen the export wizard's Preview mounts, so the two are a pair and a
   change here belongs there as well — the same standing arrangement the
   .reader-title class and the h1 above already have. It cannot simply import
   this sheet: it draws these pages in the *book's* own face on the read-through
   and in the template's face in the Preview, so it sizes everything off
   --ms-size instead. (No backticks in this comment: it sits inside a template
   literal and one would end the string.) */
${s}.front-page {
  text-indent: 0;
}
/* **Everything from here down is named by one of our own classes, so it is left
   unscoped**: a rule that can only match a page this app generated has nothing
   to leak into. Two of them also carry paged-media properties that Paged.js
   reads rather than applies — the break-avoids below, and the folio rule at the
   foot of the file — and scoping those is what silently stops a preview
   printing its page numbers. See the note on this function.

   **The title block near the top third, the imprint at the foot.** Both blocks
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
  font-size: ${size(0.95)};
}
.title-page .book-title {
  font-size: ${size(2.2)};
  font-weight: normal;
  ${t.headingCaps ? "font-variant: small-caps; letter-spacing: 0.06em;" : ""}
  margin: 0 0 0.8em;
  page-break-before: avoid;
  break-before: avoid;
}
.title-page .book-subtitle {
  font-size: ${size(1.3)};
  font-style: italic;
  margin: 0 0 1.5em;
}
.title-page .book-author {
  font-size: ${size(1.2)};
  margin: 0;
}
.copyright {
  ${forPrint ? "padding-top: 60%;" : "padding-top: 4em;"}
  font-size: ${size(0.9)};
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
  /* **In the book's own text block, flush with the prose.**

     It was a 22em box centred on the page in *both* formats, and that measure
     exists for one reason: to hold the dotted leader and the folio, which only
     print draws. In an EPUB there is neither, so nine short chapter names sat
     against the left edge of a box nobody could see, a fifth of the way in from
     the margin — reading as a list that had slipped rather than as a contents
     page. The measure moved into the print block below, beside the leader it is
     for. */
  margin: 0;
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
    ? `/* A measure of its own, centred. Chapter names are short, and a leader
     that ran the full width of a printed page would leave an arm's length of
     dots between the name and the number. Print only, for the reason given on
     the contents list above. (No backticks in this comment: it sits inside a
     template literal and one would end the string.) */
.contents ol {
  margin: 0 auto;
  max-width: 22em;
}
.contents a {
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
