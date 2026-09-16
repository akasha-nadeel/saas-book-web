import { describe, expect, it } from "vitest";

import { PAPER_COLORS, TINTS } from "@/lib/library-store";
import {
  FREE_PAPERS,
  FREE_TINTS,
  PRO_PAPERS,
  PRO_TINTS,
  SHOWN_TINTS,
  isProPaper,
  isProTint,
} from "@/lib/theme-access";

/**
 * What this is protecting.
 *
 * The ids here are string literals in a module that deliberately imports no
 * values, so nothing but a test notices when a tint is renamed in `TINTS` or a
 * paper leaves `PAPER_COLORS` — the picker would simply stop drawing a swatch,
 * silently, and the pricing row would go on counting it.
 */
describe("theme access", () => {
  it("names only tints the theme system has", () => {
    const known = TINTS.map((tint) => tint.id);
    for (const id of SHOWN_TINTS) expect(known).toContain(id);
  });

  it("names only papers the store accepts", () => {
    for (const paper of [...FREE_PAPERS, ...PRO_PAPERS]) {
      expect(PAPER_COLORS).toContain(paper);
    }
  });

  it("shows every tint on exactly one plan", () => {
    expect([...FREE_TINTS, ...PRO_TINTS].sort()).toEqual([...SHOWN_TINTS].sort());
    for (const id of FREE_TINTS) expect(PRO_TINTS).not.toContain(id);
  });

  it("splits every paper the picker offers", () => {
    expect([...FREE_PAPERS, ...PRO_PAPERS].sort()).toEqual([...PAPER_COLORS].sort());
  });

  /* Free has to be a usable app rather than a demonstration of what it is not:
     a plan with no colour and no page to write on is a screenshot, not a tier. */
  it("leaves the free plan a colour and a page", () => {
    expect(FREE_TINTS.length).toBeGreaterThan(0);
    expect(FREE_PAPERS.length).toBeGreaterThan(0);
    expect(FREE_PAPERS).toContain("theme");
  });

  it("agrees with itself about what is Pro", () => {
    for (const id of PRO_TINTS) expect(isProTint(id)).toBe(true);
    for (const id of FREE_TINTS) expect(isProTint(id)).toBe(false);
    for (const paper of PRO_PAPERS) expect(isProPaper(paper)).toBe(true);
    for (const paper of FREE_PAPERS) expect(isProPaper(paper)).toBe(false);
  });

  /* The light tints are held back, not deleted — the distinction the module's
     own note turns on. If one is ever shown again this fails and is the place
     to say so. */
  it("holds back the light tints", () => {
    const light = TINTS.filter((tint) => tint.scheme === "light").map((t) => t.id);
    expect(light.length).toBeGreaterThan(0);
    for (const id of light) expect(SHOWN_TINTS).not.toContain(id);
  });
});
