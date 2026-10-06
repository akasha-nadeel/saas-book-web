import { describe, it, expect } from "vitest";
import { median, nearestRank } from "./stats";

describe("median", () => {
  it("takes the middle of an odd list", () => {
    expect(median([1, 2, 9])).toBe(2);
  });

  it("averages the two middle values of an even list", () => {
    expect(median([1, 2, 4, 9])).toBe(3);
  });
});

describe("nearestRank", () => {
  it("reads the quarter and three-quarter marks of a sorted list", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(nearestRank(sorted, 0.25)).toBe(3);
    expect(nearestRank(sorted, 0.75)).toBe(7);
  });

  it("never reads past the end", () => {
    expect(nearestRank([5], 0.75)).toBe(5);
  });
});
