import { expect, it } from "vitest";
import {
  DEFAULT_TYPOGRAPHY,
  FONTS,
  fontStack,
  typographyVars,
} from "@/lib/typography";

it("falls back to the first face for an unknown font id", () => {
  // Stored values reach here from book records, which anything can write.
  expect(fontStack("nope")).toBe(FONTS[0].stack);
  expect(fontStack("georgia")).toContain("Georgia");
});

it("defaults to a professional novel setting", () => {
  expect(DEFAULT_TYPOGRAPHY.sizePt).toBe(12);
  expect(DEFAULT_TYPOGRAPHY.leading).toBe(1.4);
  expect(DEFAULT_TYPOGRAPHY.align).toBe("justify");
  expect(DEFAULT_TYPOGRAPHY.indentIn).toBe(0.25);
  expect(DEFAULT_TYPOGRAPHY.paraSpacingPt).toBe(0);
});

it("turns points and inches into page pixels at 96 to the inch", () => {
  const vars = typographyVars(DEFAULT_TYPOGRAPHY);
  // 12pt × 96/72 = 16px; 0.25in × 96 = 24px.
  expect(vars["--ms-size"]).toBe("16.00px");
  expect(vars["--ms-indent"]).toBe("24.00px");
  expect(vars["--ms-para-gap"]).toBe("0.00px");
  expect(vars["--ms-leading"]).toBe("1.4");
  expect(vars["--ms-align"]).toBe("justify");
  expect(vars["--ms-font"]).toBe(fontStack(DEFAULT_TYPOGRAPHY.font));
});

it("scales paragraph spacing from points too", () => {
  const vars = typographyVars({ ...DEFAULT_TYPOGRAPHY, paraSpacingPt: 6 });
  // 6pt × 96/72 = 8px.
  expect(vars["--ms-para-gap"]).toBe("8.00px");
});
