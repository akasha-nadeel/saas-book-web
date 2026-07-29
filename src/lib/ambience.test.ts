import { describe, expect, it } from "vitest";
import {
  SCENES,
  clampVolume,
  fillBrownNoise,
  fillWhiteNoise,
} from "./ambience";

/**
 * The audio graph itself needs an AudioContext, which jsdom has not got. What
 * is testable is what the graph is built out of: the noise, and the numbers
 * around it. Those are also the parts where being wrong is silent — a filler
 * that clips or a volume that escapes its range still plays, just badly.
 */

describe("SCENES", () => {
  it("has no duplicate ids", () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every scene a name and a description", () => {
    for (const scene of SCENES) {
      expect(scene.name.trim()).not.toBe("");
      expect(scene.description.trim()).not.toBe("");
    }
  });
});

describe("clampVolume", () => {
  it("keeps a value inside 0 to 1", () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(1)).toBe(1);
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(42)).toBe(1);
  });

  it("falls back rather than passing a non-number through to the gain", () => {
    // An AudioParam set to NaN throws, and a slider reading an empty input is
    // exactly where a NaN comes from.
    expect(clampVolume(Number.NaN)).toBeGreaterThan(0);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBeGreaterThan(0);
    expect(clampVolume(Number.NaN)).toBeLessThanOrEqual(1);
  });
});

describe("fillWhiteNoise", () => {
  it("stays inside the range a sample may take", () => {
    const channel = new Float32Array(4096);
    fillWhiteNoise(channel);
    for (const sample of channel) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it("actually varies", () => {
    const channel = new Float32Array(1024);
    fillWhiteNoise(channel);
    expect(new Set(channel).size).toBeGreaterThan(500);
  });
});

describe("fillBrownNoise", () => {
  it("stays inside the range a sample may take", () => {
    const channel = new Float32Array(8192);
    fillBrownNoise(channel);
    for (const sample of channel) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it("moves more slowly than white noise", () => {
    // The whole point of the integrator: neighbouring samples are close, which
    // is what makes it a low rush rather than a hiss. Comparing the mean step
    // between samples is the cheapest way to see that it worked.
    const step = (channel: Float32Array) => {
      let total = 0;
      for (let i = 1; i < channel.length; i += 1) {
        total += Math.abs(channel[i] - channel[i - 1]);
      }
      return total / (channel.length - 1);
    };

    const white = new Float32Array(8192);
    const brown = new Float32Array(8192);
    fillWhiteNoise(white);
    fillBrownNoise(brown);

    expect(step(brown)).toBeLessThan(step(white) / 4);
  });

  it("does not drift off to one side", () => {
    // Without the leak in the integrator the running sum wanders, and a buffer
    // sitting at one extreme is a click on every loop rather than a sound.
    const channel = new Float32Array(16384);
    fillBrownNoise(channel);
    const mean =
      channel.reduce((sum, sample) => sum + sample, 0) / channel.length;
    expect(Math.abs(mean)).toBeLessThan(0.5);
  });
});
