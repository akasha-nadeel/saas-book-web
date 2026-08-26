import { describe, expect, it } from "vitest";
import { COLUMN_PX, PAGE_PX, fitCover, fitImage } from "./docx-images";

/**
 * The half of the Word image path that can be tested: the arithmetic. The
 * decoding needs a canvas and a browser, and is not.
 */
describe("fitImage", () => {
  it("leaves a picture that fits at its own size", () => {
    expect(fitImage({ width: 300, height: 200 }, undefined)).toEqual({
      width: 300,
      height: 200,
    });
  });

  /**
   * **The cap is the one that matters.** Word does not shrink an oversized
   * picture to the column — it lets it run past the margin, so a manuscript
   * arrives with a photograph hanging off the edge of the paper.
   */
  it("caps a picture at the column and keeps its ratio", () => {
    const fitted = fitImage({ width: 2000, height: 1000 }, undefined);
    expect(fitted.width).toBe(COLUMN_PX);
    expect(fitted.height).toBe(Math.round(COLUMN_PX / 2));
  });

  /**
   * The editor stores a width as a share of the column, because that is the
   * only thing that survives a change of trim size — so the share is resolved
   * against the real column here rather than travelling into the file.
   */
  it("reads a stored width as a share of the column", () => {
    expect(fitImage({ width: 2000, height: 1000 }, "50%").width).toBe(
      Math.round(COLUMN_PX / 2),
    );
    expect(fitImage({ width: 100, height: 100 }, "25%").width).toBe(
      Math.round(COLUMN_PX / 4),
    );
  });

  it("never lets a stored width past the column either", () => {
    expect(fitImage({ width: 100, height: 100 }, "400%").width).toBe(COLUMN_PX);
  });

  /**
   * A height is never taken from the writer — only a width, with the ratio
   * following — because the two together are how a picture gets squashed.
   */
  it("keeps the picture's own ratio at every size", () => {
    for (const requested of [undefined, "10%", "60%", "100%"]) {
      const fitted = fitImage({ width: 1600, height: 900 }, requested);
      expect(fitted.height / fitted.width).toBeCloseTo(900 / 1600, 2);
    }
  });

  it("answers nothing for a picture with no dimensions", () => {
    expect(fitImage({ width: 0, height: 0 }, undefined)).toEqual({
      width: 0,
      height: 0,
    });
  });
});

// --- the cover ---------------------------------------------------------

/**
 * **A cover is fitted to the sheet, which is the one place `fitImage`'s rule
 * is wrong.** At the full column width a 2:3 cover stands 936px tall against a
 * 864px page, and Word answers a picture that will not fit by pushing the whole
 * thing onto the next sheet — so the cover page comes out blank and the cover
 * lands on page two.
 */
it("keeps a tall cover on one sheet", () => {
  const fitted = fitCover({ width: 1600, height: 2560 });

  expect(fitted.height).toBeLessThanOrEqual(PAGE_PX);
  expect(fitted.width).toBeLessThanOrEqual(COLUMN_PX);
  // The artwork's own ratio, never squashed to fit.
  expect(fitted.width / fitted.height).toBeCloseTo(1600 / 2560, 2);
});

it("holds a wide cover to the column instead", () => {
  // Wider than it is tall: the height is not what binds, so the column does.
  const fitted = fitCover({ width: 2000, height: 1000 });
  expect(fitted.width).toBe(COLUMN_PX);
  expect(fitted.height).toBeLessThanOrEqual(PAGE_PX);
});

it("answers nothing for a picture with no size", () => {
  expect(fitCover({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 });
});
