/**
 * The shape every importer produces, before it becomes a book.
 *
 * Five very different file formats land here, so the parsers stay small and
 * ignorant of each other: each one turns its input into blocks, and everything
 * after that — splitting into chapters, counting words, building the editor's
 * document — is written once.
 *
 * The vocabulary is deliberately thin. An imported manuscript is prose, and
 * carrying tables, footnotes and colour through would mean inventing a
 * representation for things the editor cannot show anyway.
 */

export interface Inline {
  text: string;
  bold?: true;
  italic?: true;
}

export interface Block {
  type: "heading" | "paragraph";
  /** Headings only. Clamped to 1–3, which is what the editor offers. */
  level?: 1 | 2 | 3;
  inline: Inline[];
}

export function blockText(block: Block): string {
  return block.inline.map((i) => i.text).join("");
}

export function isBlank(block: Block): boolean {
  return blockText(block).trim() === "";
}

export function paragraph(text: string): Block {
  return { type: "paragraph", inline: text ? [{ text }] : [] };
}

export function heading(text: string, level: 1 | 2 | 3): Block {
  return { type: "heading", level, inline: text ? [{ text }] : [] };
}

/** Matches the editor's word count, which is what the sidebar will show. */
export function countWords(blocks: readonly Block[]): number {
  const text = blocks.map(blockText).join(" ").trim();
  return text ? text.split(/\s+/).length : 0;
}

/**
 * Blocks as a Tiptap document.
 *
 * Empty paragraphs keep their place — blank lines are how a novelist marks a
 * beat, and dropping them would silently rewrite the prose.
 */
export function toDoc(blocks: readonly Block[]): {
  type: "doc";
  content: unknown[];
} {
  return {
    type: "doc",
    content: blocks.map((block) => {
      const content = block.inline
        .filter((i) => i.text !== "")
        .map((i) => {
          const marks: { type: string }[] = [];
          if (i.bold) marks.push({ type: "bold" });
          if (i.italic) marks.push({ type: "italic" });
          return marks.length
            ? { type: "text", text: i.text, marks }
            : { type: "text", text: i.text };
        });

      if (block.type === "heading") {
        return {
          type: "heading",
          attrs: { level: block.level ?? 2 },
          ...(content.length ? { content } : {}),
        };
      }
      // A paragraph with no content is a valid empty paragraph in Tiptap; one
      // with an empty content array is not, and throws on load.
      return content.length
        ? { type: "paragraph", content }
        : { type: "paragraph" };
    }),
  };
}
