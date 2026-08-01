import { describe, expect, it } from "vitest";
import { copiesToBreakEven, REALITIES, SPENDS } from "./money";

describe("copiesToBreakEven", () => {
  it("works out how many copies pay off a spend", () => {
    expect(copiesToBreakEven(1000, 2)).toBe(500);
  });

  it("rounds up — half a sale is not a sale", () => {
    expect(copiesToBreakEven(101, 2)).toBe(51);
  });

  it("says nothing rather than dividing by nothing", () => {
    expect(copiesToBreakEven(1000, 0)).toBeNull();
    expect(copiesToBreakEven(0, 2)).toBeNull();
    expect(copiesToBreakEven(-100, 2)).toBeNull();
  });
});

describe("the figures", () => {
  it("gives each one a unique id", () => {
    expect(new Set(REALITIES.map((r) => r.id)).size).toBe(REALITIES.length);
  });

  /**
   * The rule this whole module is written under. These numbers are directional
   * rather than audited, and a page presenting them as hard data would be
   * doing the exact thing it warns writers about.
   */
  it("says where every figure comes from and how much weight it carries", () => {
    for (const reality of REALITIES) {
      expect(reality.provenance.length).toBeGreaterThan(40);
    }
  });
});

describe("the things writers pay for", () => {
  it("gives each one a unique id", () => {
    expect(new Set(SPENDS.map((s) => s.id)).size).toBe(SPENDS.length);
  });

  it("gives every one checks to make and a trap to avoid", () => {
    for (const spend of SPENDS) {
      expect(spend.checks.length).toBeGreaterThan(2);
      expect(spend.trap.length).toBeGreaterThan(40);
    }
  });

  /**
   * Naming a named business as fraudulent is a legal problem rather than a
   * feature — and unnecessary, because the checks describe the *shape* of the
   * thing. Companies do come up by name in the research; none appears here.
   */
  it("names no company as a scam", () => {
    const text = JSON.stringify(SPENDS).toLowerCase();
    for (const named of ["olympia", "austin macauley", "publishamerica"]) {
      expect(text).not.toContain(named);
    }
  });

  it("keeps the one test that matters about publishers", () => {
    const publisher = SPENDS.find((s) => s.id === "publisher")!;
    expect(publisher.typical.toLowerCase()).toContain("pays you");
  });
});
