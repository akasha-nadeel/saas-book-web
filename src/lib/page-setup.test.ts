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

it("defaults to portrait Letter with normal margins", () => {
  const m = pageMetrics(DEFAULT_PAGE);
  expect([m.width, m.height]).toEqual([8.5, 11]);
  expect([m.top, m.right, m.bottom, m.left]).toEqual([1, 1, 1, 1]);
});

it("swaps the sheet in landscape but not the margins", () => {
  // A 1" top margin stays at the top of the page however the paper is turned —
  // rotating the margins with the sheet is the classic mistake here.
  const m = pageMetrics(setup({ orientation: "landscape" }));
  expect([m.width, m.height]).toEqual([11, 8.5]);
  expect([m.top, m.bottom]).toEqual([1, 1]);
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
  // No verso in a continuous scroll, so inside lands on the left.
  const m = pageMetrics(setup({ margins: "mirrored" }));
  expect(m.left).toBe(1.25);
  expect(m.right).toBe(1);
});

it("computes the text width inside the margins", () => {
  expect(textWidth(DEFAULT_PAGE)).toBeCloseTo(6.5, 5);
  expect(textWidth(setup({ margins: "wide" }))).toBeCloseTo(4.5, 5);
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
  expect([m.width, m.height]).toEqual([8.5, 11]);
  expect(m.left).toBe(1);
});

it("fits the window by default, while keeping a paper size for export", () => {
  // The editing surface and the exported document are different questions:
  // Letter is what leaves the app, fit is how it looks while writing.
  expect(DEFAULT_PAGE.fit).toBe(true);
  expect(DEFAULT_PAGE.size).toBe("letter");
});

it("reports the same metrics whether or not it fits the window", () => {
  // Export reads these, and export never fits a window.
  const fixed = pageMetrics(setup({ fit: false }));
  const fluid = pageMetrics(setup({ fit: true }));
  expect(fluid).toEqual(fixed);
});
