import { expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  anchoredScroll,
  clampZoom,
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
 * Without this the page grows from its top-left corner, so the paragraph being
 * read slides away and every zoom costs a scroll to find it again. The test
 * works the anchoring backwards: take a point in the content, scale it, and
 * check the new scroll puts it back at the same place on screen.
 */
it("keeps the point under the pointer where it is", () => {
  const scroll = { left: 0, top: 1000 };
  const pointer = { x: 700, y: 400 };
  const edge = { x: 100, y: 120 };
  const ratio = 1.5;

  const next = anchoredScroll({ scroll, pointer, edge, ratio });

  // Where the point sat in the content before, and after the content grew.
  const withinY = pointer.y - edge.y;
  const before = scroll.top + withinY;
  const after = before * ratio;

  // On screen, measured from the scroller's edge: unchanged.
  expect(after - next.top).toBeCloseTo(withinY, 10);
});

/**
 * The same, zooming out — and scrolled far enough in that the answer is a real
 * offset rather than the zero clamp. Halving the content of a page scrolled
 * only a little asks for a negative offset, which is the *next* test.
 */
it("holds the anchor when zooming out too", () => {
  const scroll = { left: 2000, top: 900 };
  const pointer = { x: 300, y: 500 };
  const edge = { x: 0, y: 100 };
  const ratio = 0.5;

  const next = anchoredScroll({ scroll, pointer, edge, ratio });
  const withinX = pointer.x - edge.x;
  const before = scroll.left + withinX;

  expect(before * ratio - next.left).toBeCloseTo(withinX, 10);
});

/**
 * **Never negative**, because a browser reads a negative offset as zero and the
 * anchor would then drift — at the top of the document, which is exactly where
 * a writer spends most of their time.
 */
it("never asks for a negative scroll", () => {
  const next = anchoredScroll({
    scroll: { left: 0, top: 0 },
    pointer: { x: 200, y: 300 },
    edge: { x: 0, y: 0 },
    ratio: 0.25,
  });

  expect(next.left).toBeGreaterThanOrEqual(0);
  expect(next.top).toBeGreaterThanOrEqual(0);
});

/** A ratio of one is not a zoom, and must move nothing. */
it("leaves the scroll alone when the zoom does not change", () => {
  const scroll = { left: 33, top: 777 };
  const next = anchoredScroll({
    scroll,
    pointer: { x: 400, y: 400 },
    edge: { x: 20, y: 60 },
    ratio: 1,
  });

  expect(next.left).toBeCloseTo(scroll.left, 10);
  expect(next.top).toBeCloseTo(scroll.top, 10);
});
