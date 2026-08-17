import { describe, expect, it, vi } from "vitest";
import {
  pageBreaks,
  type BlockBox,
  type LineBox,
  type PageGeometry,
} from "./page-breaks";

// A 6×9 novel page at 96px to the inch with the book's mirrored margins: the
// text area is 630px tall, which holds exactly 21 lines of 30px.
const G: PageGeometry = {
  pageW: 576,
  pageH: 864,
  mT: 72,
  mB: 76.8,
  mL: 86.4,
  mR: 62.4,
  contentH: 630,
  gap: 24,
};

const LINE = 30;
const LINES_PER_PAGE = 21;
/** What one seam costs: the bottom margin, the desk gap, the top margin. */
const SEAM = G.mB + G.gap + G.mT;

/** A paragraph of `count` lines starting at `top`, as one block. */
function block(top: number, count: number, pos: number): BlockBox {
  return { top, height: count * LINE, pos, splittable: true };
}

/** The lines that block would be found to have, if it were asked for. */
function linesIn(b: BlockBox): LineBox[] {
  return Array.from({ length: Math.round(b.height / LINE) }, (_, i) => ({
    top: b.top + i * LINE,
    height: LINE,
    // Only a block's first line breaks between blocks; the rest split it.
    pos: i === 0 ? b.pos : b.pos + 1 + i,
    inline: i > 0,
  }));
}

/** Nothing splits — the behaviour before paragraphs could be broken. */
const atomic = () => null;

