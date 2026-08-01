import { describe, expect, it } from "vitest";
import { lastParagraph, noteHint, tail } from "./resume";

const doc = (...paragraphs: string[]) =>
  JSON.stringify({
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  });

describe("lastParagraph", () => {
  it("takes the last paragraph, not the first", () => {
    expect(lastParagraph(doc("One.", "Two.", "Three."))).toBe("Three.");
  });

  /**
   * A writer stops mid-thought and leaves the cursor on a blank line. Taking
   * the literal last block would hand them an empty quotation.
   */
  it("skips trailing blank paragraphs", () => {
    expect(lastParagraph(doc("The real end.", "", "   "))).toBe("The real end.");
  });

  it("joins the runs inside a paragraph, so marks do not split it", () => {
    const withMarks = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "She said " },
            { type: "text", text: "nothing", marks: [{ type: "italic" }] },
            { type: "text", text: " at all." },
          ],
        },
      ],
    });
    expect(lastParagraph(withMarks)).toBe("She said nothing at all.");
  });

  it("reads text out of a nested block", () => {
    const quote = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Quoted." }] },
          ],
        },
      ],
    });
    expect(lastParagraph(quote)).toBe("Quoted.");
  });

  // A writer opening a blank chapter is not resuming, and an empty quotation
  // under "where you left off" reads as a fault.
  it("has nothing to say about an empty or missing chapter", () => {
    expect(lastParagraph(doc(""))).toBeNull();
    expect(lastParagraph(null)).toBeNull();
    expect(lastParagraph("{}")).toBeNull();
  });

  it("survives a body that is not JSON at all", () => {
    expect(lastParagraph("not json")).toBeNull();
  });
});

describe("tail", () => {
  it("leaves a short paragraph alone", () => {
    expect(tail("Short enough.", 100)).toBe("Short enough.");
  });

  /**
   * The end rather than the beginning, which is the opposite of a normal
   * preview and the whole point: a writer resuming needs the sentence they
   * stopped in the middle of.
   */
  it("keeps the end when it has to cut", () => {
    const long = `${"x ".repeat(200)}the final words.`;
    const cut = tail(long, 40);
    expect(cut.endsWith("the final words.")).toBe(true);
    expect(cut.startsWith("…")).toBe(true);
  });

  it("cuts at a word rather than mid-word", () => {
    const source = "alpha bravo charlie delta echo foxtrot";
    const cut = tail(source, 20);
    // The word after the ellipsis has to be a whole word from the original —
    // "…lta echo foxtrot" would pass a length check and read as damage.
    const firstWord = cut.replace("…", "").split(" ")[0];
    expect(source.split(" ")).toContain(firstWord);
    expect(cut.endsWith("foxtrot")).toBe(true);
  });
});

describe("noteHint", () => {
  it("takes the first line a writer wrote", () => {
    expect(noteHint("Next: she finds the key.\n\nResearch: locks")).toBe(
      "Next: she finds the key.",
    );
  });

  it("skips blank lines at the top", () => {
    expect(noteHint("\n\n  Next: the storm.")).toBe("Next: the storm.");
  });

  it("has nothing to say about an empty note", () => {
    expect(noteHint("")).toBeNull();
    expect(noteHint(null)).toBeNull();
    expect(noteHint("   \n  ")).toBeNull();
  });

  it("trims a very long first line", () => {
    expect(noteHint("y".repeat(300))?.endsWith("…")).toBe(true);
  });
});
