import { describe, expect, it } from "vitest";
import { paginationFrame, type PageGeometry, type Spacer } from "./pagination";

const geometry: PageGeometry = {
  pageW: 576,
  pageH: 864,
  mT: 72,
  mB: 72,
  mL: 72,
  mR: 72,
  contentH: 720,
  gap: 24,
};

const gaps: Spacer[] = [
  { pos: 12, height: 120, inline: false },
  { pos: 48, height: 96, inline: true },
];

describe("paginationFrame", () => {
  it("clears every decoration and reports one page when disabled", () => {
    expect(paginationFrame(null, { spacers: gaps, pages: 3 })).toEqual({
      spacers: [],
      pageCount: 1,
    });
  });

  it("uses fresh page gaps again when geometry is restored", () => {
    expect(paginationFrame(geometry, { spacers: gaps, pages: 3 })).toEqual({
      spacers: gaps,
      pageCount: 3,
    });
  });

  /*
   * **The count is reported, not counted from the gaps.**
   *
   * `spacers.length + 1` is only right while every sheet is opened by a gap,
   * and a block taller than the page covers several with no gap inside it —
   * so a long pasted list drew fewer sheets than its own text needed and the
   * prose ran off the last of them.
   */
  it("draws the sheets the arithmetic asked for, not one per gap", () => {
    expect(paginationFrame(geometry, { spacers: [], pages: 4 })).toEqual({
      spacers: [],
      pageCount: 4,
    });
  });
});
