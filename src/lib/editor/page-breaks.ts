/**
 * Where the pages break — the arithmetic, with no DOM and no editor in it.
 *
 * This used to live inside `pagination.ts`, and being private to the editor was
 * the bug. The reading view had a paginator of its own that moved whole blocks,
 * so a paragraph longer than a page ran off the bottom of the sheet and the
 * clipped remainder simply vanished from the book, while the editor — measuring
 * the same manuscript in lines — broke it correctly. One book, two answers.
 *
 * So the whole of it is here, imported by the editor's pagination plugin and by
 * the reading view alike. It is pure on purpose: `pos` is an opaque handle the
 * caller chooses (a document position in the editor, a block index in the
 * reader), so the same walk serves both without either knowing about the other.
 * Kept free of Tiptap as well, or reading a book would download the editor.
 */

/** Page geometry in CSS pixels, at 96px to the inch. */
export interface PageGeometry {
  pageW: number;
  pageH: number;
  /** Margins. */
  mT: number;
  mB: number;
  mL: number;
  mR: number;
  /** Page height less its top and bottom margins — the text area. */
  contentH: number;
  /** The desk gap drawn between one sheet and the next. */
  gap: number;
}

export interface Spacer {
  /** Document position the gap is inserted before. */
  pos: number;
  /** Its height in unzoomed pixels. */
  height: number;
  /**
   * The gap falls inside a paragraph rather than between two blocks, so the
   * widget has to be an inline one that the surrounding text flows around.
   */
  inline: boolean;
}

/**
 * One laid-out line, in natural-flow pixels measured from the top of the first
 * page's text area — that is, the document as it would be with no page gaps in
 * it at all.
 *
 * `top` and `height` are the *line box*: the full stripe of the column the line
 * occupies, leading and all. Not the text's own rectangle, which is the em box
 * of the glyphs and is shorter — measuring that instead makes every line look
 * smaller than it is, so the page appears to have room it does not have and the
 * last line of each page spills into the bottom margin.
 */
export interface LineBox {
  top: number;
  height: number;
  /**
   * Where a break before this line inserts its gap — or a function that works
   * it out, for callers where finding it is expensive.
   *
   * **The editor's is expensive, and eagerly is what froze it.** Its only way
   * to turn a laid-out line back into a document position is
   * `view.posAtCoords`, a hit test that walks the DOM, and it was calling one
   * per line before this function had decided anything. A paragraph pasted at
   * 300,000 characters is about thirteen thousand lines and thirteen thousand
   * hit tests, and the tab stops answering — measured.
   *
   * Almost all of that work is thrown away: a break lands on perhaps one line
   * in a page, so twenty positions out of thirteen thousand are ever read.
   * Passing a closure defers the cost to exactly those, and a closure that
   * cannot answer returns null, which loses that one break rather than the
   * paragraph's whole ability to split.
   */
  pos: number | (() => number | null);
  /** True for every line but a block's first: breaking there splits a
   *  paragraph, so the gap is inline. A block's first line breaks between
   *  blocks, which is the older and simpler case. */
  inline: boolean;
}

/** Where the pages fall, and how many of them there are. */
export interface PageFlow {
  spacers: Spacer[];
  /**
   * How many sheets the text needs.
   *
   * Reported rather than derived from the number of gaps, because the two are
   * not the same: a block taller than a page covers several sheets without a
   * gap anywhere inside it — see `overflowPast`.
   */
  pages: number;
}

/** A top-level block, measured with one rectangle read — the cheap pass. */
export interface BlockBox {
  top: number;
  height: number;
  /** Document position before the block. */
  pos: number;
  /** Whether a page may break inside it rather than only in front of it. */
  splittable: boolean;
}

/**
 * Where the pages break.
 *
 * The whole of the pagination arithmetic, kept pure and away from the DOM so it
 * can be tested against numbers rather than against a browser. It walks the
 * lines in order, keeping the natural-flow y at which the current page's text
 * area begins, and opens a new page as soon as a line would overhang the one it
 * is on.
 *
 * Working in *lines* rather than in blocks is the point of it. A paragraph is
 * not an atom: Word fills a page to the bottom and continues the same paragraph
 * on the next sheet, and a manuscript full of long paragraphs looks wrong any
 * other way — pushing a whole twenty-line paragraph down leaves a hole where a
 * page should have been full.
 */
