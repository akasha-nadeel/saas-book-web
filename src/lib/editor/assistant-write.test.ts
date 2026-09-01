import { expect, it } from "vitest";
import {
  countWords,
  passagePreview,
  textToParagraphs,
} from "@/lib/editor/assistant-write";

it("reads a blank line as a paragraph break", () => {
  expect(textToParagraphs("Rain came sideways.\n\nCold went through the coat."))
    .toEqual(["Rain came sideways.", "Cold went through the coat."]);
});

/** A quote block wraps its lines; the wrap is not a paragraph. */
it("joins a soft-wrapped line back into one paragraph", () => {
  expect(textToParagraphs("Rain came sideways\nand the cold went through.")).toEqual([
    "Rain came sideways and the cold went through.",
  ]);
});

it("treats several blank lines as one break", () => {
  expect(textToParagraphs("One.\n\n\n\nTwo.")).toEqual(["One.", "Two."]);
});

it("survives Windows line endings", () => {
  expect(textToParagraphs("One.\r\n\r\nTwo.")).toEqual(["One.", "Two."]);
});

it("drops whitespace-only paragraphs rather than writing empty ones", () => {
  expect(textToParagraphs("One.\n \n\nTwo.\n\n   ")).toEqual(["One.", "Two."]);
});

it("gives nothing for nothing, so an empty offer cannot be applied", () => {
  expect(textToParagraphs("")).toEqual([]);
  expect(textToParagraphs("   \n\n  ")).toEqual([]);
});

/** **Markup stays words.** Nothing downstream parses this as HTML, and the
    proof it does not have to is that it arrives here as characters. */
it("keeps markup as characters", () => {
  expect(textToParagraphs("<b>hi</b> & <script>alert(1)</script>")).toEqual([
    "<b>hi</b> & <script>alert(1)</script>",
  ]);
});

it("counts words", () => {
  expect(countWords("Rain came sideways.")).toBe(3);
  expect(countWords("  spaced   out  ")).toBe(2);
  expect(countWords("")).toBe(0);
});

it("leaves a short passage alone in the preview", () => {
  expect(passagePreview("Rain came sideways.")).toBe("Rain came sideways.");
});

it("shows both ends of a long passage, not just the opening", () => {
  const passage = `${"start ".repeat(30)}finish`;
  const preview = passagePreview(passage, 40);

  expect(preview.startsWith("start")).toBe(true);
  expect(preview.endsWith("finish")).toBe(true);
  expect(preview).toContain("…");
  expect(preview.length).toBeLessThanOrEqual(40);
});

it("flattens line breaks in a preview so it stays one line", () => {
  expect(passagePreview("One.\n\nTwo.")).toBe("One. Two.");
});
