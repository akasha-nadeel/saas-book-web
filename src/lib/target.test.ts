import { describe, expect, it } from "vitest";
import { targetShare } from "./target";

describe("targetShare", () => {
  /**
   * The bug at the top of the bar, and the one that mattered most: 99.6%
   * rounds to 100, so a book short of its target printed "100%" in the green
   * this app keeps for having arrived.
   */
  it("never rounds up into a claim", () => {
    const almost = targetShare(99_600, 100_000);
    expect(almost.share).toBe(99);
    expect(almost.label).toBe("99%");
    expect(almost.met).toBe(false);
  });

  /**
   * And the bug at the bottom: 215 words into a 110,000-word novel is 0.195%,
   * which rounds to nought — the app failing to count the page just written.
   */
  it("says a small share in words rather than printing zero", () => {
    const early = targetShare(215, 110_000);
    expect(early.share).toBe(0);
    expect(early.label).toBe("under 1%");
  });

  it("prints a plain zero only when nothing is written", () => {
    expect(targetShare(0, 110_000).label).toBe("0%");
  });

  it("reports the target met from the words, not the percentage", () => {
    expect(targetShare(100_000, 100_000).met).toBe(true);
    expect(targetShare(120_000, 100_000).met).toBe(true);
    // Clamped, so the figure stays usable as a width.
    expect(targetShare(120_000, 100_000).share).toBe(100);
  });

  it("does not divide by a target of nothing", () => {
    const none = targetShare(500, 0);
    expect(none.share).toBe(0);
    expect(Number.isFinite(none.share)).toBe(true);
    expect(none.met).toBe(false);
  });

  /**
   * A manuscript can shrink below where it started; the bar must not run
   * backwards off its own left edge.
   */
  it("clamps a negative count at nought", () => {
    expect(targetShare(-200, 100_000).share).toBe(0);
  });
});
