import { expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  anchorDelta,
  clampZoom,
  pagePointUnder,
  steppedZoom,
  zoomFromWheel,
} from "./zoom";

it("holds the zoom inside its range", () => {
  expect(clampZoom(10)).toBe(ZOOM_MAX);
  expect(clampZoom(0.01)).toBe(ZOOM_MIN);
  expect(clampZoom(1)).toBe(1);
});

/**
 * **A stored zoom is attacker-shaped in the mundane sense**: `localStorage`
 * holds whatever an older version of the app, a half-finished migration or a
 * curious writer with devtools left there. A zero renders a page of no width —
 * including the control that would let anybody fix it — so this is the guard
 * standing between a bad value and an editor nobody can use.
 */
it("answers a usable number for junk", () => {
  expect(clampZoom(0)).toBe(ZOOM_MIN);
  expect(clampZoom(NaN)).toBe(1);
  expect(clampZoom(Infinity)).toBe(1);
  expect(clampZoom(-Infinity)).toBe(1);
});

/**
 * **The clamp must not round, and the buttons must.** They were one function
 * inside the control, and a gesture running through it ratchets in tenths
 * instead of zooming. This is the line between the two.
 */
it("keeps a fractional zoom fractional", () => {
  expect(clampZoom(1.2734)).toBe(1.2734);
});

/**
 * **The buttons are how a writer gets back to a round number after a pinch.**
 * They cannot be, if they add a step to whatever remainder the pinch left: 127%
 * plus ten is 137%, and pressing `+` four more times never once lands on a
 * figure anybody would choose.
 */
it("snaps to the next tidy step rather than adding to a remainder", () => {
  expect(steppedZoom(1.27, 1)).toBeCloseTo(1.3, 5);
  expect(steppedZoom(1.27, -1)).toBeCloseTo(1.2, 5);
});

/** From a value already on a step, a whole step — not back to itself. */
it("moves a whole step from an exact one", () => {
  expect(steppedZoom(1, 1)).toBeCloseTo(1 + ZOOM_STEP, 5);
  expect(steppedZoom(1, -1)).toBeCloseTo(1 - ZOOM_STEP, 5);
  expect(steppedZoom(1.2, 1)).toBeCloseTo(1.3, 5);
});

it("stops at the ends", () => {
  expect(steppedZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
  expect(steppedZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
});

/** Up the wheel zooms in, down zooms out — as every application agrees. */
it("zooms in on a negative delta", () => {
  expect(zoomFromWheel(1, -100)).toBeGreaterThan(1);
  expect(zoomFromWheel(1, 100)).toBeLessThan(1);
});

/**
 * **The property that makes a pinch feel stable.**
 *
 * A writer pinches in and back out a dozen times while reading. If each round
 * trip left the zoom a percent from where it started, the page would creep —
 * slowly, invisibly per gesture, and infuriatingly over a minute. An
 * exponential curve is exact both ways (`exp(-d) × exp(d) === 1`) where adding
 * a fixed amount is not, and this is the assertion that keeps it one.
 */
it("returns exactly where it started after a round trip", () => {
  const start = 1;
  let zoom = start;
  for (const delta of [-40, -13, -120, -7]) zoom = zoomFromWheel(zoom, delta);
  for (const delta of [7, 120, 13, 40]) zoom = zoomFromWheel(zoom, delta);
  expect(zoom).toBeCloseTo(start, 10);
});

/** And the same gesture is worth the same *proportion* at either end. */
it("is worth the same proportion at any size", () => {
  expect(zoomFromWheel(0.5, -50) / 0.5).toBeCloseTo(
    zoomFromWheel(2, -50) / 2,
    10,
  );
});

/**
 * **Three units, one gesture.**
 *
 * Firefox on Windows reports wheel deltas in *lines*; nearly everything else
 * reports pixels. Unnormalised, one notch is three units against another
 * browser's hundred — imperceptible in one and the whole range in the other,
 * from identical hardware. Page mode is rare but real and is normalised too.
 */
it("normalises the three delta units into comparable steps", () => {
  const lines = zoomFromWheel(1, -3, 1);
  const pixels = zoomFromWheel(1, -48, 0);
  expect(lines).toBeCloseTo(pixels, 10);

  // A page-mode notch is a large but not absurd step, not a jump to the ceiling.
  const page = zoomFromWheel(1, -1, 2);
  expect(page).toBeGreaterThan(1);
  expect(page).toBeLessThan(ZOOM_MAX);
});

/** Whatever the wheel asks for, the answer is inside the range. */
it("never leaves the range however hard the wheel is spun", () => {
  expect(zoomFromWheel(1, -100_000)).toBe(ZOOM_MAX);
  expect(zoomFromWheel(1, 100_000)).toBe(ZOOM_MIN);
});

/**
 * **The point under the pointer stays under the pointer.**
 *
 * Taken in the page's own unzoomed coordinates before the zoom, and put back
 * against the page's real edge after it. Working the pair together is what
 * proves the round trip: undo the scale, redo it, and the pointer has not
 * moved.
 */
it("puts the same page point back under the pointer", () => {
  const pointer = { x: 700, y: 400 };
  const before = { x: 300, y: 120 };

  const pagePoint = pagePointUnder(pointer, before, 1);

  // The page has been re-laid out larger, and its top-left has moved with it.
  const after = { x: 210, y: 40 };
  const delta = anchorDelta({ pointer, pagePoint, pageEdge: after, scale: 1.5 });

  // Scrolling by that delta puts the point back under the pointer exactly.
  expect(after.y + pagePoint.y * 1.5 - delta.y).toBeCloseTo(pointer.y, 10);
  expect(after.x + pagePoint.x * 1.5 - delta.x).toBeCloseTo(pointer.x, 10);
});

/**
 * **Nothing to do when nothing moved**, which is the case that used to drift.
 *
 * The old arithmetic scaled the scroll offsets by the zoom ratio and assumed
 * the whole scrollable content grew about its own origin. It does not — the
 * desk has padding that does not scale — so even a ratio of one left a small
 * remainder, and a remainder corrected against itself every frame with the
 * pointer held still is what made the page shake.
 */
it("asks for no scroll when the page has not moved", () => {
  const pointer = { x: 640, y: 300 };
  const edge = { x: 200, y: 80 };
  const pagePoint = pagePointUnder(pointer, edge, 2);

  const delta = anchorDelta({ pointer, pagePoint, pageEdge: edge, scale: 2 });

  expect(delta.x).toBeCloseTo(0, 10);
  expect(delta.y).toBeCloseTo(0, 10);
});

/** A page drawn at no width cannot divide, and must not answer NaN. */
it("survives a page that has not been laid out yet", () => {
  const point = pagePointUnder({ x: 100, y: 100 }, { x: 0, y: 0 }, 0);
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
});
