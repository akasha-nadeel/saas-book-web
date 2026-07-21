import { heading, paragraph, type Block, type Inline } from "./blocks";

/**
 * Plain text and Markdown.
 *
 * The two share a paragraph model and differ only in whether `#` and `**` mean
 * anything, so they are one parser with a flag rather than two that drift.
 */

/**
 * Novel manuscripts arrive wrapped two different ways: a blank line between
 * paragraphs, or one paragraph per line. Guessing wrong either welds the whole
 * book into a single paragraph or explodes every wrapped line into its own, so
 * the file is asked which it is.
 */
function paragraphsOf(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  // No blank line anywhere means every line is its own paragraph. Rejoining
  // under that rule would weld the whole manuscript into one.
  if (!lines.some((line) => line === "")) return lines;

  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let blanks = 0;

  const flush = () => {
    if (buffer.length) paragraphs.push(buffer.join(" "));
    buffer = [];
  };

  for (const line of lines) {
    if (line === "") {
      blanks += 1;
      continue;
    }

    if (blanks > 0) {
      flush();
      // The first blank line ends the paragraph. Any beyond it were put there
      // on purpose — that is how a scene break is written — so they survive.
      for (let i = 1; i < blanks; i += 1) paragraphs.push("");
      blanks = 0;
    }

    // Soft-wrapped lines inside a paragraph rejoin.
    buffer.push(line);
  }

  flush();
  return paragraphs;
}

/** `**bold**`, `*italic*`, `_italic_`. Nesting is not attempted. */
function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;

  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });

    if (match[2] !== undefined) out.push({ text: match[2], bold: true });
    else if (match[4] !== undefined) out.push({ text: match[4], italic: true });

    last = match.index + match[0].length;
  }

  if (last < text.length) out.push({ text: text.slice(last) });
  return out.filter((i) => i.text !== "");
}

export function parseText(text: string, markdown: boolean): Block[] {
  const blocks: Block[] = [];

  for (const chunk of paragraphsOf(text)) {
    if (!chunk) {
      blocks.push(paragraph(""));
      continue;
    }

    if (markdown) {
      const head = /^(#{1,6})\s+(.*)$/.exec(chunk);
      if (head) {
        // Levels past 3 collapse: the editor offers three, and a document that
        // uses h4 for chapters would otherwise import as body text.
        const level = Math.min(head[1].length, 3) as 1 | 2 | 3;
        blocks.push(heading(head[2].trim(), level));
        continue;
      }

      // Setext underlines and horizontal rules carry no prose.
      if (/^(={3,}|-{3,}|\*{3,}|_{3,})$/.test(chunk)) continue;

      blocks.push({ type: "paragraph", inline: parseInline(chunk) });
      continue;
    }

    blocks.push(paragraph(chunk));
  }

  return blocks;
}
