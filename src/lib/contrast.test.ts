import { describe, expect, it } from "vitest";
import { AA_TEXT, contrast, luminance, parseHex } from "./contrast";

describe("parseHex", () => {
  it("reads both lengths, with or without the hash", () => {
    expect(parseHex("#ffffff")).toEqual([255, 255, 255]);
    expect(parseHex("000000")).toEqual([0, 0, 0]);
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("  #E7D8C6  ")).toEqual([231, 216, 198]);
  });

  it("refuses what it cannot measure", () => {
    // Eight digits is a hex with alpha, and a translucent colour has no ratio
    // until you know what is behind it. Refused rather than truncated.
    expect(parseHex("#ffffff80")).toBeNull();
    expect(parseHex("color-mix(in srgb, red 50%, blue)")).toBeNull();
    expect(parseHex("var(--color-fg)")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("luminance", () => {
  it("puts black and white at the ends", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("weights green heaviest, as the eye does", () => {
    expect(luminance([0, 255, 0])).toBeGreaterThan(luminance([255, 0, 0]));
    expect(luminance([255, 0, 0])).toBeGreaterThan(luminance([0, 0, 255]));
  });
});

describe("contrast", () => {
  it("puts black on white at 21:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("puts a colour against itself at 1:1", () => {
    expect(contrast("#7f7a57", "#7f7a57")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the pair is given", () => {
    const a = contrast("#434140", "#e7d8c6");
    const b = contrast("#e7d8c6", "#434140");
    expect(a).toEqual(b);
  });

  it("agrees with the published figure for a known pair", () => {
    // 4.54:1 — the pair every accessibility guide uses as the example that
    // scrapes AA rather than clearing it comfortably.
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  /**
   * The measurement behind the decision to make each swatch a *seed* rather
   * than a page ground.
   *
   * **Not that the mid-tones fail outright — that they only work one way.**
   * Tawny clears black at 5.98 and misses white at 3.51; Copper misses black
   * at 4.21 and clears white at 4.99; Olive clears black at 4.82 and misses
   * white at 4.35. So a ground built from any of them is committed to one ink
   * with almost no headroom, and a `muted` a step down from that ink has none
   * at all — which is the value hints and metadata are set in.
   *
   * The three light swatches are the other story and are recorded here too:
   * Parchment against black is 15:1, and Charcoal and Aubergine against white
   * are 10:1 and 8.6:1. Those three would have worked as literal grounds; they
   * are seeds as well only so that all six are built the same way.
   */
  it("shows why a mid-tone commits to one ink", () => {
    const inks = ["#000000", "#ffffff"];
    for (const midTone of ["#b67c4f", "#a65b46", "#7f7a57"]) {
      const ratios = inks.map((ink) => contrast(midTone, ink) ?? 0);
      // One of the two is always under the floor.
      expect(Math.min(...ratios)).toBeLessThan(AA_TEXT);
      // And the one that clears it does so by very little.
      expect(Math.max(...ratios)).toBeLessThan(6.5);
    }
  });

  it("records the three that would have made grounds on their own", () => {
    expect(contrast("#e7d8c6", "#000000")).toBeGreaterThan(12);
    expect(contrast("#434140", "#ffffff")).toBeGreaterThan(8);
    expect(contrast("#5b4556", "#ffffff")).toBeGreaterThan(8);
  });

  it("answers null rather than guessing at something unreadable", () => {
    expect(contrast("#fff", "var(--color-surface)")).toBeNull();
  });
});
