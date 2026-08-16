import { describe, expect, it } from "vitest";
import {
  blocksToXhtml,
  escapeXml,
  stripInvalidXml,
} from "@/lib/export/xhtml";
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

it("floats a wrapped image so the prose runs alongside it", () => {
  expect(
    blocksToXhtml([
      {
        kind: "image",
        depth: 0,
        src: "data:x",
        align: "right",
        imgWidth: "40%",
        wrap: true,
        runs: [],
      },
    ]),
  ).toBe(
    '<p class="figure" data-wrap="right" style="text-align:right;width:40%"><img src="data:x" alt="" /></p>',
  );
  // Unwrapped, the width stays on the picture and the figure keeps the column.
  expect(
    blocksToXhtml([
      {
        kind: "image",
        depth: 0,
        src: "data:x",
        align: "right",
        imgWidth: "40%",
        runs: [],
      },
    ]),
  ).toBe(
    '<p class="figure" style="text-align:right"><img src="data:x" alt="" style="width:40%" /></p>',
  );
});

it("renders a flush line's indent, alongside any alignment", () => {
  // On its own.
  expect(
    blocksToXhtml([
      { kind: "paragraph", depth: 0, noIndent: true, runs: [{ text: "Flush." }] },
    ]),
  ).toBe('<p style="text-indent:0">Flush.</p>');
  // With an alignment: one style attribute, since a second would be dropped by
  // the parser rather than merged.
  expect(
    blocksToXhtml([
      {
        kind: "paragraph",
        depth: 0,
        align: "left",
        noIndent: true,
        runs: [{ text: "Placed." }],
      },
    ]),
  ).toBe('<p style="text-align:left;text-indent:0">Placed.</p>');
  // Left-aligned prose that was never placed keeps the book's indent.
  expect(
    blocksToXhtml([
      { kind: "paragraph", depth: 0, align: "left", runs: [{ text: "Prose." }] },
    ]),
  ).toBe('<p style="text-align:left">Prose.</p>');
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

// ---------------------------------------------------------------------------
// The characters XML cannot carry
// ---------------------------------------------------------------------------

/*
 * These are the tests not to "fix" by loosening them. A single character from
 * this set anywhere in a manuscript is a *fatal* EPUBCheck error — RSC-016,
 * "an invalid XML character was found" — which fails the whole file rather
 * than one page of it. The editor never types one; the importers accept
 * whatever is in the file, and a form feed is how a plain-text book marks a
 * page break.
 */
describe("stripInvalidXml", () => {
  it("returns the very same string when there is nothing to do", () => {
    const clean = "Ordinary prose — with an em dash, “quotes” and 📚.";

    // Identity, not just equality: this runs on every pagination pass in the
    // reader, so the common case must not allocate.
    expect(stripInvalidXml(clean)).toBe(clean);
  });

  it("drops the control characters XML has no escape for", () => {
    expect(stripInvalidXml("a\u0000b")).toBe("ab");
    expect(stripInvalidXml("page\u000cbreak")).toBe("pagebreak");
    expect(stripInvalidXml("a\u0008b\u000bc\u001fd")).toBe("abcd");
  });

  it("keeps the three control characters XML does allow", () => {
    expect(stripInvalidXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });

  it("keeps a whole surrogate pair and drops half of one", () => {
    // An emoji is two code units and a real character; half of one is a fatal
    // parse error exactly like a NUL, and any cut that did not count code
    // points can leave one behind.
    expect(stripInvalidXml("a📚b")).toBe("a📚b");
    expect(stripInvalidXml("a\ud83db")).toBe("ab");
    expect(stripInvalidXml("a\udc4bb")).toBe("ab");
  });

  it("keeps every other character it is handed", () => {
    const text = "සිංහල عربي ∑∫≠ €40 ½ ﬁ";

    expect(stripInvalidXml(text)).toBe(text);
  });
});

describe("escapeXml", () => {
  it("escapes the metacharacters, ampersand first", () => {
    expect(escapeXml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });

  it("strips before it escapes, since an escape needs a carryable character", () => {
    expect(escapeXml("a\u0000&b")).toBe("a&amp;b");
  });
});

describe("a manuscript that would not parse", () => {
  it("renders no invalid character into the markup", () => {
    const xhtml = blocksToXhtml([p({ text: "before\u000cafter" })]);

    expect(xhtml).toBe("<p>beforeafter</p>");
  });
});
