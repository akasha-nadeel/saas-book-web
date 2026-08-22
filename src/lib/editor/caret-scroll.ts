import type { EditorView } from "@tiptap/pm/view";

/**
 * Keeping the caret in sight, the way a word processor does.
 *
 * The rule is not "follow the caret" — it is "move only when you have to, and
 * then only as far as you have to". While the caret is somewhere in the visible
 * text the page must not move at all; the moment it would leave, the view
 * scrolls by exactly enough to bring it back to the edge and no further. That is
 * what makes typing feel still: the words under the cursor stay where the eye
 * left them, and the page slides one line at a time when the writing reaches the
 * bottom rather than lurching a screenful at a time.
 */

/**
 * Breathing room kept between the caret and the edge it is approaching.
 *
 * Deliberately almost nothing. The page must hold still until the caret has
 * actually run out of room — padding by a line's height instead means it slides
 * a whole line early, while the caret is still plainly visible, which reads as
 * the page moving on its own. Two pixels only, to keep sub-pixel rounding from
 * flapping the view back and forth at the boundary.
 */
const EDGE_PAD = 2;

interface VerticalBounds {
  top: number;
  bottom: number;
}

/**
 * The part of the editor that is genuinely visible between browser chrome,
 * the mobile editor header, and the writing dock.
 */
export function visibleEditingPort(
  container: VerticalBounds,
  viewport: VerticalBounds,
  headerBottom?: number,
  dockTop?: number,
): VerticalBounds {
  const top = Math.max(container.top, viewport.top, headerBottom ?? -Infinity);
  const bottom = Math.min(
    container.bottom,
    viewport.bottom,
    dockTop ?? Infinity,
  );
  return { top, bottom: Math.max(top, bottom) };
}

/**
 * How far to scroll so the caret is visible: positive to scroll down, negative
 * up, zero when it is already comfortably inside the port.
 *
 * The check for the *top* edge comes first so that a caret taller than the port
 * — a huge type size in a short window — settles showing its top rather than
 * flickering between the two edges, each fix undoing the other.
 */
export function caretScrollDelta(
  caret: { top: number; bottom: number },
  port: { top: number; bottom: number },
  pad: number,
): number {
  const ceiling = port.top + pad;
  if (caret.top < ceiling) return caret.top - ceiling;

  const floor = port.bottom - pad;
  if (caret.bottom > floor) return caret.bottom - floor;

  return 0;
}

/** The nearest ancestor that actually scrolls, which is what has to move. */
export function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === "auto" || overflow === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

/** The caret's box on screen, or null when it cannot be resolved. */
function caretBox(view: EditorView) {
  try {
    return view.coordsAtPos(view.state.selection.head);
  } catch {
    // coordsAtPos throws on a position it cannot map to the screen — mid-update,
    // or a position that has just been removed.
    return null;
  }
}

/**
 * Scroll the least that brings the caret back into view. Does nothing while it
 * is already there, which is most of the time.
 */
export function keepCaretInView(view: EditorView): void {
  const container = scrollParent(view.dom as HTMLElement);
  if (!container) return;

  const caret = caretBox(view);
  if (!caret) return;

  const owner = container.ownerDocument;
  const target = owner.defaultView;
  const visual = target?.visualViewport;
  const viewportTop = visual?.offsetTop ?? 0;
  const viewport = {
    top: viewportTop,
    bottom: viewportTop + (visual?.height ?? target?.innerHeight ?? 0),
  };
  const edgeOf = (
    selector: string,
    edge: "top" | "bottom",
  ): number | undefined => {
    const element = owner.querySelector<HTMLElement>(selector);
    if (!element || target?.getComputedStyle(element).display === "none") {
      return undefined;
    }
    return element.getBoundingClientRect()[edge];
  };
  const port = visibleEditingPort(
    container.getBoundingClientRect(),
    viewport,
    edgeOf(".oc-editor-mobile-header", "bottom"),
    edgeOf(".oc-writing-dock", "top"),
  );
  const delta = caretScrollDelta(caret, port, EDGE_PAD);
  // Instant, not smooth: a smooth scroll queued on every keystroke lags behind
  // the typing and feels like the page is chasing the caret.
  if (delta !== 0) container.scrollTop += delta;
}

// There was once a pair of helpers here that pinned the caret's place on screen
// across a relayout, so that a page gap opening would not move the text under
// the cursor. They are gone on purpose: cancelling that movement means scrolling
// the desk by a page-gap instead, so the caret holds still while the *sheets*
// lurch — which is worse, and was the thing being complained about. A page
// break moves the caret to the next sheet, and that is correct; see the note in
// pagination.ts where the breaks are applied.