export function pageBreaks(
  blocks: BlockBox[],
  g: PageGeometry,
  /**
   * A block's lines, fetched only for a block that actually straddles a page
   * edge. Reading line boxes means a Range, its rectangles and a position
   * lookup per line; doing that for every paragraph in a chapter on every
   * keystroke is what made typing stutter. At most one block per page needs it.
   */
  linesOf: (block: BlockBox) => LineBox[] | null,
): PageFlow {
  const gapBetween = g.mB + g.gap + g.mT;
  const spacers: Spacer[] = [];
  let pageStart = 0;
  let pages = 1;

  /** Any part of it falls past the foot of the page it is on. */
  const runsPast = (top: number, height: number) =>
    // The +1 forgives a sub-pixel overshoot rather than breaking a page early.
    top + height - pageStart > g.contentH + 1;

  /**
   * ...and there is something above it on this page, so moving it down is worth
   * doing. A thing that *starts* a page and still does not fit is taller than a
   * page: it has nowhere better to go, and pushing it would only strand an empty
   * sheet in front of it.
   */
  const canMove = (top: number) => top > pageStart;

  const breakBefore = (top: number, pos: number, inline: boolean) => {
    const height = Math.round(g.contentH - (top - pageStart) + gapBetween);
    if (height <= 0) return;
    spacers.push({ pos, height, inline });
    pageStart = top;
    pages += 1;
  };

  /**
   * A block ran off the foot of its sheet, so the sheets it covers are counted
   * and the page origin moves on to the one it ends on.
   *
   * **This is what stops one oversized block breaking the rest of the
   * chapter.** Something that cannot be moved and cannot be split — a pasted
   * list, a picture taller than the page — overflows, and that has always been
   * allowed: it has nowhere better to go, and pushing it would only strand an
   * empty sheet in front of it. What was not allowed for is what comes *after*
   * it. With the origin left behind on the sheet the block began on, every
   * later block worked out as further past the page foot than the page is
   * tall, so its gap came out negative and was dropped — and then the next
   * one, and the next. One bullet list longer than a page and the remainder of
   * the manuscript was never paginated at all: prose flowing straight over the
   * seams of sheets drawn at fixed intervals, out through the margins.
   *
   * Moving the origin on by whole pages makes a negative gap impossible, and
   * costs nothing anywhere else: the loop runs only for a block that actually
   * overhangs, and one whose bottom is already on this page leaves it alone.
   */
  const overflowPast = (bottom: number) => {
    while (bottom - pageStart > g.contentH + 1) {
      pageStart += g.contentH;
      pages += 1;
    }
  };

  for (const block of blocks) {
    if (!runsPast(block.top, block.height)) continue;

    // Asked of any block that overhangs, *including* one that starts the page:
    // a paragraph longer than a whole page cannot be moved anywhere, but it can
    // still be broken, and it must be. Requiring it to be movable first is what
    // let a long opening paragraph run straight off the bottom of the sheet,
    // through the margin and into the desk below.
    const lines = block.splittable ? linesOf(block) : null;
    if (lines && lines.length > 1) {
      // A block long enough to cross several pages breaks as many times as it
      // needs to, so this runs over all of its lines rather than stopping at
      // the first.
      for (const line of lines) {
        if (!canMove(line.top) || !runsPast(line.top, line.height)) continue;
        // Resolved here and nowhere else, which is the point of allowing a
        // closure at all — see `LineBox.pos`.
        const at = typeof line.pos === "number" ? line.pos : line.pos();
        // A line that cannot say where it is loses its own break and nothing
        // else; the overhang check below then moves the block whole, which is
        // how this worked before lines were consulted at all.
        if (at !== null) breakBefore(line.top, at, line.inline);
      }

      // The lines are found by measuring, and a measurement can come up short.
      // If the block still hangs past the foot of its page once they have all
      // been walked, they did not cover it, and falling through to move the
      // whole block is better than leaving text in the margin. Nothing is lost
      // by checking: when the lines did their job this is false, and when a
      // break was made inside the block canMove below is false, so the only
      // case that acts is the one that needs to.
      if (!runsPast(block.top + block.height, 0)) continue;
    }

    if (canMove(block.top)) breakBefore(block.top, block.pos, false);

    // Moved or not, it may still be taller than the sheet it now starts on.
    overflowPast(block.top + block.height);
  }

  return { spacers, pages };
}
