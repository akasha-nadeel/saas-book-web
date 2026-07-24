import { expect, it } from "vitest";
import { blocksToXhtml } from "@/lib/export/xhtml";
import type { Block } from "@/lib/export/blocks";

const p = (...runs: Block["runs"]): Block => ({
  kind: "paragraph",
  depth: 0,
  runs,
});

it("renders a paragraph", () => {
  expect(blocksToXhtml([p({ text: "One." })])).toBe("<p>One.</p>");
});

it("renders headings at their level", () => {
  expect(
    blocksToXhtml([
      { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
    ]),
  ).toBe("<h2>Chapter Two</h2>");
});

it("escapes XML entities", () => {
  // Ampersand must be escaped first or the others double-escape.
  expect(blocksToXhtml([p({ text: 'a & b < c > d "e"' })])).toBe(
    "<p>a &amp; b &lt; c &gt; d &quot;e&quot;</p>",
  );
});

it("escapes entities inside an href", () => {
  expect(
    blocksToXhtml([p({ text: "here", href: "https://x.test/?a=1&b=2" })]),
  ).toBe('<p><a href="https://x.test/?a=1&amp;b=2">here</a></p>');
});

it("renders emphasis", () => {
  expect(
    blocksToXhtml([
      p(
        { text: "a", bold: true },
        { text: "b", italic: true },
        { text: "c", strike: true },
        { text: "d", code: true },
        { text: "e", underline: true },
      ),
    ]),
  ).toBe("<p><strong>a</strong><em>b</em><s>c</s><code>d</code><u>e</u></p>");
});

it("renders an inline font size as a styled span", () => {
  expect(blocksToXhtml([p({ text: "big", fontSize: "1.5em" })])).toBe(
    '<p><span style="font-size:1.5em">big</span></p>',
  );
});

it("renders an image with its width and alignment", () => {
  expect(
    blocksToXhtml([
      {
        kind: "image",
        depth: 0,
        src: "data:x",
        alt: "A boy",
        imgWidth: "50%",
        align: "right",
        runs: [],
      },
    ]),
  ).toBe(
    '<p class="figure" style="text-align:right"><img src="data:x" alt="A boy" style="width:50%" /></p>',
  );
});

it("renders a plain centred image with no extra styles", () => {
  expect(
    blocksToXhtml([{ kind: "image", depth: 0, src: "data:y", runs: [] }]),
  ).toBe('<p class="figure"><img src="data:y" alt="" /></p>');
});

it("renders paragraph and heading alignment as an inline style", () => {
  expect(
    blocksToXhtml([
      { kind: "paragraph", depth: 0, align: "center", runs: [{ text: "Mid." }] },
    ]),
  ).toBe('<p style="text-align:center">Mid.</p>');
  expect(
    blocksToXhtml([
      {
        kind: "heading",
        depth: 0,
        level: 2,
        align: "right",
        runs: [{ text: "End" }],
      },
    ]),
  ).toBe('<h2 style="text-align:right">End</h2>');
});

it("renders a scene break as centred asterisks", () => {
  expect(blocksToXhtml([{ kind: "sceneBreak", depth: 0, runs: [] }])).toBe(
    '<p class="scene-break">* * *</p>',
  );
});

it("renders a blockquote", () => {
  expect(
    blocksToXhtml([{ kind: "quote", depth: 0, runs: [{ text: "Quiet." }] }]),
  ).toBe("<blockquote><p>Quiet.</p></blockquote>");
});

it("groups consecutive list items into one list", () => {
  expect(
    blocksToXhtml([
      { kind: "bullet", depth: 0, runs: [{ text: "salt" }] },
      { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
    ]),
  ).toBe("<ul><li>salt</li><li>rope</li></ul>");
});

it("nests a deeper list inside the item above it", () => {
  expect(
    blocksToXhtml([
      { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
      { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
      { kind: "bullet", depth: 0, runs: [{ text: "rope" }] },
    ]),
  ).toBe("<ul><li>supplies<ul><li>salt</li></ul></li><li>rope</li></ul>");
});

it("renders an ordered list", () => {
  expect(
    blocksToXhtml([
      { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
    ]),
  ).toBe("<ol><li>first</li><li>second</li></ol>");
});

it("renders a code block", () => {
  expect(
    blocksToXhtml([
      { kind: "code", depth: 0, language: "ts", runs: [{ text: "a < b" }] },
    ]),
  ).toBe("<pre><code>a &lt; b</code></pre>");
});

it("renders a hard break", () => {
  expect(
    blocksToXhtml([
      p({ text: "one" }, { text: "\n", hardBreak: true }, { text: "two" }),
    ]),
  ).toBe("<p>one<br />two</p>");
});

it("renders an empty paragraph as a spacer", () => {
  // Unlike Markdown, an empty paragraph is meaningful vertical space in a book.
  expect(blocksToXhtml([p()])).toBe("<p></p>");
});

it("returns an empty string for no blocks", () => {
  expect(blocksToXhtml([])).toBe("");
});

it("renders an image, escaping its attributes", () => {
  expect(
    blocksToXhtml([
      { kind: "image", depth: 0, src: "x.png?a=1&b=2", alt: 'A "map"', runs: [] },
    ]),
  ).toBe('<p class="figure"><img src="x.png?a=1&amp;b=2" alt="A &quot;map&quot;" /></p>');
});
