import { afterEach, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextAlign } from "@/lib/editor/text-align";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function makeEditor(content: unknown): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, TextAlign],
    content,
  });
  return editor;
}

it("aligns a single paragraph", () => {
  const e = makeEditor("<p>One line.</p>");
  e.commands.selectAll();
  e.commands.setTextAlign("center");
  expect(e.getHTML()).toContain("text-align: center");
});

it("aligns every paragraph across a multi-paragraph selection", () => {
  const e = makeEditor("<p>First.</p><p>Second.</p><p>Third.</p>");
  e.commands.selectAll();
  e.commands.setTextAlign("right");
  const matches = e.getHTML().match(/text-align: right/g) ?? [];
  expect(matches.length).toBe(3);
});

it("overrides an alignment a paragraph was pasted in with", () => {
  // Pasted content can arrive already carrying text-align; the buttons must win.
  const e = makeEditor('<p style="text-align: justify">Pasted.</p>');
  e.commands.selectAll();
  e.commands.setTextAlign("left");
  const html = e.getHTML();
  expect(html).toContain("text-align: left");
  expect(html).not.toContain("text-align: justify");
});
