import {
  pageBreaks,
  type BlockBox,
  type LineBox,
  type PageGeometry,
} from "@/lib/editor/page-breaks";
import { escapeXml } from "@/lib/export/xhtml";

/**
 * The book flowed onto pages — the reading view's half of the editor's print
 * layout.
 *
 * The editor cannot fragment a live ProseMirror document, so it measures the
 * prose and pushes the overflow down with spacer decorations. This does the
 * opposite thing with the same arithmetic: it measures the prose off-screen and
 * *cuts* it into one HTML string per sheet, which is what a read-only view can
 * do and an editable one cannot.
 *
 * **The arithmetic is `pageBreaks`, shared with the editor**, and sharing it is
 * the whole point of this module. This view used to pack whole blocks: a
 * paragraph that did not fit went to the next sheet entire, and a paragraph
 * longer than a page went on anyway and ran off the bottom — where
 * `.reader-page`'s `overflow: hidden` clipped it, so a dozen lines of somebody's
 * novel were simply *absent* from the read-through, the flip-book and the Book
 * View preview, with a half-empty sheet after them. The editor, measuring the
 * same manuscript in lines, broke it correctly. One book, two answers, and the
 * wrong one was the one that claimed to show the finished thing.
 *
 * Everything here is measured in a hidden column at the page's true content
 * width, outside any zoom wrapper, so the numbers are true CSS pixels whatever
 * the pages are drawn at.
 */

export interface ReaderChapter {
  id: string;
  title: string;
  /** The spelled "Chapter Five" label, or null when the title is its own label
   *  (a generic "Chapter 5") or the chapter is front/back matter. */
  label: string | null;
  html: string;
  empty: boolean;
  /**
   * Whether this page opens with its own title above the prose.
   *
   * `printsHeading`'s answer, carried through. Apparatus — a half-title, a
   * title page, a copyright page, a contents list — is furniture rather than a
   * division of the book, so no published book heads that sheet with its name;
   * the name exists so the writer can find the page in a list. Every exporter
   * has known that and this view did not, so it headed somebody's copyright
   * page "Copyright page" on the screen that claims to show the file.
   */
  heading: boolean;
  /**
   * A page this app built rather than one the writer typed — the generated
   * title page, copyright page or contents.
   *
   * Two things follow, and they are the only two: its markup is a `<section>`
   * of its own that takes the front-matter setting rather than the prose
   * setting (`reader-front`, not `tiptap`), and there is no chapter behind it
   * to click into. Nothing else may hang off this flag.
   */
  generated: boolean;
  /**
   * Where this page sat in the list the contents was built from, or null for a
   * generated page.
   *
   * The generated contents names each chapter by that index — `data-page-of` —
   * because the exporters name their files and anchors positionally and a bound
   * order must never renumber them. This is what lets `withFolios` turn "the
   * fourth loaded page" into "page 11" once the sheets have been cut.
   */
  source: number | null;
}

/**
 * A contents page with its page numbers filled in.
 *
 * **The reading view is the one place that can answer this, and it can only
 * answer it last.** A printed contents takes its folios from `target-counter`,
 * which Paged.js resolves against real pages; a screen has no such mechanism,
 * and the numbers cannot be known until the book has been measured and cut —
 * which is after the contents page itself has been written. So the page is
 * built with empty slots, the whole book is laid out, and the slots are filled
 * here.
 *
 * **It is not circular, and that is by construction:** a folio is set on the
 * line its leader already occupies, so filling one changes no height, and the
 * layout that produced the number still stands. `pageOf` answering null leaves
 * the slot empty rather than guessing — an entry with no number reads as a gap,
 * where a wrong number reads as a fact.
 */
export function withFolios(
  html: string,
  pageOf: (source: number) => number | null,
): string {
  if (typeof document === "undefined" || !html.includes("toc-folio")) return html;
  // A <template>'s contents are inert, so nothing is fetched by the parse.
  const holder = document.createElement("template");
  holder.innerHTML = html;
  for (const slot of holder.content.querySelectorAll(".toc-folio")) {
    const source = Number(slot.getAttribute("data-page-of"));
    if (!Number.isInteger(source)) continue;
    const page = pageOf(source);
    if (page !== null) slot.textContent = String(page);
  }
  return holder.innerHTML;
}

