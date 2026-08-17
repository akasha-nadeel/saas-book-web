import { expect, it } from "vitest";
import {
  DEFAULT_IMAGE_PERCENT,
  MIN_IMAGE_PERCENT,
  insertWidthPercent,
  resizedPercent,
} from "@/lib/editor/image-resize";

const drag = (over: Partial<Parameters<typeof resizedPercent>[0]> = {}) =>
  resizedPercent({
    startWidth: 200,
    columnWidth: 400,
    dx: 0,
    scale: 1,
    side: "right",
    ...over,
  });

it("reads a picture's width as a share of the column", () => {
  expect(drag()).toBe(50);
});

it("grows to the right and shrinks to the left on the right handle", () => {
  expect(drag({ dx: 100 })).toBe(75);
  expect(drag({ dx: -100 })).toBe(25);
});

it("mirrors the left handle, so both feel like pulling the edge outward", () => {
  expect(drag({ side: "left", dx: -100 })).toBe(75);
  expect(drag({ side: "left", dx: 100 })).toBe(25);
});

it("divides the pointer's travel by the page zoom", () => {
  // The bug this function exists for. The manuscript is drawn inside a CSS
  // zoom whose "100%" is really 1.3, so 130 viewport pixels of pointer is 100
  // layout pixels of picture. Counted raw, the edge outran the pointer by a
  // third and hit full width three quarters of the way across.
  expect(drag({ dx: 130, scale: 1.3 })).toBe(75);
  expect(drag({ dx: 260, scale: 2.6 })).toBe(75);
  // And the same travel read raw is the wrong answer, which is what shipped.
  expect(drag({ dx: 130, scale: 1 })).toBe(83);
});

it("never exceeds the column", () => {
  expect(drag({ dx: 10_000 })).toBe(100);
});

it("stops at a width the handles can still be grabbed on", () => {
  // A pixel floor was about six per cent of a paperback column — small enough
  // that the two handles overlapped and the only way out was undo.
  expect(drag({ dx: -10_000 })).toBe(MIN_IMAGE_PERCENT);
});

it("answers full width for a column of nothing rather than dividing by it", () => {
  expect(drag({ columnWidth: 0 })).toBe(100);
});

it("treats an impossible zoom as no zoom, so the drag stays usable", () => {
  expect(drag({ dx: 100, scale: 0 })).toBe(75);
  expect(drag({ dx: 100, scale: -1 })).toBe(75);
});

it("gives a picture too big for the page a size to start at", () => {
  // Without this it lands at max-width: 100% — the full column, every time.
  expect(insertWidthPercent(1400, 430)).toBe(`${DEFAULT_IMAGE_PERCENT}%`);
});

it("leaves a picture that already fits alone", () => {
  // Null is no width attribute at all, so it draws at its own size. Setting
  // half a column here would *enlarge* a small logo past its own pixels.
  expect(insertWidthPercent(200, 430)).toBeNull();
  expect(insertWidthPercent(430, 430)).toBeNull();
});

it("falls back to a default when there is nothing to measure", () => {
  // The unusable case is the large picture, so an unknown one takes the size
  // that is safe there.
  expect(insertWidthPercent(0, 430)).toBe(`${DEFAULT_IMAGE_PERCENT}%`);
  expect(insertWidthPercent(1400, 0)).toBe(`${DEFAULT_IMAGE_PERCENT}%`);
});
