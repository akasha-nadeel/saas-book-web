import { describe, expect, it } from "vitest";
import { fontFamilyCss, isKnownFont } from "./font-family";
import { FONTS, fontStack } from "@/lib/typography";
import { toBlocks } from "@/lib/export/blocks";
import type { JSONContent } from "@tiptap/react";

describe("isKnownFont", () => {
  it("accepts every face the book offers", () => {
    for (const font of FONTS) expect(isKnownFont(font.id)).toBe(true);
  });

  it("rejects anything else", () => {
    // Stored chapters outlive this list: a face dropped from typography.ts
    // leaves its id behind in documents written before. Better a paragraph in
    // the book's own face than a font-family nothing can match.
    expect(isKnownFont("comic-sans")).toBe(false);
    expect(isKnownFont("")).toBe(false);
    expect(isKnownFont(null)).toBe(false);
    expect(isKnownFont(7)).toBe(false);
  });
});

describe("fontFamilyCss", () => {
  it("renders the same stack the book setting does", () => {
    // The two places a face can be chosen have to agree, or a passage set to
    // Garamond inline would not match a book set to Garamond throughout.
    for (const font of FONTS) {
      expect(fontFamilyCss(font.id)).toBe(fontStack(font.id));
    }
  });
});

describe("the export IR", () => {
  const doc = (marks: JSONContent["marks"]): JSONContent => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "a letter", marks }],
      },
    ],
  });

  it("carries an inline face through to the runs", () => {
    const [block] = toBlocks(doc([{ type: "fontFamily", attrs: { font: "times" } }]));
    expect(block.runs?.[0].fontFamily).toBe(fontStack("times"));
  });

  it("drops a face this build does not know", () => {
    const [block] = toBlocks(doc([{ type: "fontFamily", attrs: { font: "wingdings" } }]));
    // fontStack falls back to the first face rather than returning nothing, so
    // the run is still set — the point is that it is a real stack and never the
    // unknown id written out raw.
    expect(block.runs?.[0].fontFamily).toBe(fontStack(FONTS[0].id));
  });

  it("leaves unmarked text alone", () => {
    const [block] = toBlocks(doc([]));
    expect(block.runs?.[0].fontFamily).toBeUndefined();
  });
});
