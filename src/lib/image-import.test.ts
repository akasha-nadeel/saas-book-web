import { expect, it } from "vitest";
import {
  MAX_EDGE,
  dataUrlBytes,
  describeBytes,
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
