import { describe, expect, it } from "vitest";
import {
  checkCover,
  enlarge,
  IDEAL_RATIO,
  reshape,
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

describe("reshape", () => {
  // The screenshot case: 736×1308 is 1.78:1 against a 1.6:1 shelf.
  it("crops a tall cover by trimming its height", () => {
    const out = reshape(736, 1308, "crop");
    expect(out.width).toBe(736);
    expect(out.height).toBe(1178);
    expect(out.changed).toBe(130);
  });

  it("pads a tall cover by widening it, keeping every pixel", () => {
    const out = reshape(736, 1308, "pad");
    expect(out.height).toBe(1308);
    expect(out.width).toBe(818);
    expect(out.changed).toBe(82);
  });

  it("crops a squat cover by trimming its width", () => {
    const out = reshape(1600, 2000, "crop");
    expect(out.height).toBe(2000);
    expect(out.width).toBe(1250);
  });

  it("pads a squat cover by making it taller", () => {
    const out = reshape(1600, 2000, "pad");
    expect(out.width).toBe(1600);
    expect(out.height).toBe(2560);
  });

  it("lands on the ideal ratio either way", () => {
    for (const mode of ["crop", "pad"] as const) {
      const out = reshape(736, 1308, mode);
      expect(out.height / out.width).toBeCloseTo(IDEAL_RATIO, 2);
    }
  });

  // Cropping removes pixels, so it can push a marginal cover under the floor.
  // The screen has to be able to say so rather than hand back a worse file.
  it("says when cropping drops the result below what a shop accepts", () => {
    // 600×1400 crops to 600×960 — under the 1000px floor — while padding it
    // to 875×1400 keeps it over.
    expect(reshape(600, 1400, "crop").tooSmall).toBe(true);
    expect(reshape(600, 1400, "pad").tooSmall).toBe(false);
  });

  it("never upscales — the kept edge keeps its own pixels", () => {
    const crop = reshape(736, 1308, "crop");
    expect(crop.width).toBeLessThanOrEqual(736);
    expect(crop.height).toBeLessThanOrEqual(1308);
  });
});

describe("enlarge", () => {
  it("covers the recommended frame", () => {
    const out = enlarge(1447, 1087);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(2560);
    expect(out.drawWidth).toBeGreaterThanOrEqual(1600);
    expect(out.drawHeight).toBeGreaterThanOrEqual(2560);
  });

  // The number the screen has to be honest about: anything above 1 means the
  // result is interpolated and no sharper than what went in.
  it("reports the factor it scaled by", () => {
    expect(enlarge(1447, 1087).factor).toBeGreaterThan(1);
    expect(enlarge(3200, 5120).factor).toBeLessThan(1);
  });

  it("does not distort — one factor drives both edges", () => {
    const out = enlarge(1000, 800);
    expect(out.drawWidth / 1000).toBeCloseTo(out.drawHeight / 800, 5);
  });
});
