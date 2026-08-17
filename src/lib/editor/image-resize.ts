/**
 * How wide a picture is, in the only unit the document stores: a percentage of
 * the text column.
 *
 * A percentage rather than pixels because the column is not a fixed width — it
 * is whatever the book's trim size and margins make it, and it changes when the
 * writer changes either. A picture set at half the column stays at half the
 * column in the editor, the read-through and every exported file. See
 * `resizable-image.ts`, which stores it.
 *
 * The arithmetic lives here rather than in the node view for the reason
 * `page-breaks.ts` and `click-to-type.ts` do: it is the part that can be wrong
 * without anything failing, and the part a test can hold still. The node view
 * keeps the pointer plumbing, which needs a browser and does not need checking.
 */

/**
 * The smallest a picture may be dragged, as a percentage of the column.
 *
 * **Ten per cent, not a pixel count.** It was `Math.max(40, …)` in pixels,
 * which on a paperback column is about six per cent — a picture small enough
 * that the two 12px handles overlap each other and there is nothing left to
 * grab. Getting out of that state meant undo, if the writer thought of it. A
 * floor in the same unit as the value cannot drift with the trim size.
 */
export const MIN_IMAGE_PERCENT = 10;

/**
 * What a picture starts at when there is no reason to think otherwise.
 *
 * **Half the column, and it is the answer the code had already arrived at.** A
 * wrapped picture with no width of its own has been drawn at `width ?? "50%"`
 * in the node view since wrapping was built, because a float with no width
 * takes the whole column — the same problem, met earlier in the one place it
 * could not be dodged. Using that number here rather than picking a second one
 * keeps a picture the same size whether or not the text runs beside it.
 */
export const DEFAULT_IMAGE_PERCENT = 50;

/**
 * The width a drag has reached.
 *
 * **`scale` is the whole of why this is not two lines at the call site.** The
 * manuscript is drawn inside a CSS `zoom` — the desk bar's own control, and
 * its "100%" is really 1.3 (`PAGE_SCALE` in `chapter-editor.tsx`) — so a
 * pointer that travels 100 viewport pixels has travelled only 77 of the
 * layout pixels the element is measured in. Adding one to the other made the
 * picture's edge run a third ahead of the pointer and reach full width at
 * about three quarters of the way across; at the 200% setting it ran two and a
 * half times ahead. That is not a resize a writer can aim, and it is what
 * "I can't control it" means.
 *
 * The editor already knows this rule in both of the other places it measures
 * against the page — `pagination.ts` normalises every rect by the same scale,
 * and the double-click-to-type arithmetic divides by it before asking which
 * line was hit. This was the one pixel calculation that never got the memo,
 * because the zoom arrived four days after the resize did and nothing failed
 * when it landed.
 *
 * Derive `scale` from a rendered width over its own layout width rather than
 * from the zoom setting, so it stays right whether the zoom is a CSS `zoom` or
 * a transform — the rule `pagination.ts` states for itself.
 */
export function resizedPercent({
  startWidth,
  columnWidth,
  dx,
  scale,
  side,
}: {
  /** The picture's width when the drag began, in layout pixels. */
  startWidth: number;
  /** The text column's width, in layout pixels. */
  columnWidth: number;
  /** How far the pointer has moved, in viewport pixels. */
  dx: number;
  /** Rendered width over layout width — see above. */
  scale: number;
  /** Which handle is being dragged. */
  side: "left" | "right";
}): number {
  // A column of nothing cannot be divided into. Full width is the state the
  // picture is already in, so answering it changes nothing.
  if (!(columnWidth > 0)) return 100;

  // A zero or negative scale is not a page anybody is looking at; treating it
  // as unzoomed keeps the drag usable rather than sending the width to zero.
  const travel = (side === "right" ? dx : -dx) / (scale > 0 ? scale : 1);
  const percent = Math.round(((startWidth + travel) / columnWidth) * 100);
  return Math.max(MIN_IMAGE_PERCENT, Math.min(100, percent));
}

/**
 * The width a picture should be inserted at, or null to leave it alone.
 *
 * **A picture used to arrive with no width at all**, which sounds like "its own
 * size" and is not: the stylesheet caps every picture at `max-width: 100%`, and
 * an imported one has already been resized to 1400px on its longest edge while
 * a 6×9 text column is nearer 430. So every photograph landed at exactly the
 * full column, and the writer's first act on every picture was to make it
 * smaller.
 *
 * Null for anything that already fits, and that half matters as much: a logo
 * 200px wide has no size problem, and putting it at half a column would
 * *enlarge* it past its own pixels into a blur. Only a picture too big for the
 * page is given a size, and what it is given is a starting point rather than a
 * decision — the handles and the toolbar's presets are right there.
 */
export function insertWidthPercent(
  /** The stored picture's width in pixels — `stored`, not `natural`. */
  storedWidth: number,
  /** The text column's width, in layout pixels. */
  columnWidth: number,
): string | null {
  // Nothing measurable to compare. A default is the safe answer: it is the
  // large-picture case that is unusable, and the small-picture case merely
  // smaller than it might have been.
  if (!(storedWidth > 0) || !(columnWidth > 0)) {
    return `${DEFAULT_IMAGE_PERCENT}%`;
  }
  if (storedWidth <= columnWidth) return null;
  return `${DEFAULT_IMAGE_PERCENT}%`;
}
