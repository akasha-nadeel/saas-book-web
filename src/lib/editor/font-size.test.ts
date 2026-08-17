import { expect, it } from "vitest";
import {
  fontSizeCss,
  fontSizeOptions,
  fontSizePt,
  FONT_SIZE_STEPS,
} from "@/lib/editor/font-size";

it("renders a size as a multiple of the body size", () => {
  // Against --ms-size, not em, so it does not compound inside a heading.
  expect(fontSizeCss(1.5)).toBe("calc(var(--ms-size, 1em) * 1.5)");
});

it("offers a row for every step on the scale", () => {
  expect(fontSizeOptions(12)).toHaveLength(FONT_SIZE_STEPS.length);
});

it("carries null for the body size, so choosing it clears the mark", () => {
  // The one row that must not store a value: a stored 1 is a redundant mark
  // that would stop the run rescaling with the book.
  const body = fontSizeOptions(12).filter((o) => o.body);
  expect(body).toHaveLength(1);
  expect(body[0].multiple).toBeNull();
  expect(body[0].pt).toBe(12);
});

it("stores a multiple and shows points", () => {
  const options = fontSizeOptions(12);
  expect(options.map((o) => o.pt)).toEqual([10, 12, 14, 16, 18, 21, 24, 30]);
  // The stored values are untouched by the rounding above.
  expect(options.map((o) => o.multiple)).toEqual([
    0.85,
    null,
    1.15,
    1.3,
    1.5,
    1.75,
    2,
    2.5,
  ]);
});

it("moves every label when the book's body size moves", () => {
  // The reason the label is computed rather than stored: one run, two books,
  // two true answers. A written-down "18 pt" would be wrong in the second.
  const at12 = fontSizeOptions(12).find((o) => o.multiple === 1.5);
  const at14 = fontSizeOptions(14).find((o) => o.multiple === 1.5);
  expect(at12?.pt).toBe(18);
  expect(at14?.pt).toBe(21);
});

it("reports no mark as the body size", () => {
  expect(fontSizePt(12, null)).toBe(12);
  expect(fontSizePt(14, null)).toBe(14);
});

it("reports an off-scale size as itself, not as the nearest step", () => {
  // An imported chapter can carry a multiple this scale does not offer. The
  // control that reports the selection's size must not round it into a size
  // the document does not have.
  expect(fontSizePt(12, 1.2)).toBe(14);
  expect(fontSizePt(12, 3.7)).toBe(44);
});
