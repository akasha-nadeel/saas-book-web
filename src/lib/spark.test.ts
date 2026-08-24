import { describe, expect, it } from "vitest";
import { smoothArea, smoothPath, type Point } from "./spark";

const line: Point[] = [
  { x: 0, y: 30 },
  { x: 25, y: 10 },
  { x: 50, y: 20 },
  { x: 75, y: 0 },
  { x: 100, y: 30 },
];

describe("smoothPath", () => {
  it("starts on the first point and ends on the last", () => {
    const d = smoothPath(line);
    expect(d.startsWith("M0,30")).toBe(true);
    expect(d.endsWith("100,30")).toBe(true);
  });

  it("draws one curve per gap", () => {
    // Four gaps between five days.
    expect(smoothPath(line).match(/C/g)).toHaveLength(4);
  });

  /**
   * The rule this module will not cross: the curve may bend between two real
   * points, it may never invent a third. Every day handed in has to appear in
   * the path as a point the line passes through.
   */
  it("passes through every point it was given", () => {
    const d = smoothPath(line);
    for (const p of line) {
      expect(d).toContain(`${p.x},${p.y}`);
    }
  });

  it("has no line in it below two points", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 0, y: 0 }])).toBe("");
  });

  it("draws a flat run flat", () => {
    const flat: Point[] = [
      { x: 0, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
    ];
    /* Every y in the path — the points and the control points alike — has to
       stay on 10, or a fortnight of nothing would ripple. Read off the pairs
       rather than pattern-matched: a coordinate is whatever follows a comma,
       and asserting on the numbers is clearer than a lookahead that has to
       know where a number ends. */
    const ys = [...smoothPath(flat).matchAll(/,(-?[\d.]+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(ys.length).toBeGreaterThan(0);
    expect(ys.every((y) => y === 10)).toBe(true);
  });
});

describe("smoothArea", () => {
  it("closes the curve down to the floor", () => {
    const d = smoothArea(line, 32);
    expect(d).toContain("L100,32");
    expect(d).toContain("L0,32");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("is the line plus the floor, never a second opinion about the curve", () => {
    const area = smoothArea(line, 32);
    expect(area.startsWith(smoothPath(line))).toBe(true);
  });

  it("has nothing to close when there is no line", () => {
    expect(smoothArea([{ x: 1, y: 1 }], 32)).toBe("");
  });
});