/**
 * Every picture the chapters refer to, loaded — or failed, which counts too.
 *
 * **A page break is decided by measuring, and a picture with no intrinsic size
 * yet measures nothing.** A wrapped one contributes no height at all, so the
 * prose beside it never shortens its lines and the page is filled past its own
 * foot; `.reader-page` then clips whatever hangs over. Measured on a real book:
 * three chapter openings came out 70px over — about three lines of somebody's
 * novel, gone.
 *
 * What made it look intermittent is that it only bites on a *first* measure.
 * Come back to the screen and the pictures are decoded, so the second pass is
 * right — and the pass the writer actually saw was the wrong one. A `data:` URL
 * is no exception: it still decodes asynchronously.
 *
 * `document.fonts.ready` is the same problem for glyph metrics and was already
 * waited on. This is its other half.
 *
 * Parsed with a `<template>`, whose contents are inert, so nothing is fetched
 * by the parse itself — the loading is done here, deliberately, one `Image` per
 * distinct source.
 */
export function picturesSettled(
  chapters: readonly ReaderChapter[],
): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const srcs = new Set<string>();
  const holder = document.createElement("template");
  for (const chapter of chapters) {
    if (!chapter.html.includes("<img")) continue;
    holder.innerHTML = chapter.html;
    for (const img of holder.content.querySelectorAll("img")) {
      const src = img.getAttribute("src");
      if (src) srcs.add(src);
    }
  }
  if (srcs.size === 0) return Promise.resolve();

  return Promise.all(
    [...srcs].map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          // A picture that will not load is settled as far as this is
          // concerned: it takes no height in the file either, and waiting on
          // it forever would leave the page breaks on their first, wrong pass.
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
          if (img.complete) resolve();
        }),
    ),
  ).then(() => undefined);
}

/** Whether a second measuring pass could change anything — a book with no
 *  pictures and a font already loaded is laid out correctly the first time,
 *  and re-paginating forty chapters to prove it is work for nothing. */
export function needsSecondPass(chapters: readonly ReaderChapter[]): boolean {
  if (typeof document === "undefined") return false;
  if (document.fonts?.status !== "loaded") return true;
  return chapters.some((chapter) => chapter.html.includes("<img"));
}

/** Every text node under an element, in document order. */
function textNodesOf(el: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

/** Turn a character offset into the DOM point it names. Offsets are counted
 *  across the block's text nodes as though its text were one string. */
function pointAt(
  nodes: Text[],
  offset: number,
): { node: Text; offset: number } | null {
  let left = offset;
  for (const node of nodes) {
    if (left <= node.data.length) return { node, offset: left };
    left -= node.data.length;
  }
  return null;
}

/**
 * The top of the character at `offset`, in client pixels.
 *
 * One rectangle read, which is what makes the search below cheap: finding where
 * a line starts by counting the rows of every prefix would be O(text) per probe
 * on a paragraph that may be a thousand characters long.
 */
function charTop(nodes: Text[], offset: number): number | null {
  const from = pointAt(nodes, offset);
  const to = pointAt(nodes, offset + 1);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const rect = range.getBoundingClientRect();
  return rect.height > 0 ? rect.top : null;
}

/**
 * Where each word begins.
 *
 * A page may only be cut at one of these. A soft wrap happens at a space, so
 * every line starts at a word — cutting anywhere else would either split a word
 * in half or leave the tail beginning with the space the line above already
 * swallowed, and in both cases the two halves would re-wrap into lines that are
 * not the ones that were measured.
 */
function wordStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const blank = /\s/.test(text[i]);
    if (!blank && (i === 0 || /\s/.test(text[i - 1]))) starts.push(i);
  }
  return starts;
}

/** The first word at or below `edge`, by binary search — a paragraph's text
 *  runs down the column, so the tops are in order and a search is sound. */
function wordAtOrBelow(
  nodes: Text[],
  starts: number[],
  edge: number,
): number | null {
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const top = charTop(nodes, starts[mid]);
    if (top === null) return null;
    if (top >= edge) hi = mid;
    else lo = mid + 1;
  }
  return lo < starts.length ? starts[lo] : null;
}

