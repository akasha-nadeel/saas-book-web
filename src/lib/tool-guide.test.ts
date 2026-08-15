import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "./book-tools";
import { GUIDE_BY_PATH, TOOL_GUIDES } from "./tool-guide";

describe("tool guide", () => {
  /*
   * The one that matters, and the reason this file exists.
   *
   * `/tools` renders a row per entry in `ALL_TOOLS`, so a tool declared in
   * `book-tools.ts` with nothing here is a heading over an empty column on a
   * public page — and nothing in a build would say so. Same shape as the
   * `DESTINATIONS` check behind the dashboard's findings: the map is walked
   * from the source of truth rather than from itself.
   */
  it("describes every tool the product declares", () => {
    for (const tool of ALL_TOOLS) {
      expect(GUIDE_BY_PATH[tool.path], `no guide for ${tool.path}`).toBeDefined();
    }
  });

  /* The other direction: an entry whose tool was renamed or removed would
     never render, so it would rot silently rather than fail. */
  it("describes nothing the product does not have", () => {
    const paths = new Set(ALL_TOOLS.map((tool) => tool.path));
    for (const guide of TOOL_GUIDES) {
      expect(paths.has(guide.path), `${guide.path} is not a tool`).toBe(true);
    }
  });

  it("gives each tool three folded points", () => {
    for (const guide of TOOL_GUIDES) {
      expect(guide.points, guide.path).toHaveLength(3);
    }
  });

  /*
   * **A position rather than a behaviour, and one not to "fix".**
   *
   * The lead continues the sentence the claim starts — the claim is set in ink
   * and the rest in deck grey, one sentence in two colours, which is the
   * `SECTION_LEAD` arrangement the whole landing page is set in. An entry whose
   * lead starts with a capital reads as two sentences with the first one
   * missing its full stop, and that is invisible in review because each half is
   * fine on its own.
   */
  it("continues the claim rather than starting a new sentence", () => {
    for (const guide of TOOL_GUIDES) {
      expect(guide.lead.startsWith(" "), guide.path).toBe(true);
      expect(guide.claim.endsWith("."), guide.path).toBe(false);
    }
  });

  /*
   * No plan claims. Which parts of a tool are metered lives in
   * `free-limits.ts` and moves; a sentence here repeating it goes quietly
   * wrong, on the page a reader is using to decide whether to pay.
   */
  it("makes no claim about what a plan includes", () => {
    const words = /\b(free|pro|plan|upgrade|paid|unlimited)\b/i;
    for (const guide of TOOL_GUIDES) {
      const prose = [
        guide.headline,
        guide.claim,
        guide.lead,
        ...guide.points.flatMap((point) => [point.term, point.detail]),
      ].join(" ");
      expect(words.test(prose), guide.path).toBe(false);
    }
  });
});
