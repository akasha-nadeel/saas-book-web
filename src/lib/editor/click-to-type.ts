import type { PageGeometry } from "./pagination";

/**
 * Word's "click and type", for the manuscript.
 *
 * Double-click on the blank part of a sheet and the caret goes *there* rather
 * than to the end of the prose: the editor adds the blank lines it takes to get
 * down to that line, and reads the alignment off where across the column the
 * pointer was. It is the one place a word processor treats the page as a sheet
 * of paper instead of as a stream of text, and it is what a writer reaches for
 * when they want a title a third of the way down, or a scene set at the foot.
 *
 * The arithmetic lives here, away from the editor, because it is pure: a click
 * and a page geometry in, a number of blank lines and an alignment out. It works
 * in unzoomed CSS page pixels measured from the top-left of the whole page flow
 * — the caller divides client pixels by the zoom scale before calling.
 */

/**
 * Where across the text column the click asks the text to sit.
 *
 * Always one of the three, never "leave it alone" — this is what Word does, and
 * it is what makes the caret honest. A paragraph placed by clicking is set flush
 * to the alignment it was clicked at (see the explicit-alignment rule in
 * globals.css and typeset.ts, which drops the first-line indent for exactly
 * these): the writer clicks a spot, and the words begin at that spot. A body
 * paragraph's indent is a convention for prose that *flows*, and applying it
 * here would start the text a quarter-inch from where the caret was shown.
 */
export type ClickAlign = "left" | "center" | "right";

export interface ClickToType {
  /** Empty paragraphs to add before the caret lands on the clicked line. */
  lines: number;
  align: ClickAlign;
}

/**
 * A y in flow pixels resolved to its page, and how far down that page's text
 * area it falls. Clamped into the text area, so a click on a margin or on the
 * desk between two sheets lands on the nearest line rather than out of bounds.
 */
function place(y: number, g: PageGeometry) {
  const stride = g.pageH + g.gap;
  const page = Math.max(0, Math.floor(y / stride));
  const top = g.mT;
  const bottom = g.pageH - g.mB;
  const inPage = Math.min(Math.max(y - page * stride, top), bottom);
  return { page, inPage, top, bottom };
}

function alignAt(x: number, g: PageGeometry): ClickAlign {
  const left = g.mL;
  const width = g.pageW - g.mR - left;
  if (!(width > 0)) return "left";
  // Thirds of the text column, as against Word's quarters: a manuscript column
  // is narrow, and quarters make the centre band too small to hit.
  const across = Math.min(Math.max((x - left) / width, 0), 1);
  if (across < 1 / 3) return "left";
  return across < 2 / 3 ? "center" : "right";
}

/**
 * @param x            Click across the flow, in page pixels.
 * @param y            Click down the flow, in page pixels.
 * @param contentBottom Foot of the prose, in the same space.
 * @param lineHeight   One line of body text. Zero disables the drop, leaving
 *                     the caret at the end of the prose.
 */
export function clickToType(
  x: number,
  y: number,
  contentBottom: number,
  lineHeight: number,
  g: PageGeometry,
): ClickToType {
  const align = alignAt(x, g);
  if (!(lineHeight > 0)) return { lines: 0, align };

  const from = place(contentBottom, g);
  const to = place(y, g);

  let lines = 0;
  if (to.page === from.page) {
    lines = (to.inPage - from.inPage) / lineHeight;
  } else if (to.page > from.page) {
    // Only text-area space counts: the margins and the desk gap at a seam are
    // not lines, so crossing a page costs the rest of one text area and the top
    // of the next, never the distance in raw pixels.
    lines =
      (from.bottom - from.inPage) / lineHeight +
      (to.page - from.page - 1) * (g.contentH / lineHeight) +
      (to.inPage - to.top) / lineHeight;
  }

  // Floored, never rounded: the caret should land on the line the pointer is in
  // or the one above it, never past where the writer clicked. One page of lines
  // is the most any click can be worth, since the blank tail only ever runs from
  // the foot of the prose to the end of the last sheet.
  const cap = Math.ceil(g.contentH / lineHeight) + 1;
  return { lines: Math.max(0, Math.min(Math.floor(lines), cap)), align };
}
