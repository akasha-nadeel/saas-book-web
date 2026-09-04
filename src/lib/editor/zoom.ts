/**
 * How large the page is drawn, and the arithmetic of changing it.
 *
 * **Its own module because none of this is visible in a screenshot.** A zoom
 * that drifts a pixel every time you pinch in and back out looks fine in a
 * still and feels broken in the hand; a wheel curve that is right on a trackpad
 * crosses the whole range in one notch of a mouse. Both are properties of
 * numbers, which means both can be proved rather than eyeballed — see
 * `zoom.test.ts`.
 *
 * Pure and importing nothing, so the editor, the control in the desk strip and
 * the store's own narrowing can all read it.
 */

/**
 * The range, widened from 50%–200% on 2026-09-04.
 *
 * At a quarter a writer can see the shape of several pages at once, which is
 * the reading that tells them a chapter is front-heavy; at four times a hyphen
 * is legible. Neither end is a size anybody writes at, and that is the point —
 * the ends are for looking, the middle is for working.
 */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

/** What one press of the `−`/`+` buttons is worth. */
export const ZOOM_STEP = 0.1;

/**
 * Into range, and **not rounded**.
 *
 * The control's own arithmetic rounds to a tenth, which is right for a button
 * and wrong for a gesture: rounding a pinch to 10% steps is the difference
 * between zooming and ratcheting. So the clamp and the rounding are two
 * separate ideas here, where they used to be one function inside the control.
 *
 * Non-finite input answers 1 rather than propagating. This is also the store's
 * narrowing on the way in — `localStorage` holds whatever an older version or a
 * curious writer left there, and a stored `0` renders a page of no width with
 * no control left to fix it.
 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * The next tidy step up or down, for the two buttons.
 *
 * **Snaps to the step rather than adding to the current value**, so a writer who
 * has pinched to 127% and then presses `+` lands on 130% and not 137%. The
 * buttons are how you get back to round numbers after a gesture, which they
 * cannot be if they inherit the gesture's remainder.
 */
export function steppedZoom(zoom: number, direction: 1 | -1): number {
  const steps = zoom / ZOOM_STEP;
  // Epsilon so a value already exactly on a step moves a whole one rather than
  // snapping to itself — floating point makes 1.2 / 0.1 land at 11.999…
  const next =
    direction === 1 ? Math.floor(steps + 1e-6) + 1 : Math.ceil(steps - 1e-6) - 1;
  return clampZoom(Math.round(next * ZOOM_STEP * 100) / 100);
}

/**
 * How much one line of wheel travel is worth in pixels, and one page.
 *
 * A wheel event reports its delta in one of three units, and which one depends
 * on the browser, the operating system and the device. Firefox on Windows
 * reports **lines**; almost everything else reports pixels; a page-mode event
 * is rare but real. Left unnormalised, one notch of a Firefox mouse is three
 * units against Chrome's hundred — so the same gesture would be imperceptible
 * in one browser and cross the whole range in the other.
 */
const PX_PER_LINE = 16;
const PX_PER_PAGE = 400;

/**
 * How fast the zoom answers the wheel.
 *
 * Tuned against the two devices that differ most: a trackpad pinch arrives as a
 * stream of small deltas, a mouse notch as a single ±100. At this value a notch
 * is about 12%, which is a comfortable step, and a slow pinch is continuous.
 */
const SENSITIVITY = 0.0012;

/**
 * The zoom a wheel event asks for.
 *
 * **Multiplied, not added.** Adding a fixed amount makes the same gesture feel
 * enormous at 30% and negligible at 300%, because what the eye judges is the
 * *ratio* between before and after. An exponential keeps one notch worth the
 * same proportion everywhere — and it is what makes the round trip exact:
 * `exp(-d) × exp(d)` is 1, so pinching in and back out by the same travel
 * returns to the number you started on rather than drifting a little each time.
 *
 * Deltas are negative when scrolling up, which every platform maps to zooming
 * *in*, hence the sign.
 */
export function zoomFromWheel(
  zoom: number,
  deltaY: number,
  deltaMode = 0,
): number {
  const px =
    deltaMode === 1
      ? deltaY * PX_PER_LINE
      : deltaMode === 2
        ? deltaY * PX_PER_PAGE
        : deltaY;

  return clampZoom(zoom * Math.exp(-px * SENSITIVITY));
}

/** Where the scroller should be, to hold one point still. */
export interface ScrollAt {
  left: number;
  top: number;
}

/**
 * The scroll offsets that keep the point under the pointer under the pointer.
 *
 * **This is the whole difference between "it zooms" and "it feels right".**
 * Without it the page grows from its top-left corner and the paragraph a writer
 * was reading slides off the screen, so every zoom costs a scroll to find their
 * place again. With it, the word under the cursor does not move and the rest of
 * the page grows around it.
 *
 * The arithmetic: the point under the pointer, measured from the top of the
 * scrollable content, is `scroll + (pointer − edge)`. Scaling the content by
 * `ratio` moves that point to `ratio ×` itself. Putting it back under the same
 * pointer means scrolling to the difference.
 *
 * **Clamped at zero**, because a negative scroll offset is silently treated as
 * zero by the browser and would otherwise make the anchor drift at the top of
 * the document — where a writer spends most of their time. The far end needs no
 * clamp: the browser caps it against the real content size, which this cannot
 * know without measuring after the reflow.
 */
export function anchoredScroll({
  scroll,
  pointer,
  edge,
  ratio,
}: {
  /** Current `scrollLeft` / `scrollTop`. */
  scroll: ScrollAt;
  /** The pointer, in client coordinates. */
  pointer: { x: number; y: number };
  /** The scroller's top-left, in client coordinates. */
  edge: { x: number; y: number };
  /** New zoom over old zoom. */
  ratio: number;
}): ScrollAt {
  const withinX = pointer.x - edge.x;
  const withinY = pointer.y - edge.y;

  return {
    left: Math.max(0, (scroll.left + withinX) * ratio - withinX),
    top: Math.max(0, (scroll.top + withinY) * ratio - withinY),
  };
}
