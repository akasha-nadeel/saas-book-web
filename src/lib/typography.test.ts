import { expect, it } from "vitest";
import {
  DEFAULT_TYPOGRAPHY,
  FONTS,
  PARAGRAPH_STYLES,
  fontStack,
  paragraphStyleOf,
  paragraphStyleSettings,
  typographyVars,
} from "@/lib/typography";

it("falls back to the first face for an unknown font id", () => {
  // Stored values reach here from book records, which anything can write.
  expect(fontStack("nope")).toBe(FONTS[0].stack);
  expect(fontStack("georgia")).toContain("Georgia");
});

it("separates paragraphs one way, never both", () => {
  // A first-line indent and a space between paragraphs each mark where one ends
  // and the next begins. Using both at once is the one combination that is
  // actually wrong, so whichever the default takes, it must not take the other.
  const indented = DEFAULT_TYPOGRAPHY.indentIn > 0;
  const spaced = DEFAULT_TYPOGRAPHY.paraSpacingPt > 0;
  expect(indented && spaced).toBe(false);
  expect(indented || spaced).toBe(true);
});

it("defaults to the paragraph a writer coming from Word recognises", () => {
  expect(DEFAULT_TYPOGRAPHY.sizePt).toBe(12);
  expect(DEFAULT_TYPOGRAPHY.leading).toBe(1.4);
  // Left, not justified: justified text redistributes the slack across a whole
  // paragraph, so bolding half a sentence re-spaces every line of it. Word
  // drafts ragged-right and so does this; the exported book is still justified
  // by its own template, which `typeset.test.ts` asserts separately.
  expect(DEFAULT_TYPOGRAPHY.align).toBe("left");
  // Space between, no indent — the word-processor paragraph. The printed-novel
  // setting (an indent and no space) is a click away in the Aa panel.
  expect(DEFAULT_TYPOGRAPHY.indentIn).toBe(0);
  expect(DEFAULT_TYPOGRAPHY.paraSpacingPt).toBe(8);
});

it("reads a book's paragraph style from its indent", () => {
  expect(paragraphStyleOf({ ...DEFAULT_TYPOGRAPHY, indentIn: 0.25 })).toBe(
    "indented",
  );
  expect(paragraphStyleOf({ ...DEFAULT_TYPOGRAPHY, indentIn: 0 })).toBe(
    "spaced",
  );
});

it("sets a paragraph style as one signal, never two and never none", () => {
  // The point of pairing them: whichever style is chosen, the page ends up with
  // exactly one mark of where a paragraph begins.
  for (const style of ["indented", "spaced"] as const) {
    const s = paragraphStyleSettings(style);
    expect(s.indentIn > 0 && s.paraSpacingPt > 0).toBe(false);
    expect(s.indentIn > 0 || s.paraSpacingPt > 0).toBe(true);
    // And choosing a style reports back as that style.
    expect(paragraphStyleOf({ ...DEFAULT_TYPOGRAPHY, ...s })).toBe(style);
  }
});

it("offers every paragraph style the picker lists", () => {
  // No option that cannot be applied, and none applied that is not offered.
  expect(PARAGRAPH_STYLES.map((s) => s.value).sort()).toEqual([
    "indented",
    "spaced",
  ]);
});

it("turns points and inches into page pixels at 96 to the inch", () => {
  // Spelled out rather than taken from the defaults, so that changing how a new
  // book is set never breaks the arithmetic this is actually testing.
  const vars = typographyVars({
    ...DEFAULT_TYPOGRAPHY,
    sizePt: 12,
    indentIn: 0.25,
    paraSpacingPt: 0,
  });
  // 12pt × 96/72 = 16px; 0.25in × 96 = 24px.
  expect(vars["--ms-size"]).toBe("16.00px");
  expect(vars["--ms-indent"]).toBe("24.00px");
  expect(vars["--ms-para-gap"]).toBe("0.00px");
  expect(vars["--ms-leading"]).toBe("1.4");
  // The writing surface drafts left-aligned, like Word; the exported book is
  // justified by its own template. See DEFAULT_TYPOGRAPHY.
  expect(vars["--ms-align"]).toBe("left");
  expect(vars["--ms-font"]).toBe(fontStack(DEFAULT_TYPOGRAPHY.font));
});

it("scales paragraph spacing from points too", () => {
  const vars = typographyVars({ ...DEFAULT_TYPOGRAPHY, paraSpacingPt: 6 });
  // 6pt × 96/72 = 8px.
  expect(vars["--ms-para-gap"]).toBe("8.00px");
});
