import type { JSONContent } from "@tiptap/react";

/**
 * A format-neutral view of a Tiptap document.
 *
 * Every export format is the same walk over the same nodes, so the walk happens
 * once and three renderers consume the result. That keeps the tricky part —
 * marks, nesting, hard breaks — in one tested place instead of three.
 *
 * The list is flat, with `depth` recording list nesting, rather than a tree.
 * Novels are paragraphs and the occasional list; a flat list is far easier to
 * render correctly in three formats than a recursive structure is.
 */

export type BlockKind =
  | "paragraph"
  | "heading"
  | "quote"
  | "bullet"
  | "ordered"
  | "code"
  | "sceneBreak"
  | "image";

export interface Run {
  text: string;
  bold?: true;
  italic?: true;
  strike?: true;
  code?: true;
  underline?: true;
  /** Set on a run produced by a hardBreak, whose text is a bare newline. */
  hardBreak?: true;
  href?: string;
}

/**
 * A chapter with its document parsed, ready to render. Lives here rather than
 * beside the orchestration so the format builders can import it without
 * depending on the module that dynamically imports *them*.
 */
export interface LoadedChapter {
  title: string;
  doc: JSONContent;
  /** The body-chapter number, or null for front and back matter — which are
   *  named, so the exporters print no numeral above them. */
  number: number | null;
}

export interface Block {
  kind: BlockKind;
  /** List nesting, 0 for everything else. */
  depth: number;
  /** Heading level 1-3. Only set on headings. */
  level?: number;
  /** Only set on code blocks, when the editor recorded one. */
  language?: string;
  /** Only set on images. A data URL — see lib/image-import. */
  src?: string;
  alt?: string;
  runs: Run[];
}

function runsFrom(content: JSONContent[] | undefined): Run[] {
  const runs: Run[] = [];

  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n", hardBreak: true });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;

    const run: Run = { text: node.text };
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":
          run.bold = true;
          break;
        case "italic":
          run.italic = true;
          break;
        case "strike":
          run.strike = true;
          break;
        case "code":
          run.code = true;
          break;
        case "underline":
          run.underline = true;
          break;
        case "link":
          if (typeof mark.attrs?.href === "string") run.href = mark.attrs.href;
          break;
      }
    }
    runs.push(run);
  }

  return runs;
}

function walk(nodes: JSONContent[], depth: number, out: Block[]) {
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push({ kind: "paragraph", depth, runs: runsFrom(node.content) });
        break;

      case "heading":
        out.push({
          kind: "heading",
          depth,
          level: Number(node.attrs?.level ?? 1),
          runs: runsFrom(node.content),
        });
        break;

      case "blockquote":
        // A quote's paragraphs become quote blocks; the quoting is the block
        // kind, not a nesting level.
        for (const child of node.content ?? []) {
          out.push({ kind: "quote", depth, runs: runsFrom(child.content) });
        }
        break;

      case "bulletList":
      case "orderedList": {
        const kind = node.type === "bulletList" ? "bullet" : "ordered";
        for (const item of node.content ?? []) {
          for (const child of item.content ?? []) {
            if (child.type === "bulletList" || child.type === "orderedList") {
              walk([child], depth + 1, out);
            } else {
              // A second paragraph inside one list item keeps its text rather
              // than being dropped, as a continuation at the same depth.
              out.push({ kind, depth, runs: runsFrom(child.content) });
            }
          }
        }
        break;
      }

      case "codeBlock": {
        const language = node.attrs?.language;
        out.push({
          kind: "code",
          depth,
          ...(typeof language === "string" && language ? { language } : {}),
          runs: runsFrom(node.content),
        });
        break;
      }

      case "image": {
        const src = node.attrs?.src;
        // An image with no source is not worth a block; anything else would
        // render as a broken picture in every export format.
        if (typeof src === "string" && src) {
          const alt = node.attrs?.alt;
          out.push({
            kind: "image",
            depth,
            src,
            ...(typeof alt === "string" && alt ? { alt } : {}),
            runs: [],
          });
        }
        break;
      }

      case "horizontalRule":
        // Rendered as a scene break rather than a rule, matching how the editor
        // styles it and how a printed book sets one.
        out.push({ kind: "sceneBreak", depth, runs: [] });
        break;

      default:
        // Unknown node: descend rather than drop, so its text still survives.
        if (node.content) walk(node.content, depth, out);
    }
  }
}

export function toBlocks(doc: JSONContent): Block[] {
  const out: Block[] = [];
  walk(doc.content ?? [], 0, out);
  return out;
}