/** A block's laid-out lines: the edges between them, and the character offset
 *  each one begins at. Null when the block cannot be read with confidence, so
 *  the caller falls back to moving it whole — never worse than it used to be. */
function lineFlow(
  el: HTMLElement,
  base: number,
): { edges: number[]; offsets: number[] } | null {
  const nodes = textNodesOf(el);
  const text = nodes.map((n) => n.data).join("");
  if (!text.trim()) return null;

  const range = document.createRange();
  range.selectNodeContents(el);
  // Height only. A line can be perfectly real and have no width at all — a run
  // of trailing spaces wraps onto lines of its own that measure nothing across
  // — and dropping those leaves the lines failing to cover the paragraph they
  // came from, so the part below the last visible word is invisible to the
  // page-fill arithmetic.
  const rects = Array.from(range.getClientRects()).filter((r) => r.height > 0);
  if (rects.length === 0) return null;

  // One rect per run of text per line, so runs sharing a top edge are one line.
  // A pixel of tolerance: sub-pixel layout puts the parts of a line a hair
  // apart when they differ in size or style.
  const rows: { top: number; bottom: number }[] = [];
  for (const r of rects) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(r.top - row.top) <= 1) {
      row.bottom = Math.max(row.bottom, r.bottom);
    } else {
      rows.push({ top: r.top, bottom: r.bottom });
    }
  }
  if (rows.length < 2) return null;

  // A rectangle from a text Range is the *glyphs'* box, not the line's: it
  // leaves out the leading above and below. Using it as the line height would
  // tell the page it has room it does not have, and the last line of every page
  // would spill into the bottom margin. So the boundary between two lines is
  // the midpoint of the blank between their glyph boxes — exactly where the
  // line boxes meet when the leading is even — and the outermost edges come
  // from the paragraph's own box, leading included.
  const blockRect = el.getBoundingClientRect();
  const edges: number[] = [blockRect.top];
  for (let i = 1; i < rows.length; i++) {
    edges.push((rows[i - 1].bottom + rows[i].top) / 2);
  }
  edges.push(blockRect.bottom);

  const starts = wordStarts(text);
  const offsets: number[] = [0];
  for (let i = 1; i < rows.length; i++) {
    const at = wordAtOrBelow(nodes, starts, edges[i]);
    // A line whose first word cannot be found is one this cannot cut in front
    // of, and a partial answer is not usable: the caller needs every line or
    // none, or it would break a page at a line it has no offset for.
    if (at === null) return null;
    offsets.push(at);
  }

  return { edges: edges.map((v) => v - base), offsets };
}

/**
 * One slice of a block, as HTML.
 *
 * A shallow clone keeps the element's own tag and attributes, and
 * `cloneContents` rebuilds any inline markup the cut passes through — an
 * emphasis spanning the seam comes out as an `<em>` on both sheets rather than
 * as an unclosed tag on one.
 */
function sliceBlock(
  el: HTMLElement,
  nodes: Text[],
  total: number,
  from: number,
  to: number,
): string {
  const shell = el.cloneNode(false) as HTMLElement;
  const range = document.createRange();

  if (from <= 0) {
    range.setStart(el, 0);
  } else {
    const at = pointAt(nodes, from);
    if (!at) return el.outerHTML;
    range.setStart(at.node, at.offset);
  }

  if (to >= total) {
    range.setEnd(el, el.childNodes.length);
  } else {
    const at = pointAt(nodes, to);
    if (!at) return el.outerHTML;
    range.setEnd(at.node, at.offset);
  }

  shell.appendChild(range.cloneContents());
  // The rest of a paragraph is not a new one: it takes no first-line indent
  // however the book sets its paragraphs, and the stylesheet needs telling,
  // because on the page it *is* the first child of its sheet's prose.
  if (from > 0) shell.setAttribute("data-cont", "");
  return shell.outerHTML;
}

