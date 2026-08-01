import { describe, expect, it } from "vitest";
import {
  checkCover,
  contrastOf,
  IDEAL_HEIGHT,
  IDEAL_WIDTH,
  MAX_BYTES,
  MIN_LONG_EDGE,
  type CoverFacts,
} from "./cover-check";

const facts = (over: Partial<CoverFacts> = {}): CoverFacts => ({
  width: IDEAL_WIDTH,
  height: IDEAL_HEIGHT,
  bytes: 900_000,
  ...over,
});

const ids = (over: Partial<CoverFacts> = {}) =>
  checkCover(facts(over)).map((f) => f.id);
const problems = (over: Partial<CoverFacts> = {}) =>
  checkCover(facts(over)).filter((f) => f.level === "problem");

describe("checkCover — what a shop refuses", () => {
  it("calls a cover under the minimum a problem", () => {
    const found = problems({ width: 400, height: 640 });
    expect(found[0].id).toBe("too-small");
    expect(found[0].detail).toContain(String(MIN_LONG_EDGE));
  });

  it("calls an oversized file a problem, and says what to do", () => {
    const found = problems({ bytes: MAX_BYTES + 1 });
    expect(found[0].id).toBe("too-heavy");
    // Shrinking the picture is the wrong fix and the commonest one.
    expect(found[0].detail).toContain("quality");
  });

  it("is happy with a cover at the recommended size", () => {
    expect(problems()).toEqual([]);
  });
});

describe("checkCover — what is only worth knowing", () => {
  /**
   * The rule the module is written under: a cover being *good* is not
   * measurable, so only the two things a shop actually refuses are problems.
   */
  it("never calls the shape or the contrast a problem", () => {
    expect(problems({ width: 2000, height: 2000 })).toEqual([]);
    expect(problems({ contrast: 0.01 })).toEqual([]);
  });

  it("notices a cover that is squarer than a shop's thumbnail", () => {
    expect(ids({ width: 2000, height: 2000 })).toContain("shape");
  });

  it("notices a cover that is far taller", () => {
    expect(ids({ width: 1000, height: 2600 })).toContain("shape");
  });

  it("says nothing about the shape of an ordinary cover", () => {
    expect(ids()).not.toContain("shape");
  });

  it("mentions a cover that is acceptable but under the recommendation", () => {
    expect(ids({ width: 1000, height: 1600 })).toContain("small-ish");
  });

  it("does not mention size when the cover is big enough", () => {
    expect(ids()).not.toContain("small-ish");
  });

  it("mentions a flat image, and says it may be deliberate", () => {
    const flat = checkCover(facts({ contrast: 0.02 })).find(
      (f) => f.id === "flat",
    )!;
    expect(flat.level).toBe("note");
    expect(flat.detail).toContain("literary");
  });

  it("says nothing about contrast when it was not measured", () => {
    expect(ids()).not.toContain("flat");
  });
});

describe("contrastOf", () => {
  const fill = (r: number, g: number, b: number, count = 400) => {
    const out = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = 255;
    }
    return out;
  };

  it("reports nothing for a single flat colour", () => {
    expect(contrastOf(fill(128, 128, 128), 4)).toBe(0);
  });

  it("reports a lot for black against white", () => {
    const pixels = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) {
      const value = i % 2 === 0 ? 0 : 255;
      pixels[i * 4] = value;
      pixels[i * 4 + 1] = value;
      pixels[i * 4 + 2] = value;
      pixels[i * 4 + 3] = 255;
    }
    expect(contrastOf(pixels, 4)).toBeGreaterThan(0.4);
  });

  it("has nothing to say about no pixels at all", () => {
    expect(contrastOf(new Uint8ClampedArray(0))).toBe(0);
  });
});
