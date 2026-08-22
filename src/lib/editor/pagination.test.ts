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
    expect(paginationFrame(null, gaps)).toEqual({ spacers: [], pageCount: 1 });
  });

  it("uses fresh page gaps again when geometry is restored", () => {
    expect(paginationFrame(geometry, gaps)).toEqual({
      spacers: gaps,
      pageCount: 3,
    });
  });
});
