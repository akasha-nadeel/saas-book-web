import { expect, it } from "vitest";
import {
  MAX_EDGE,
  QUALITY_FLOOR,
  START_QUALITY,
  dataUrlBytes,
  describeBytes,
  encodeAttempts,
  targetSize,
} from "@/lib/image-import";

it("leaves an image already within the limit alone", () => {
  expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
});

it("never upscales a small image", () => {
  expect(targetSize(40, 20)).toEqual({ width: 40, height: 20 });
});

it("fits the longest edge, whichever it is", () => {
  expect(targetSize(4000, 2000)).toEqual({ width: MAX_EDGE, height: 700 });
  expect(targetSize(2000, 4000)).toEqual({ width: 700, height: MAX_EDGE });
});

it("keeps the aspect ratio", () => {
  const { width, height } = targetSize(3000, 2000);
  expect(width / height).toBeCloseTo(3000 / 2000, 2);
});

it("never rounds an edge down to zero", () => {
  // A 5000x1 banner: flooring the height gives 0, and a zero-sized canvas
  // throws when drawn to.
  const { width, height } = targetSize(5000, 1);
  expect(width).toBe(MAX_EDGE);
  expect(height).toBeGreaterThanOrEqual(1);
});

it("handles a square", () => {
  expect(targetSize(3000, 3000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
});

it("measures a data URL's payload", () => {
  // "aGk=" is "hi" — two bytes with one padding character.
  expect(dataUrlBytes("data:image/webp;base64,aGk=")).toBe(2);
  expect(dataUrlBytes("data:image/webp;base64,")).toBe(0);
  expect(dataUrlBytes("not a data url")).toBe(0);
});

it("describes sizes the way a person reads them", () => {
  expect(describeBytes(940)).toBe("1KB");
  expect(describeBytes(240_000)).toBe("240KB");
  expect(describeBytes(2_400_000)).toBe("2.4MB");
});

/*
 * The ladder that replaced a refusal.
 *
 * `importImage` used to encode once and hand back "too large to store in the
 * browser" — a job a writer cannot do and a picture usually two quality points
 * from fitting. These pin the order it now tries instead: every quality at one
 * size before the size moves, and the quality restarting from the top after
 * each shrink, because a smaller picture at 0.9 both weighs less and looks
 * better than a larger one at 0.6.
 */
it("tries the best encode first", () => {
  const [first] = encodeAttempts(700, START_QUALITY.jpeg);
  expect(first).toEqual({ edge: 700, quality: 0.9 });
});

it("drops quality before it drops pixels", () => {
  const attempts = encodeAttempts(700, START_QUALITY.jpeg);
  const firstShrink = attempts.findIndex((a) => a.edge < 700);

  // Everything before the first shrink is the full size at falling quality.
  expect(attempts.slice(0, firstShrink).every((a) => a.edge === 700)).toBe(true);
  expect(attempts[firstShrink - 1].quality).toBeLessThanOrEqual(QUALITY_FLOOR);
});

it("starts the quality ladder again at each new size", () => {
  const attempts = encodeAttempts(700, START_QUALITY.jpeg);
  const firstShrink = attempts.findIndex((a) => a.edge < 700);
  expect(attempts[firstShrink].quality).toBe(0.9);
});

it("never goes below the quality floor, or above where it started", () => {
  for (const start of [START_QUALITY.jpeg, START_QUALITY.webp, 0.92]) {
    for (const attempt of encodeAttempts(2560, start)) {
      expect(attempt.quality).toBeLessThanOrEqual(start);
      expect(attempt.quality).toBeGreaterThanOrEqual(QUALITY_FLOOR);
    }
  }
});

it("keeps the quality readable rather than floating-point exact", () => {
  // 0.9 - 0.08 - 0.08 is 0.7400000000000001 in binary floating point, and a
  // number like that in a log is the kind of thing that gets "fixed".
  const qualities = encodeAttempts(700, 0.9)
    .filter((a) => a.edge === 700)
    .map((a) => a.quality);
  expect(qualities).toEqual([0.9, 0.82, 0.74, 0.66, 0.6]);
});

it("shrinks a long way, and then stops", () => {
  const attempts = encodeAttempts(700, START_QUALITY.jpeg);
  const edges = [...new Set(attempts.map((a) => a.edge))];
  expect(edges).toEqual([700, 595, 506, 430]);
});

it("never asks for a zero-pixel edge", () => {
  // A one-pixel source is the shrink ladder's edge case, and a zero-sized
  // canvas throws when drawn to.
  expect(encodeAttempts(1, 0.9).every((a) => a.edge >= 1)).toBe(true);
});
