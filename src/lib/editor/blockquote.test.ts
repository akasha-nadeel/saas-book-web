import { afterEach, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(content: string): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit],
    content,
  });
  return editor;
}

it("wraps a whole multi-paragraph selection in one quote", () => {
  const e = make("<p>Dear Mother,</p><p>I am alive.</p><p>Dilan</p>");
  e.commands.selectAll();
  e.commands.toggleBlockquote();
  const html = e.getHTML();
  // One blockquote holding all three paragraphs, not three separate quotes.
  expect((html.match(/<blockquote>/g) ?? []).length).toBe(1);
  expect(html).toContain("Dear Mother,");
  expect(html).toContain("Dilan");
});

it("toggles a quote off when the caret sits inside it", () => {
  const e = make("<p>Quoted.</p>");
  e.commands.selectAll();
  e.commands.toggleBlockquote();
  expect(e.getHTML()).toContain("<blockquote>");
  // A caret inside the quote (real usage, not a whole-document selection)
  // lifts it back out.
  e.commands.setTextSelection(3);
  e.commands.toggleBlockquote();
  expect(e.getHTML()).not.toContain("<blockquote>");
});