/**
 * Split one chapter into pages of block HTML, measuring in `col`.
 *
 * The chapter's opener — its label and title — is laid out in the column above
 * the prose exactly as the page draws it, rather than measured on its own and
 * subtracted. Measured apart, the title's bottom margin collapses out of the
 * box being measured and is not counted, so every chapter's first sheet
 * over-filled by about two lines and dropped them off the foot of the page.
 *
 * Shared by the reading view, the flip-book and the editor's Book View preview,
 * so all three break the pages in the same places.
 */
export function paginate(
  col: HTMLElement,
  chapter: ReaderChapter,
  contentH: number,
): string[] {
  // A block formatting context, so a first child's top margin stays inside the
  // column the way it stays inside the sheet (`.reader-page` is `overflow:
  // hidden`, which is one). Without it the two disagree by that margin.
  col.style.display = "flow-root";

  /* Apparatus prints no heading — `printsHeading`, carried on `heading`. So the
     opener is absent rather than empty: measured with an empty opener in the
     flow, a copyright page would be laid out an inch and a half short of the
     sheet the writer is shown. */
  const labelHtml = chapter.label
    ? `<p class="chapter-label">${escapeXml(chapter.label)}</p>`
    : "";
  const opener = chapter.heading
    ? `<div class="chapter-opener reader-opener-link">${labelHtml}` +
      `<h2 class="reader-title">${escapeXml(chapter.title)}</h2></div>`
    : "";
  /* Prose is set as prose and a generated page is set as front matter — two
     different settings, so two different wrappers. See `.reader-front` in
     globals.css, which is the reading view's half of `typesetCss`'s
     front-matter block. */
  col.innerHTML =
    opener +
    `<div class="${chapter.generated ? "reader-front" : "tiptap"}">${chapter.html}</div>`;

  const host = col.lastElementChild as HTMLElement;

  /* **A generated page is one `<section>`, and one element is one block, which
     a page break cannot get inside.** Left as it was, a contents list longer
     than a sheet went on the sheet anyway and `.reader-page`'s `overflow:
     hidden` cut it off — the exact defect `page-breaks.ts` was extracted to fix,
     reappearing on the pages this app writes itself. Measured on a 66-chapter
     book: the heading alone on one sheet, twenty-five entries on the next, and
     the remaining forty simply absent.

     So the section's children are the blocks — and a *list* among them is
     opened out into its items, because a contents page is one `<ol>` and
     nothing else, so leaving it whole would put the entire page back into a
     single block. Breaking between entries is also the only place a contents
     page *can* break: cutting one in half would leave a chapter's name on one
     sheet and its folio on the next. */
  const shell = chapter.generated
    ? (host.firstElementChild as HTMLElement | null)
    : null;
  /** Each block, and the list it belongs to if it is an item of one. */
  const pieces: { el: HTMLElement; list: HTMLElement | null }[] = [];
  for (const child of Array.from((shell ?? host).children) as HTMLElement[]) {
    if (shell && (child.tagName === "OL" || child.tagName === "UL")) {
      for (const item of Array.from(child.children) as HTMLElement[]) {
        pieces.push({ el: item, list: child });
      }
    } else {
      pieces.push({ el: child, list: null });
    }
  }
  const kids = pieces.map((piece) => piece.el);
  if (kids.length === 0) return [""];

  /**
   * One sheet's blocks, back inside what they came out of.
   *
   * Runs of items are gathered into a shallow clone of their own list and the
   * whole sheet into a clone of the section, so a continuation is still a real
   * `<ol>` inside a real `front-page contents` — which is what carries the
   * setting. Rebuilt rather than sliced because a list cut by a Range comes
   * back as a fragment of items with no list around them.
   */
  const sheet = (parts: { html: string; list: HTMLElement | null }[]): string => {
    let out = "";
    for (let i = 0; i < parts.length; ) {
      const list = parts[i].list;
      if (!list) {
        out += parts[i].html;
        i += 1;
        continue;
      }
      let inner = "";
      while (i < parts.length && parts[i].list === list) {
        inner += parts[i].html;
        i += 1;
      }
      const listClone = list.cloneNode(false) as HTMLElement;
      listClone.innerHTML = inner;
      out += listClone.outerHTML;
    }
    if (!shell) return out;
    const clone = shell.cloneNode(false) as HTMLElement;
    clone.innerHTML = out;
    return clone.outerHTML;
  };

  // The column's top is the sheet's own content top, so a block's position here
  // is its position on the first page — the opener included, since it is in the
  // flow above them.
  const base = col.getBoundingClientRect().top;

  const blocks: BlockBox[] = kids.map((el, index) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top - base,
      height: r.height,
      // `pos` is an opaque handle to pageBreaks; here it is the block's index.
      pos: index,
      // Only prose splits. A picture, a scene break or a heading has nothing to
      // break between, and a wrapped picture is out of the flow entirely — the
      // text beside it would re-wrap on the next sheet, where the picture is
      // not. A contents entry is not split either: it is opened out into its own
      // block above, and a chapter's name on one sheet with its page number on
      // the next is not a page break anybody wants.
      splittable:
        el.tagName === "P" &&
        !el.hasAttribute("data-wrap") &&
        el.querySelector("img") === null,
    };
  });

  // Line breaks need a handle of their own, and it must not collide with a
  // block's: block indices run 0…kids.length-1, so these start after them.
  let nextHandle = kids.length;
  const insideBlock = new Map<number, { block: number; offset: number }>();
  const flows = new Map<number, { edges: number[]; offsets: number[] }>();

  const linesOf = (block: BlockBox): LineBox[] | null => {
    const el = kids[block.pos];
    if (!el) return null;
    let flow = flows.get(block.pos);
    if (!flow) {
      const measured = lineFlow(el, base);
      if (!measured) return null;
      flow = measured;
      flows.set(block.pos, measured);
    }

    const lines: LineBox[] = [];
    for (let i = 0; i < flow.offsets.length; i++) {
      const box = { top: flow.edges[i], height: flow.edges[i + 1] - flow.edges[i] };
      if (i === 0) {
        // A block's first line breaks in front of the block, which is the older
        // and simpler case and leaves an untouched paragraph exactly as it was.
        lines.push({ ...box, pos: block.pos, inline: false });
        continue;
      }
      const handle = nextHandle++;
      insideBlock.set(handle, { block: block.pos, offset: flow.offsets[i] });
      lines.push({ ...box, pos: handle, inline: true });
    }
    return lines;
  };

  const geometry: PageGeometry = {
    // Only the text area matters here: the reading view draws each page as its
    // own sheet, so there is no seam to fill and the gap heights pageBreaks
    // computes are discarded. A seam a page deep keeps every one of them
    // positive, which is the only thing they are read for (a gap that came out
    // at or below zero would be dropped, and with it the page break).
    pageW: 0,
    pageH: 0,
    mT: 0,
    mB: 0,
    mL: 0,
    mR: 0,
    contentH,
    gap: contentH,
  };

  const breaks = pageBreaks(blocks, geometry, linesOf);

  // Back from break points to sheets: which blocks open a page, and where a
  // page opens in the middle of one.
  const opensPage = new Set<number>();
  const cutsIn = new Map<number, number[]>();
  for (const spacer of breaks) {
    const inside = spacer.inline ? insideBlock.get(spacer.pos) : undefined;
    if (inside) {
      const list = cutsIn.get(inside.block) ?? [];
      list.push(inside.offset);
      cutsIn.set(inside.block, list);
    } else {
      opensPage.add(spacer.pos);
    }
  }

  const pages: string[] = [];
  let current: { html: string; list: HTMLElement | null }[] = [];

  const breakHere = () => {
    pages.push(sheet(current));
    current = [];
  };

  pieces.forEach(({ el, list }, index) => {
    if (opensPage.has(index) && current.length) breakHere();

    const cuts = cutsIn.get(index);
    if (!cuts || cuts.length === 0) {
      current.push({ html: el.outerHTML, list });
      return;
    }

    const nodes = textNodesOf(el);
    const total = nodes.reduce((n, t) => n + t.data.length, 0);
    const bounds = [0, ...cuts, total];
    for (let i = 0; i < bounds.length - 1; i++) {
      current.push({
        html: sliceBlock(el, nodes, total, bounds[i], bounds[i + 1]),
        list,
      });
      if (i < bounds.length - 2) breakHere();
    }
  });

  pages.push(sheet(current));
  return pages;
}
