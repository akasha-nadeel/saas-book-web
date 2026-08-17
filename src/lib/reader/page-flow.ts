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

  const labelHtml = chapter.label
    ? `<p class="chapter-label">${escapeXml(chapter.label)}</p>`
    : "";
  col.innerHTML =
    `<div class="chapter-opener reader-opener-link">${labelHtml}` +
    `<h2 class="reader-title">${escapeXml(chapter.title)}</h2></div>` +
    `<div class="tiptap">${chapter.html}</div>`;

  const tiptap = col.lastElementChild as HTMLElement;
  const kids = Array.from(tiptap.children) as HTMLElement[];
  if (kids.length === 0) return [""];

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
      // not.
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
  let current: string[] = [];

  kids.forEach((el, index) => {
    if (opensPage.has(index) && current.length) {
      pages.push(current.join(""));
      current = [];
    }

    const cuts = cutsIn.get(index);
    if (!cuts || cuts.length === 0) {
      current.push(el.outerHTML);
      return;
    }

    const nodes = textNodesOf(el);
    const total = nodes.reduce((n, t) => n + t.data.length, 0);
    const bounds = [0, ...cuts, total];
    for (let i = 0; i < bounds.length - 1; i++) {
      current.push(sliceBlock(el, nodes, total, bounds[i], bounds[i + 1]));
      if (i < bounds.length - 2) {
        pages.push(current.join(""));
        current = [];
      }
    }
  });

  pages.push(current.join(""));
  return pages;
}
