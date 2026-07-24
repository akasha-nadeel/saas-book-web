import { expect, it } from "vitest";
import {
  DEFAULT_PAGE,
  MARGIN_PRESETS,
  PAGE_SIZES,
  pageMetrics,
  textWidth,
  type PageSetup,
} from "@/lib/page-setup";

const setup = (patch: Partial<PageSetup> = {}): PageSetup => ({
  ...DEFAULT_PAGE,
  ...patch,
});

it("defaults to a portrait 6×9 novel with book margins", () => {
  const m = pageMetrics(DEFAULT_PAGE);
  expect([m.width, m.height]).toEqual([6, 9]);
  // Book (mirrored): taller inside (left), shorter outside (right).
  expect([m.top, m.right, m.bottom, m.left]).toEqual([0.75, 0.65, 0.8, 0.9]);
});

it("swaps the sheet in landscape but not the margins", () => {
  // The top margin stays at the top of the page however the paper is turned —
  // rotating the margins with the sheet is the classic mistake here.
  const m = pageMetrics(setup({ orientation: "landscape" }));
  expect([m.width, m.height]).toEqual([9, 6]);
  expect([m.top, m.bottom]).toEqual([0.75, 0.8]);
});

it("keeps A4 landscape consistent with A4 portrait", () => {
  const portrait = pageMetrics(setup({ size: "a4" }));
  const landscape = pageMetrics(setup({ size: "a4", orientation: "landscape" }));
  expect(landscape.width).toBe(portrait.height);
  expect(landscape.height).toBe(portrait.width);
});

it("applies each margin preset", () => {
  expect(pageMetrics(setup({ margins: "narrow" })).left).toBe(0.5);
  expect(pageMetrics(setup({ margins: "moderate" })).left).toBe(0.75);
  expect(pageMetrics(setup({ margins: "wide" })).left).toBe(2);
});

it("renders mirrored margins as the recto page", () => {
  // No verso in a continuous scroll, so the wider inside margin lands on the
  // left.
  const m = pageMetrics(setup({ margins: "mirrored" }));
  expect(m.left).toBe(0.9);
  expect(m.right).toBe(0.65);
});

it("computes the text width inside the margins", () => {
  // Default 6×9 with book margins: 6 − 0.9 − 0.65.
  expect(textWidth(DEFAULT_PAGE)).toBeCloseTo(4.45, 5);
  expect(textWidth(setup({ size: "letter", margins: "wide" }))).toBeCloseTo(
    4.5,
    5,
  );
  expect(textWidth(setup({ size: "a4", margins: "narrow" }))).toBeCloseTo(
    7.27,
    5,
  );
});

it("never leaves a page with no room for text", () => {
  // Wide margins on the smallest sheet is the tightest combination offered.
  for (const size of Object.keys(PAGE_SIZES) as (keyof typeof PAGE_SIZES)[]) {
    for (const margins of Object.keys(
      MARGIN_PRESETS,
    ) as (keyof typeof MARGIN_PRESETS)[]) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const width = textWidth(setup({ size, margins, orientation }));
        expect(
          width,
          `${size}/${margins}/${orientation} leaves ${width}"`,
        ).toBeGreaterThan(1);
      }
    }
  }
});

it("falls back to defaults for an unknown size or margin", () => {
  // These values reach here from stored book records, which anything can write.
  const m = pageMetrics({
    ...DEFAULT_PAGE,
    size: "papyrus" as PageSetup["size"],
    margins: "enormous" as PageSetup["margins"],
  });
  expect([m.width, m.height]).toEqual([6, 9]);
  expect(m.left).toBe(0.9);
});

it("defaults to a 6×9 novel page", () => {
  expect(DEFAULT_PAGE.size).toBe("6x9");
  expect(DEFAULT_PAGE.margins).toBe("mirrored");
});

it("reports the same metrics whether or not it fits the window", () => {
  // Export reads these, and export never fits a window.
  const fixed = pageMetrics(setup({ fit: false }));
  const fluid = pageMetrics(setup({ fit: true }));
  expect(fluid).toEqual(fixed);
});
