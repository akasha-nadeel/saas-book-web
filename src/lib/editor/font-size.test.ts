import { expect, it } from "vitest";
import {
  fontSizeCss,
  steppedFontSize,
  FONT_SIZE_STEPS,
} from "@/lib/editor/font-size";

it("renders a size as a multiple of the body size", () => {
  // Against --ms-size, not em, so it does not compound inside a heading.
  expect(fontSizeCss(1.5)).toBe("calc(var(--ms-size, 1em) * 1.5)");
});

it("steps up from the body size", () => {
  // No size yet means body size; one step up is the first size above 1.
  expect(steppedFontSize(null, 1)).toBe(1.15);
  expect(steppedFontSize(1.15, 1)).toBe(1.3);
});

it("steps down, and returns null at the body size to clear the mark", () => {
  // Stepping down to 1 clears the mark rather than storing a redundant size.
  expect(steppedFontSize(1.15, -1)).toBeNull();
  expect(steppedFontSize(null, -1)).toBe(0.85);
});

it("clamps at both ends of the scale", () => {
  const largest = FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1];
  expect(steppedFontSize(largest, 1)).toBe(largest);
  expect(steppedFontSize(0.85, -1)).toBe(0.85);
});

it("treats an unknown size as the body size", () => {
  expect(steppedFontSize(3.7, 1)).toBe(1.15);
});
