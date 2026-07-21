import { paragraph, type Block, type Inline } from "./blocks";

/**
 * HTML into blocks.
 *
 * Shared by the .html importer and by EPUB, whose chapters are XHTML files.
 * Written against the DOM rather than a regex because the input is real
 * documents from real word processors, which produce markup no pattern
 * survives.
 */

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "LI",
  "PRE",
]);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "HEAD", "NOSCRIPT", "TEMPLATE"]);

const BOLD_TAGS = new Set(["B", "STRONG"]);
const ITALIC_TAGS = new Set(["I", "EM"]);

/** Collapses runs of whitespace the way a browser lays them out. */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ");
}

function inlineOf(node: Node, bold: boolean, italic: boolean): Inline[] {
  if (node.nodeType === 3 /* text */) {
    const text = normalise(node.nodeValue ?? "");
    if (!text) return [];
    return [
      {
        text,
        ...(bold ? { bold: true as const } : {}),
        ...(italic ? { italic: true as const } : {}),
      },
    ];
  }

  if (node.nodeType !== 1 /* element */) return [];

  const el = node as Element;
  if (SKIP_TAGS.has(el.tagName)) return [];

  const nextBold = bold || BOLD_TAGS.has(el.tagName);
  const nextItalic = italic || ITALIC_TAGS.has(el.tagName);

  const out: Inline[] = [];
  for (const child of Array.from(el.childNodes)) {
    out.push(...inlineOf(child, nextBold, nextItalic));
  }
  return out;
}

/** Merges neighbours carrying the same marks, so one run is not split in ten. */
function coalesce(inline: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const piece of inline) {
    const last = out[out.length - 1];
    if (last && last.bold === piece.bold && last.italic === piece.italic) {
      last.text += piece.text;
    } else {
      out.push({ ...piece });
    }
  }
  return out.filter((i) => i.text.trim() !== "" || i.text === " ");
}

function walk(el: Element, blocks: Block[]): void {
  for (const child of Array.from(el.children)) {
    if (SKIP_TAGS.has(child.tagName)) continue;

    const isBlock = BLOCK_TAGS.has(child.tagName);
    // A div that only wraps other blocks is scaffolding, not a paragraph.
    const wrapsBlocks = Array.from(child.children).some((g) =>
      BLOCK_TAGS.has(g.tagName),
    );

    if (isBlock && !wrapsBlocks) {
      const inline = coalesce(inlineOf(child, false, false));
      const text = inline.map((i) => i.text).join("").trim();

      const headingLevel = /^H([1-6])$/.exec(child.tagName);
      if (headingLevel && text) {
        blocks.push({
          type: "heading",
          level: Math.min(Number(headingLevel[1]), 3) as 1 | 2 | 3,
          inline,
        });
      } else if (text) {
        blocks.push({ type: "paragraph", inline });
      } else {
        // Word and Google Docs mark blank lines with an empty paragraph, and
        // those are the beats between scenes.
        blocks.push(paragraph(""));
      }
      continue;
    }

    walk(child, blocks);
  }
}

export function parseHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  walk(doc.body ?? doc.documentElement, blocks);
  return blocks;
}
