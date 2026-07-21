import { expect, it } from "vitest";
import { blocksToMarkdown } from "@/lib/export/markdown";
import type { Block } from "@/lib/export/blocks";

const p = (...runs: Block["runs"]): Block => ({
  kind: "paragraph",
  depth: 0,
  runs,
});

it("renders paragraphs separated by a blank line", () => {
  expect(blocksToMarkdown([p({ text: "One." }), p({ text: "Two." })])).toBe(
    "One.\n\nTwo.",
  );
});

it("renders headings at their level", () => {
  expect(
    blocksToMarkdown([
      { kind: "heading", depth: 0, level: 2, runs: [{ text: "Chapter Two" }] },
    ]),
  ).toBe("## Chapter Two");
});

it("renders emphasis", () => {
  expect(
    blocksToMarkdown([
      p(
        { text: "a", bold: true },
        { text: "b", italic: true },
        { text: "c", strike: true },
        { text: "d", code: true },
      ),
    ]),
  ).toBe("**a**_b_~~c~~`d`");
});

it("renders a link, and a link inside bold", () => {
  expect(
    blocksToMarkdown([
      p({ text: "here", href: "https://example.com" }),
      p({ text: "here", bold: true, href: "https://example.com" }),
    ]),
  ).toBe("[here](https://example.com)\n\n**[here](https://example.com)**");
});

it("escapes markdown punctuation in prose", () => {
  // A novelist writing *emphasis* by hand, or a filename with underscores,
  // must not silently become formatting.
  expect(blocksToMarkdown([p({ text: "a*b_c[d]e" })])).toBe(
    "a\\*b\\_c\\[d\\]e",
  );
});

it("does not escape inside code", () => {
  expect(blocksToMarkdown([p({ text: "a*b", code: true })])).toBe("`a*b`");
});

it("renders a scene break as centred asterisks", () => {
  expect(blocksToMarkdown([{ kind: "sceneBreak", depth: 0, runs: [] }])).toBe(
    "* * *",
  );
});

it("renders a blockquote", () => {
  expect(
    blocksToMarkdown([
      { kind: "quote", depth: 0, runs: [{ text: "She had not meant to." }] },
    ]),
  ).toBe("> She had not meant to.");
});

it("renders lists, indenting by depth", () => {
  expect(
    blocksToMarkdown([
      { kind: "bullet", depth: 0, runs: [{ text: "supplies" }] },
      { kind: "bullet", depth: 1, runs: [{ text: "salt" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "first" }] },
      { kind: "ordered", depth: 0, runs: [{ text: "second" }] },
    ]),
  ).toBe("- supplies\n  - salt\n\n1. first\n2. second");
});

it("renders a fenced code block with its language", () => {
  expect(
    blocksToMarkdown([
      {
        kind: "code",
        depth: 0,
        language: "ts",
        runs: [{ text: "const x = 1;" }],
      },
    ]),
  ).toBe("```ts\nconst x = 1;\n```");
});

it("renders a hard break as a trailing double space", () => {
  expect(
    blocksToMarkdown([
      p({ text: "one" }, { text: "\n", hardBreak: true }, { text: "two" }),
    ]),
  ).toBe("one  \ntwo");
});

it("renders an empty paragraph as nothing", () => {
  expect(blocksToMarkdown([p(), p({ text: "after" })])).toBe("after");
});

it("returns an empty string for no blocks", () => {
  expect(blocksToMarkdown([])).toBe("");
});
