import { afterEach, expect, it } from "vitest";
import { Editor, type Content } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  applyInsertion,
  applyReplacement,
  countWords,
  insertBelowPos,
  passagePreview,
  textToParagraphs,
} from "@/lib/editor/assistant-write";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

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

/* --------------------------------------------------------------------------
   The range a write lands on

   Returned so the panel can take the writer to it and leave it lit — the whole
   of the reassurance now that write mode applies without a press. Measured from
   the document's size rather than from the content that went in, because
   `insertContentAt` reports neither and counting the JSON would count the wrong
   thing: a paragraph node is two positions more than its text.

   An editor here rather than a pure call, following `text-align.test.ts`: this
   is arithmetic about ProseMirror positions, and only ProseMirror knows them.
   -------------------------------------------------------------------------- */

function makeEditor(content: Content): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit],
    content,
  });
  return editor;
}

/** What the returned range actually covers, which is the thing being claimed. */
function textIn(e: Editor, range: { from: number; to: number }): string {
  return e.state.doc.textBetween(range.from, range.to, "\n\n", " ");
}

it("returns a range covering exactly the prose a replacement wrote", () => {
  const e = makeEditor("<p>Rain came sideways.</p>");
  const range = applyReplacement(e, { from: 1, to: 20 }, "Snow came sideways.");
  expect(range).not.toBeNull();
  expect(textIn(e, range!)).toBe("Snow came sideways.");
});

it("returns a range that grows and shrinks with the new prose", () => {
  // The replacement is longer than what it replaced, then shorter — the range
  // has to follow both ways, which a fixed offset would not.
  const long = makeEditor("<p>One.</p>");
  const grown = applyReplacement(long, { from: 1, to: 5 }, "A much longer line.");
  expect(textIn(long, grown!)).toBe("A much longer line.");

  const short = makeEditor("<p>A much longer line.</p>");
  const shrunk = applyReplacement(short, { from: 1, to: 20 }, "One.");
  expect(textIn(short, shrunk!)).toBe("One.");
});

it("covers every paragraph when a replacement writes more than one", () => {
  const e = makeEditor("<p>One.</p>");
  const range = applyReplacement(e, { from: 1, to: 5 }, "First.\n\nSecond.");
  expect(textIn(e, range!)).toBe("First.\n\nSecond.");
});

it("returns a range covering what an insertion wrote, and nothing before it", () => {
  const e = makeEditor("<p>Kept.</p><p>Also kept.</p>");
  const pos = insertBelowPos(e);
  const range = applyInsertion(e, pos!, "New line.");
  expect(range).not.toBeNull();
  expect(textIn(e, range!)).toBe("New line.");
  // The prose that was already there is untouched.
  expect(e.getText()).toContain("Kept.");
  expect(e.getText()).toContain("Also kept.");
});

it("answers null when there is nothing to write", () => {
  const e = makeEditor("<p>One.</p>");
  expect(applyReplacement(e, { from: 1, to: 5 }, "   ")).toBeNull();
  expect(applyInsertion(e, 1, "")).toBeNull();
});

it("answers null rather than throwing when there is no editor", () => {
  expect(applyReplacement(null, { from: 1, to: 2 }, "One.")).toBeNull();
  expect(applyInsertion(undefined, 1, "One.")).toBeNull();
});
