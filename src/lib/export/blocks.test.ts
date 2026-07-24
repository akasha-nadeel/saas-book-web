import { expect, it } from "vitest";
import { toBlocks } from "@/lib/export/blocks";
import type { JSONContent } from "@tiptap/react";

const doc = (...content: JSONContent[]): JSONContent => ({
  type: "doc",
  content,
});
const para = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  content,
});
const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

it("reads a plain paragraph", () => {
  expect(toBlocks(doc(para(text("The salt road ran west."))))).toEqual([
    { kind: "paragraph", depth: 0, runs: [{ text: "The salt road ran west." }] },
  ]);
});

it("reads a paragraph's alignment when set", () => {
  expect(
    toBlocks(
      doc({
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [text("Centred.")],
      }),
    ),
  ).toEqual([
    { kind: "paragraph", depth: 0, align: "center", runs: [{ text: "Centred." }] },
  ]);
  // An unknown or absent alignment carries nothing, so the book default holds.
  expect(
    toBlocks(doc({ type: "paragraph", attrs: { textAlign: null }, content: [text("Plain.")] })),
  ).toEqual([{ kind: "paragraph", depth: 0, runs: [{ text: "Plain." }] }]);
});

it("reads an inline font size from its mark", () => {
  expect(
    toBlocks(doc(para(text("big", [{ type: "fontSize", attrs: { size: 1.5 } }])))),
  ).toEqual([
    {
      kind: "paragraph",
      depth: 0,
      runs: [{ text: "big", fontSize: "calc(var(--ms-size, 1em) * 1.5)" }],
    },
  ]);
});

it("reads headings with their level", () => {
  const blocks = toBlocks(
    doc({
      type: "heading",
      attrs: { level: 2 },
      content: [text("Chapter Two")],
    }),
  );
  expect(blocks).toEqual([
    { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
  ]);
});

it("carries marks onto runs", () => {
  const blocks = toBlocks(
    doc(
      para(
        text("She was "),
        text("late", [{ type: "italic" }]),
        text(" and "),
        text("angry", [{ type: "bold" }]),
      ),
    ),
  );
  expect(blocks[0].runs).toEqual([
    { text: "She was " },
    { text: "late", italic: true },
    { text: " and " },
    { text: "angry", bold: true },
  ]);
});

it("combines nested marks on one run", () => {
  const blocks = toBlocks(
    doc(para(text("both", [{ type: "bold" }, { type: "italic" }]))),
  );
  expect(blocks[0].runs).toEqual([{ text: "both", bold: true, italic: true }]);
});

it("carries a link href, including a link inside bold", () => {
  const blocks = toBlocks(
    doc(
      para(
        text("see it", [
          { type: "bold" },
          { type: "link", attrs: { href: "https://example.com" } },
        ]),
      ),
    ),
  );
  expect(blocks[0].runs).toEqual([
    { text: "see it", bold: true, href: "https://example.com" },
  ]);
});

it("turns a horizontal rule into a scene break", () => {
  expect(toBlocks(doc({ type: "horizontalRule" }))).toEqual([
    { kind: "sceneBreak", depth: 0, runs: [] },
  ]);
});

it("keeps an empty paragraph as an empty block", () => {
  expect(toBlocks(doc(para()))).toEqual([
    { kind: "paragraph", depth: 0, runs: [] },
  ]);
});

it("reads a blockquote", () => {
  const blocks = toBlocks(
    doc({ type: "blockquote", content: [para(text("She had not meant to."))] }),
  );
  expect(blocks).toEqual([
    { kind: "quote", depth: 0, runs: [{ text: "She had not meant to." }] },
  ]);
});

it("flattens a bullet list, one block per item", () => {
  const blocks = toBlocks(
    doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [para(text("salt"))] },
        { type: "listItem", content: [para(text("rope"))] },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "bullet", depth: 0, runs: [{ text: "salt" }] },
    { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
  ]);
});

it("records depth for a nested list", () => {
  const blocks = toBlocks(
    doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            para(text("supplies")),
            {
              type: "bulletList",
              content: [{ type: "listItem", content: [para(text("salt"))] }],
            },
          ],
        },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
    { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
  ]);
});

it("numbers an ordered list", () => {
  const blocks = toBlocks(
    doc({
      type: "orderedList",
      content: [
        { type: "listItem", content: [para(text("first"))] },
        { type: "listItem", content: [para(text("second"))] },
      ],
    }),
  );
  expect(blocks).toEqual([
    { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
    { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
  ]);
});

it("reads a code block with its language", () => {
  const blocks = toBlocks(
    doc({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [text("const x = 1;")],
    }),
  );
  expect(blocks).toEqual([
    {
      kind: "code",
      depth: 0,
      language: "ts",
      runs: [{ text: "const x = 1;" }],
    },
  ]);
});

it("turns a hard break into a newline run", () => {
  const blocks = toBlocks(
    doc(para(text("one"), { type: "hardBreak" }, text("two"))),
  );
  expect(blocks[0].runs).toEqual([
    { text: "one" },
    { text: "\n", hardBreak: true },
    { text: "two" },
  ]);
});

it("returns nothing for an empty document", () => {
  expect(toBlocks({ type: "doc" })).toEqual([]);
});

it("reads an image node", () => {
  expect(
    toBlocks(doc({ type: "image", attrs: { src: "data:image/webp;base64,AA", alt: "Map" } })),
  ).toEqual([
    { kind: "image", depth: 0, src: "data:image/webp;base64,AA", alt: "Map", runs: [] },
  ]);
});

it("skips an image with no source", () => {
  // Otherwise every export format renders a broken picture.
  expect(toBlocks(doc({ type: "image", attrs: { alt: "Map" } }))).toEqual([]);
});
