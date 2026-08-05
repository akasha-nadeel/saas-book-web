import type { JSONContent } from "@tiptap/react";
import { fontStack } from "@/lib/typography";
import { hasPlaceholder } from "@/lib/matter";
import { getBody } from "@/lib/library-store";

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
  /** An inline font size, as a CSS length (e.g. "1.3em"). See lib/editor/font-size. */
  fontSize?: string;
  /** An inline font family, as a CSS stack. See lib/editor/font-family. */
  fontFamily?: string;
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
  /**
   * Which part of the book this page belongs to.
   *
   * Optional, and absent means the body. Front and back matter are lists of
   * named pages (see `src/lib/matter.ts`), and the EPUB has to say which is
   * which: a dedication labelled `bodymatter chapter` tells a reading system
   * the novel begins there. `number` cannot answer it — a *blank* body chapter
   * has a number and a dedication does not, but so does nothing else about
   * them differ from the exporters' side.
   */
  matter?: "front" | "body" | "back";
}

export interface Block {
  kind: BlockKind;
  /** List nesting, 0 for everything else. */
  depth: number;
  /** Heading level 1-3. Only set on headings. */
  level?: number;
  /** Per-paragraph alignment, when set away from the book default. */
  align?: "left" | "center" | "right" | "justify";
  /** Set on a line placed flush at the margin, which takes no first-line
   *  indent. Separate from `align` on purpose — see lib/editor/no-indent.ts. */
  noIndent?: true;
  /** Only set on code blocks, when the editor recorded one. */
  language?: string;
  /** Only set on images. A data URL — see lib/image-import. */
  src?: string;
  alt?: string;
  /** Image width as a CSS length (e.g. "50%"), when the writer sized it. */
  imgWidth?: string;
  /** Set on an image the prose runs alongside rather than resuming beneath —
   *  Word's "Square" wrapping. Only ever set together with `align`. */
  wrap?: true;
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
        case "fontFamily":
          // The mark stores a face id from the book’s own list; the stack is
          // resolved here so the renderers only ever see CSS. An id this
          // build does not know is dropped rather than written out as a
          // font-family nothing can match.
          if (typeof mark.attrs?.font === "string") {
            const stack = fontStack(mark.attrs.font);
            if (stack) run.fontFamily = stack;
          }
          break;
        case "fontSize":
          // The mark stores a multiple of the body size; render it the same way
          // the editor does. Kept inline rather than importing the editor module
          // so the export layer stays free of it.
          if (typeof mark.attrs?.size === "number") {
            run.fontSize = `calc(var(--ms-size, 1em) * ${mark.attrs.size})`;
          }
          break;
      }
    }
    runs.push(run);
  }

  return runs;
}

// Node alignment as a Block field, when set to one of the four known values.
function alignOf(node: JSONContent): Pick<Block, "align"> {
  const align = node.attrs?.textAlign;
  return align === "left" ||
    align === "center" ||
    align === "right" ||
    align === "justify"
    ? { align }
    : {};
}

// The flush-at-the-margin mark, so a placed line reads the same in the reading
// view and every export as it does on the page it was written on.
function indentOf(node: JSONContent): Pick<Block, "noIndent"> {
  return node.attrs?.noIndent === true ? { noIndent: true } : {};
}

function walk(nodes: JSONContent[], depth: number, out: Block[]) {
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push({
          kind: "paragraph",
          depth,
          runs: runsFrom(node.content),
          ...alignOf(node),
          ...indentOf(node),
        });
        break;

      case "heading":
        out.push({
          kind: "heading",
          depth,
          level: Number(node.attrs?.level ?? 1),
          runs: runsFrom(node.content),
          ...alignOf(node),
          ...indentOf(node),
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
          const align = node.attrs?.align;
          const imgWidth = node.attrs?.width;
          out.push({
            kind: "image",
            depth,
            src,
            ...(typeof alt === "string" && alt ? { alt } : {}),
            ...(align === "left" || align === "right" ? { align } : {}),
            ...(typeof imgWidth === "string" && imgWidth ? { imgWidth } : {}),
            // Only meaningful against a side — a centred picture has no side
            // for the words to run down, so the flag is dropped with the
            // alignment rather than carried into an export that cannot use it.
            ...(node.attrs?.wrap === true &&
            (align === "left" || align === "right")
              ? { wrap: true as const }
              : {}),
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

/**
 * Whether a front- or back-matter page is still scaffolding.
 *
 * **This is what stops a template shipping inside somebody's book.** Pressing
 * Start on Front matter makes the eight standard pages, each seeded with the
 * real shape of the thing and the writer's own details missing — `For [name].`
 * for a dedication, `Copyright © [year] [author name]`. Left as they came, they
 * used to export exactly like that: a reader opening the finished EPUB met
 * bare publishing terms sitting in the contents between the cover and Chapter
 * One, which is what a template looks like when somebody forgets to delete it.
 *
 * Two things count as scaffolding, and the second is the useful one:
 *
 * - **Nothing under the heading.** A page with no prose at all has nothing to
 *   print but its own title.
 * - **A `[placeholder]` left anywhere on it.** Deliberately unforgiving — a
 *   copyright page with the year filled in and `[author name]` still in it is
 *   half-done, and half-done is the state that actually ships by accident.
 *
 * The cost is a writer who genuinely wants square brackets in their front
 * matter, which is why the export screen **names every page it left out**
 * rather than dropping them silently. A filter nobody can see is worse than
 * the problem it solves.
 *
 * Body chapters are never tested. An empty chapter is a chapter the writer has
 * not written yet, and dropping it would hide a hole in their book.
 */
export function isUntouchedMatter(blocks: readonly Block[]): boolean {
  let prose = false;
  for (const b of blocks) {
    // An image is content even with no words in it.
    if (b.kind === "image") {
      prose = true;
      continue;
    }
    const text = b.runs.map((r) => r.text).join("");
    if (hasPlaceholder(text)) return true;
    if (b.kind !== "heading" && text.trim() !== "") prose = true;
  }
  return !prose;
}

/**
 * Whether a stored matter page is still scaffolding — `isUntouchedMatter`
 * against what is actually on the key.
 *
 * **Three screens ask this question and they must not answer it differently.**
 * The export leaves these pages out of the file, the reading view leaves them
 * out of the read-through, and the book panel marks their row *Draft* to say so
 * in advance. A row that promises one thing while the file does another is
 * worse than no row at all, so the reading is in one place rather than written
 * out three times against the same rule.
 *
 * Lives here, beside the rule, rather than in `export/index.ts`: the panel and
 * the reader would otherwise pull in the export orchestrator — and with it the
 * dynamic imports of `docx` and `jszip` — to ask about one page.
 */
export function isDraftMatter(chapterId: string): boolean {
  const raw = getBody(chapterId);
  if (!raw) return true;
  try {
    return isUntouchedMatter(toBlocks(JSON.parse(raw) as JSONContent));
  } catch {
    // A body that will not parse is one the exporters render as empty, which is
    // the same answer this gives.
    return true;
  }
}
