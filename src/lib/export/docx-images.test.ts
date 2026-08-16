import { describe, expect, it } from "vitest";
import { COLUMN_PX, fitImage } from "./docx-images";

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