describe("pageBreaks", () => {
  it("leaves a document that fits on one page alone", () => {
    expect(pageBreaks([block(0, LINES_PER_PAGE, 0)], G, linesIn)).toEqual([]);
  });

  it("splits a paragraph across the seam instead of pushing it down whole", () => {
    const b = block(0, 30, 0);
    const breaks = pageBreaks([b], G, linesIn);

    expect(breaks).toHaveLength(1);
    // The break falls before line 21 — the first that would overhang — and that
    // is inside the paragraph, so the gap is an inline one.
    expect(breaks[0].inline).toBe(true);
    expect(breaks[0].pos).toBe(linesIn(b)[LINES_PER_PAGE].pos);
    // The page was full, so the gap is only the seam itself.
    expect(breaks[0].height).toBe(Math.round(SEAM));
  });

  it("fills the rest of a part-used page before breaking", () => {
    // A five-line paragraph, then a long one. The long one must not be pushed
    // down whole: 16 of its lines belong on the rest of this page.
    const long = block(5 * LINE, 40, 100);
    const breaks = pageBreaks([block(0, 5, 0), long], G, linesIn);

    expect(breaks[0].inline).toBe(true);
    expect(breaks[0].pos).toBe(linesIn(long)[16].pos);
    expect(breaks[0].height).toBe(Math.round(SEAM));
  });

  it("breaks between blocks when the overhang starts a block", () => {
    const next = block(LINES_PER_PAGE * LINE, 4, 500);
    const breaks = pageBreaks(
      [block(0, LINES_PER_PAGE, 0), next],
      G,
      linesIn,
    );

    expect(breaks).toHaveLength(1);
    expect(breaks[0].inline).toBe(false);
    expect(breaks[0].pos).toBe(500);
  });

  it("only reads the lines of a block that straddles an edge", () => {
    // The performance guard. Reading line boxes costs a Range, its rectangles
    // and a position lookup per line; doing it for every paragraph on every
    // keystroke is what made typing stutter.
    const spy = vi.fn(linesIn);
    const blocks = [
      block(0, 5, 0),
      block(5 * LINE, 5, 100),
      block(10 * LINE, 5, 200),
      block(15 * LINE, 12, 300), // the only one crossing the page edge
      block(27 * LINE, 5, 400),
    ];
    pageBreaks(blocks, G, spy);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].pos).toBe(300);
  });

  it("moves a block down whole when it cannot be split", () => {
    // An unsplittable block — an image 400px tall — after 10 lines. Only 330px
    // of the text area is left, so it moves down whole, and the gap has to
    // cover the room it left behind as well as the seam.
    const blocks: BlockBox[] = [
      block(0, 10, 0),
      { top: 10 * LINE, height: 400, pos: 400, splittable: false },
    ];
    const breaks = pageBreaks(blocks, G, linesIn);

    expect(breaks).toHaveLength(1);
    expect(breaks[0].pos).toBe(400);
    expect(breaks[0].inline).toBe(false);
    expect(breaks[0].height).toBe(Math.round(630 - 300 + SEAM));
  });

  it("moves a block whole when its lines fail to account for all of it", () => {
    // The trailing-spaces case. Holding the space bar puts lines on the page
    // that have height but no width, and a measurement that only sees glyphs
    // reports the paragraph as ending at its last visible word. The lines then
    // all appear to fit while the paragraph itself runs off the foot of the
    // sheet — the caret walking down through the bottom margin with no break
    // ever called for. Whatever the lines say, a block that still overhangs
    // has to move.
    const short: LineBox[] = [
      { top: 5 * LINE, height: LINE, pos: 100, inline: false },
      { top: 6 * LINE, height: LINE, pos: 103, inline: true },
    ];
    const blocks: BlockBox[] = [
      block(0, 5, 0),
      // Twenty lines tall, but only two of them measurable.
      { top: 5 * LINE, height: 20 * LINE, pos: 100, splittable: true },
    ];
    const breaks = pageBreaks(blocks, G, () => short);

    expect(breaks).toHaveLength(1);
    expect(breaks[0].pos).toBe(100);
    expect(breaks[0].inline).toBe(false);
  });

  it("leaves a block alone when its lines do account for all of it", () => {
    // The guard above must not fire when the lines did their job, or every
    // split paragraph would be moved whole straight after being split.
    const b = block(0, 30, 0);
    const breaks = pageBreaks([b], G, linesIn);

    expect(breaks).toHaveLength(1);
    expect(breaks[0].inline).toBe(true);
  });

  it("falls back to moving a paragraph whole when its lines cannot be read", () => {
    // linesOf returning null is the safety valve: a paragraph whose lines can
    // not be trusted behaves exactly as it did before splitting existed.
    const breaks = pageBreaks([block(0, 5, 0), block(5 * LINE, 40, 100)], G, atomic);

    expect(breaks[0].inline).toBe(false);
    expect(breaks[0].pos).toBe(100);
  });

  it("lets a line taller than a whole page overflow rather than open an empty sheet", () => {
    const blocks: BlockBox[] = [
      { top: 0, height: 900, pos: 0, splittable: false },
    ];
    expect(pageBreaks(blocks, G, linesIn)).toEqual([]);
  });

  it("opens as many pages as the text needs", () => {
    // 100 lines at 21 to the page is five sheets, so four seams.
    expect(pageBreaks([block(0, 100, 0)], G, linesIn)).toHaveLength(4);
  });

  it("adds a page for the line that will not fit, and gives it back when it goes", () => {
    // Pressing Enter at the foot of a full page puts an empty paragraph where
    // there is no room for it, so a page opens for it. Pressing Backspace takes
    // that paragraph away again, and with it the page — no sheet outlives the
    // text that called for it.
    const full = block(0, LINES_PER_PAGE, 0);
    expect(pageBreaks([full], G, linesIn)).toEqual([]);

    // ...Enter.
    const pressed: BlockBox[] = [
      full,
      { top: LINES_PER_PAGE * LINE, height: LINE, pos: 500, splittable: true },
    ];
    const opened = pageBreaks(pressed, G, linesIn);
    expect(opened).toHaveLength(1);
    expect(opened[0].pos).toBe(500);

    // ...Backspace. Exactly the state we started in, and no page left behind.
    expect(pageBreaks([full], G, linesIn)).toEqual([]);
  });

  it("keeps a page for every line that still overhangs after one is removed", () => {
    // Holding Enter leaves a run of empty paragraphs, and one Backspace removes
    // one of them — not all of them. Three lines past the foot of the page is
    // still a second page, however it was arrived at.
    const full = block(0, LINES_PER_PAGE, 0);
    const overhang = Array.from({ length: 3 }, (_, i) => ({
      top: (LINES_PER_PAGE + i) * LINE,
      height: LINE,
      pos: 500 + i * 2,
      splittable: true,
    }));

    expect(pageBreaks([full, ...overhang], G, linesIn)).toHaveLength(1);
    expect(pageBreaks([full, ...overhang.slice(0, 2)], G, linesIn)).toHaveLength(1);
    expect(pageBreaks([full, ...overhang.slice(0, 1)], G, linesIn)).toHaveLength(1);
    // Only when the last of them goes does the page go.
    expect(pageBreaks([full], G, linesIn)).toEqual([]);
  });

  it("forgives a sub-pixel overshoot rather than breaking a page early", () => {
    const blocks: BlockBox[] = [
      { top: 0, height: 300, pos: 0, splittable: false },
      { top: 300, height: 330.6, pos: 10, splittable: false },
    ];
    expect(pageBreaks(blocks, G, linesIn)).toEqual([]);
  });

  it("breaks a paragraph that starts a page and is longer than one", () => {
    // The regression behind text running off the foot of the sheet, through the
    // bottom margin and into the desk below — with the caret out there with it.
    // A paragraph opening a page cannot be *moved* anywhere: there is nothing
    // above it to break away from. But it can still be broken, and it must be,
    // or it simply overflows. Requiring a block to be movable before looking
    // inside it is what made a long opening paragraph do exactly that.
    const b = block(0, 50, 0);
    const breaks = pageBreaks([b], G, linesIn);

    expect(breaks).toHaveLength(2);
    expect(breaks.every((s) => s.inline)).toBe(true);
    expect(breaks[0].pos).toBe(linesIn(b)[21].pos);
    expect(breaks[1].pos).toBe(linesIn(b)[42].pos);
  });

  it("still lets an unsplittable block that starts a page overflow", () => {
    // The other half of the same rule: an image taller than the page has
    // nowhere to go and no lines to break between, so it overhangs rather than
    // stranding an empty sheet in front of itself.
    const blocks: BlockBox[] = [
      { top: 0, height: 700, pos: 0, splittable: false },
    ];
    expect(pageBreaks(blocks, G, linesIn)).toEqual([]);
  });

  it("gives up rather than ask for a gap of negative height", () => {
    // What follows something that has already overhung its sheet is further
    // past the page foot than the page is tall, so the room to fill works out
    // negative. There is no sensible gap to draw, and the content flows on
    // instead. A long-standing limit of oversized blocks, pinned here so that
    // changing it is a decision rather than an accident.
    const blocks: BlockBox[] = [
      { top: 0, height: 900, pos: 0, splittable: false },
      { top: 900, height: 60, pos: 50, splittable: false },
    ];
    expect(pageBreaks(blocks, G, linesIn)).toEqual([]);
  });
});
