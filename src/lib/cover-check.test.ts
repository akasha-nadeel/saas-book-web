import { describe, expect, it } from "vitest";
import {
  checkCover,
  coverReport,
  enlarge,
  IDEAL_RATIO,
  reshape,
  contrastOf,
  IDEAL_HEIGHT,
  IDEAL_WIDTH,
  MAX_BYTES,
  MIN_HEIGHT,
  MIN_WIDTH,
  MAX_EDGE,
  COVER_TYPES,
  edgeLightness,
  jpegComponents,
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
    expect(found[0].detail).toContain(String(MIN_HEIGHT));
  });

  /**
   * Amazon's floor is "1000 pixels in height and 625 pixels in width" — two
   * conditions. Read as one rule about the longest side, as it was until
   * 2026-08-11, a 1200 × 500 cover passed here and was refused there.
   */
  it("applies the floor per edge, not to the longest side", () => {
    expect(ids({ width: 500, height: 1200 })).toContain("too-small");
    expect(ids({ width: 1200, height: 500 })).toContain("too-small");
    expect(ids({ width: MIN_WIDTH, height: MIN_HEIGHT })).not.toContain(
      "too-small",
    );
  });

  it("names the edge that failed rather than saying only 'too small'", () => {
    expect(problems({ width: 500, height: 1200 })[0].detail).toContain("wide");
    expect(problems({ width: 1200, height: 500 })[0].detail).toContain("tall");
  });

  /** Nothing checked the ceiling at all: a 12,000px print file passed. */
  it("calls a cover over the maximum a problem", () => {
    const found = problems({ width: 8000, height: 12_800 });
    expect(found[0].id).toBe("too-big");
    expect(found[0].detail).toContain(MAX_EDGE.toLocaleString());
    expect(ids({ width: MAX_EDGE, height: MAX_EDGE })).not.toContain("too-big");
  });

  /**
   * The commonest avoidable rejection: PNG is what design tools export by
   * default and Amazon takes only JPEG and TIFF.
   */
  it("refuses a format Amazon does not take, and names it", () => {
    const found = problems({ type: "image/png" });
    expect(found[0].id).toBe("format");
    expect(found[0].label).toContain("PNG");
  });

  it("accepts both formats Amazon lists", () => {
    for (const type of COVER_TYPES) {
      expect(ids({ type })).not.toContain("format");
    }
  });

  /** A measurement read back from storage carries no file to read a type off. */
  it("says nothing about format when there was no file", () => {
    expect(ids()).not.toContain("format");
  });

  it("calls an oversized file a problem, and says what to do", () => {
    const found = problems({ bytes: MAX_BYTES + 1 });
    expect(found[0].id).toBe("too-heavy");
    // Shrinking the picture is the wrong fix and the commonest one.
    expect(found[0].detail).toContain("quality");
  });

  /**
   * Amazon's wording is "must be less than 50MB", so exactly 50MB is refused
   * there. This passed it until 2026-08-11 — one byte, and the writer it
   * happens to has no way of knowing why.
   */
  it("refuses a file of exactly the limit, which is not 'less than'", () => {
    expect(ids({ bytes: MAX_BYTES })).toContain("too-heavy");
    expect(ids({ bytes: MAX_BYTES - 1 })).not.toContain("too-heavy");
  });

  /**
   * The rule no other check on the screen can stand in for: a canvas decodes
   * CMYK to RGB, so every measurement passes and Amazon still refuses it.
   */
  it("refuses a colour-separated file", () => {
    const found = problems({ components: 4 });
    expect(found[0].id).toBe("cmyk");
    expect(found[0].detail).toContain("RGB");
  });

  it("accepts three-component colour and one-component greyscale", () => {
    expect(ids({ components: 3 })).not.toContain("cmyk");
    expect(ids({ components: 1 })).not.toContain("cmyk");
  });

  it("says nothing about colour when the file could not be parsed", () => {
    expect(ids()).not.toContain("cmyk");
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
    expect(ids({ width: 1000, height: 2600 })).toContain("tall");
  });

  it("says nothing about the shape of an ordinary cover", () => {
    expect(ids()).not.toContain("shape");
    expect(ids()).not.toContain("tall");
  });

  /**
   * **The one-sided rule, and the test not to "fix".** Amazon's wording is "at
   * least 1.6:1", so taller than that is *within* the guidance and squarer is
   * not. Both used to be one symmetric band, which told a writer with a
   * perfectly acceptable 1.78:1 cover that it was unusual. Only the squarer
   * finding may cite the guideline as unmet.
   */
  it("does not tell a taller-than-ideal cover it is under the guideline", () => {
    const tall = checkCover(facts({ width: 1000, height: 2600 })).find(
      (f) => f.id === "tall",
    )!;
    expect(tall.detail).toContain("meets the guidance");
    const square = checkCover(facts({ width: 2000, height: 2000 })).find(
      (f) => f.id === "shape",
    )!;
    expect(square.label).toContain("Squarer");
  });

  /**
   * Amazon's own border guidance: a white or very light background "seems to
   * disappear" against the shop's white page.
   */
  it("mentions a cover whose edges are nearly white", () => {
    const pale = checkCover(facts({ edge: 0.98 })).find(
      (f) => f.id === "pale-edge",
    )!;
    expect(pale.level).toBe("note");
    expect(pale.detail).toContain("border");
  });

  it("says nothing about the edge of a cover with a dark one", () => {
    expect(ids({ edge: 0.3 })).not.toContain("pale-edge");
  });

  it("says nothing about the edge when it was not measured", () => {
    expect(ids()).not.toContain("pale-edge");
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

describe("coverReport — the checklist a writer reads", () => {
  const report = (over: Partial<CoverFacts> = {}) => coverReport(facts(over));
  const byId = (over: Partial<CoverFacts> = {}) =>
    new Map(report(over).map((c) => [c.id, c]));

  /**
   * The reason this function exists. A report that only lists failures renders
   * a clean file as a blank, which reads exactly like a check that did not
   * run.
   */
  it("still says what it looked at when nothing is wrong", () => {
    const over = {
      contrast: 0.4,
      edge: 0.3,
      type: "image/jpeg",
      components: 3,
    };
    const clean = report(over);
    expect(checkCover(facts(over))).toEqual([]);
    expect(clean).toHaveLength(7);
    expect(clean.every((c) => c.status === "pass")).toBe(true);
  });

  /**
   * The drift guard. Add a finding to `checkCover` and forget to claim it here
   * and it vanishes from the one screen built to show it — silently, because a
   * missing row looks like a rule that passed.
   */
  it("claims every finding checkCover can emit", () => {
    const cases: Partial<CoverFacts>[] = [
      { width: 400, height: 640 },
      { width: 1200, height: 500 },
      { width: 8000, height: 12_800 },
      { type: "image/png" },
      { bytes: MAX_BYTES + 1 },
      { width: 2000, height: 2000 },
      { width: 1000, height: 2600 },
      { width: 1000, height: 1600 },
      { contrast: 0.02 },
      { edge: 0.98 },
      { components: 4 },
    ];
    for (const over of cases) {
      const claimed = new Set(
        coverReport(facts(over))
          .map((c) => c.from)
          .filter(Boolean),
      );
      for (const finding of checkCover(facts(over))) {
        expect(claimed).toContain(finding.id);
      }
    }
  });

  it("carries the finding's own level and words, never a second opinion", () => {
    const small = byId({ width: 400, height: 640 }).get("size")!;
    const finding = checkCover(facts({ width: 400, height: 640 }))[0];
    expect(small.status).toBe("problem");
    expect(small.label).toBe(finding.label);
    expect(small.detail).toBe(finding.detail);
  });

  it("folds all three pixel findings onto the one size rule", () => {
    expect(byId({ width: 400, height: 640 }).get("size")!.from).toBe(
      "too-small",
    );
    expect(byId({ width: 8000, height: 12_800 }).get("size")!.from).toBe(
      "too-big",
    );
    expect(byId({ width: 1000, height: 1600 }).get("size")!.from).toBe(
      "small-ish",
    );
  });

  it("folds both shape findings onto the one shape rule", () => {
    expect(byId({ width: 2000, height: 2000 }).get("shape")!.from).toBe(
      "shape",
    );
    expect(byId({ width: 1000, height: 2600 }).get("shape")!.from).toBe("tall");
  });

  /**
   * Not a "fix these" list: the rows must stay put so a reader learns where to
   * look, rather than reshuffling with every file dropped.
   */
  it("keeps one row per rule, in the same order, whatever the answers", () => {
    const all = {
      contrast: 0.4,
      edge: 0.3,
      type: "image/jpeg",
      components: 3,
    };
    const order = (over: Partial<CoverFacts>) =>
      report({ ...all, ...over }).map((c) => c.id);
    const expected = [
      "size",
      "shape",
      "format",
      "colour",
      "weight",
      "contrast",
      "edge",
    ];
    expect(order({})).toEqual(expected);
    expect(
      order({
        width: 400,
        height: 640,
        bytes: MAX_BYTES + 1,
        type: "image/png",
        components: 4,
        contrast: 0.01,
        edge: 0.99,
      }),
    ).toEqual(expected);
  });

  /**
   * A tick against a number nobody has is an invented answer, and the most
   * believable kind. `bytes: 0` is what the stored measurements carry, and a
   * stored measurement has no file to read a type or an edge off.
   */
  it("leaves out a rule it has nothing to measure rather than passing it", () => {
    expect(byId({ bytes: 0 }).has("weight")).toBe(false);
    expect(byId().has("contrast")).toBe(false);
    expect(byId().has("format")).toBe(false);
    expect(byId().has("edge")).toBe(false);
    // The one that matters most: CMYK is invisible to every other check, so a
    // file whose colour mode could not be parsed must not read as RGB.
    expect(byId().has("colour")).toBe(false);
  });
});

describe("jpegComponents", () => {
  /** A JPEG head: SOI, then the given segments, then a frame header. */
  const jpeg = (components: number, before: number[][] = [], marker = 0xc0) => {
    const out = [0xff, 0xd8];
    for (const payload of before) {
      const length = payload.length + 2;
      out.push(0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload);
    }
    // marker, length, precision, height ×2, width ×2, components
    out.push(
      0xff,
      marker,
      0x00,
      0x11,
      0x08,
      0x0a,
      0x00,
      0x06,
      0x40,
      components,
    );
    return new Uint8Array(out);
  };

  it("reads an ordinary colour JPEG as three components", () => {
    expect(jpegComponents(jpeg(3))).toBe(3);
  });

  it("reads a CMYK JPEG as four", () => {
    expect(jpegComponents(jpeg(4))).toBe(4);
  });

  it("reads a greyscale JPEG as one", () => {
    expect(jpegComponents(jpeg(1))).toBe(1);
  });

  /**
   * The reason it walks the chain instead of reading a fixed offset: a JPEG
   * out of a design tool carries EXIF and an ICC profile before the frame,
   * and their lengths are the only way past them.
   */
  it("walks past EXIF and ICC segments to reach the frame header", () => {
    const segments = [new Array(120).fill(0x00), new Array(3000).fill(0x11)];
    expect(jpegComponents(jpeg(4, segments))).toBe(4);
  });

  it("reads a progressive frame as well as a baseline one", () => {
    expect(jpegComponents(jpeg(3, [], 0xc2))).toBe(3);
  });

  /**
   * "Cannot tell" and "is wrong" must not become the same answer — a null
   * drops the rule from the report rather than failing it.
   */
  it("answers null for anything it cannot follow", () => {
    expect(jpegComponents(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(null);
    expect(jpegComponents(new Uint8Array([]))).toBe(null);
    expect(jpegComponents(new Uint8Array([0xff, 0xd8]))).toBe(null);
    // Truncated before the frame header arrives.
    expect(jpegComponents(jpeg(3).slice(0, 8))).toBe(null);
  });

  /**
   * 0xC4 is a Huffman table, not a frame header, and it shares the 0xC_ range
   * with the eleven markers that are. Read as one, the byte at its own +9
   * offset is whatever the table happens to hold — here a 4, which would
   * report an ordinary colour JPEG as CMYK and send somebody to re-export a
   * file that was already right.
   */
  it("does not mistake a table marker in the same range for a frame", () => {
    // Length 0x000b covers the two length bytes plus nine of payload, and the
    // sixth of those sits exactly where a frame's component count would.
    const dht = [
      0xff, 0xc4, 0x00, 0x0b, 0x00, 0x01, 0x02, 0x03, 0x04, 0x04, 0x06, 0x07,
      0x08,
    ];
    const withTable = new Uint8Array([0xff, 0xd8, ...dht, ...jpeg(3).slice(2)]);
    expect(jpegComponents(withTable)).toBe(3);
  });
});

describe("edgeLightness", () => {
  /** A `width` × `height` field, `fill` everywhere, `border` on the outer ring. */
  const frame = (
    width: number,
    height: number,
    fill: number,
    border = fill,
    ring = 2,
  ) => {
    const out = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edge =
          x < ring || y < ring || x >= width - ring || y >= height - ring;
        const v = edge ? border : fill;
        const i = (y * width + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = v;
        out[i + 3] = 255;
      }
    }
    return out;
  };

  it("reads a white frame as near 1 and a black one as near 0", () => {
    expect(edgeLightness(frame(20, 32, 0, 255), 20, 32)).toBeGreaterThan(0.95);
    expect(edgeLightness(frame(20, 32, 255, 0), 20, 32)).toBeLessThan(0.05);
  });

  /**
   * The reason it samples the frame rather than the image: a bright middle on
   * an otherwise dark jacket is nobody's problem, and a mean over the whole
   * picture would call it one.
   */
  it("ignores the middle of the picture entirely", () => {
    expect(edgeLightness(frame(20, 32, 255, 20), 20, 32)).toBeLessThan(0.15);
  });

  it("has nothing to say about an empty image", () => {
    expect(edgeLightness(new Uint8ClampedArray(0), 0, 0)).toBe(0);
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
