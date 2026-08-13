import { describe, expect, it } from "vitest";
import {
  curveThrough,
  focus,
  litness,
  progressOf,
  READING_LINE,
  type Point,
} from "./landing-path";

const p = (x: number, y: number): Point => ({ x, y });

describe("curveThrough", () => {
  it("draws nothing from fewer than two points", () => {
    // One station is not a road. An `M` on its own is an empty path that still
    // reports a length, which would put the marker on a curve nobody can see.
    expect(curveThrough([])).toBe("");
    expect(curveThrough([p(10, 10)])).toBe("");
  });

  it("starts at the first point and ends at the last", () => {
    const d = curveThrough([p(0, 0), p(50, 100), p(0, 200)]);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("0 200")).toBe(true);
  });

  it("writes one curve per gap between stations", () => {
    const four = curveThrough([p(0, 0), p(40, 60), p(10, 120), p(60, 180)]);
    expect(four.match(/C/g)).toHaveLength(3);
  });

  it("passes through every station, not near them", () => {
    // The property the whole effect rests on: the marker rides this curve and
    // has to arrive at the dot the reader is looking at. Every interior point
    // appears in the path as the end of its own segment.
    const points = [p(0, 0), p(40, 60), p(10, 120), p(60, 180)];
    const d = curveThrough(points);
    for (const point of points.slice(1)) {
      expect(d).toContain(`${point.x} ${point.y}`);
    }
  });

  it("straightens as the slack goes out of it", () => {
    // At zero the control points sit on the stations themselves, which is a
    // cubic drawn as a straight line.
    const d = curveThrough([p(0, 0), p(100, 100)], 0);
    expect(d).toBe("M 0 0 C 0 0, 100 100, 100 100");
  });

  it("does not flick outwards at the ends", () => {
    // The first control point is worked out from a neighbour that does not
    // exist, so the endpoint stands in for it. Were that missing, the curve
    // would leave the first station heading away from the second.
    const d = curveThrough([p(0, 0), p(100, 100), p(0, 200)]);
    const first = d.split("C")[1]!.split(",")[0]!.trim();
    // b + (c - a)/6 with a = b: (100 - 0)/6 = 16.67 across, and the same down.
    expect(first).toBe("16.67 16.67");
  });
});

describe("progressOf", () => {
  it("is nothing before the section reaches the reading line", () => {
    // Section top at 900 in an 800-tall window: still below the fold.
    expect(progressOf(900, 1000, 800)).toBe(0);
  });

  it("is finished once the section has passed it", () => {
    expect(progressOf(-2000, 1000, 800)).toBe(1);
  });

  it("puts the marker exactly on the reading line in between", () => {
    // The property this function exists for: progress × height + top is the
    // reading line, so the marker is drawn where the reader is already looking
    // and cannot appear to lag the scroll.
    const top = -300;
    const height = 1000;
    const viewport = 800;
    const at = progressOf(top, height, viewport);
    expect(at * height + top).toBeCloseTo(viewport * READING_LINE);
  });

  it("takes a section of no height as finished rather than dividing by zero", () => {
    expect(progressOf(0, 0, 800)).toBe(1);
  });
});

describe("focus", () => {
  it("is full at the station and nothing beyond its reach", () => {
    expect(focus(0, 200)).toBe(1);
    expect(focus(200, 200)).toBe(0);
    expect(focus(9999, 200)).toBe(0);
  });

  it("reads the same approaching as leaving", () => {
    expect(focus(-80, 200)).toBe(focus(80, 200));
  });

  it("falls away as the marker leaves", () => {
    const near = focus(20, 200);
    const mid = focus(100, 200);
    const far = focus(180, 200);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("eases rather than ramps", () => {
    // Smoothstep at the halfway mark is a half; a straight ramp would be too,
    // so the ease shows a quarter of the way along instead — where a linear
    // fade would read 0.75 and be visibly moving at full speed.
    expect(focus(100, 200)).toBeCloseTo(0.5);
    expect(focus(50, 200)).toBeGreaterThan(0.75);
  });

  it("dims everything rather than lighting everything with no reach", () => {
    expect(focus(1, 0)).toBe(0);
    expect(focus(0, 0)).toBe(1);
  });
});

describe("litness", () => {
  it("never falls below the floor", () => {
    // The accessible half of the effect: a station out of reach is still a
    // sentence somebody may need to read, so it is dimmed and not taken away.
    expect(litness(9999, 200, 0.45)).toBe(0.45);
  });

  it("reaches full at the station", () => {
    expect(litness(0, 200, 0.45)).toBe(1);
  });
});
