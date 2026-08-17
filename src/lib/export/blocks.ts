import type { JSONContent } from "@tiptap/react";
import { fontStack } from "@/lib/typography";
import { hasPlaceholder, isApparatusPage, matterPartOf } from "@/lib/matter";
import { getBody, isGenericChapterTitle } from "@/lib/library-store";
import { stripInvalidXml } from "./xhtml";

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
  /**
   * The same size as the multiple of the body size it is stored as.
   *
   * For the Word file, which carries none of our CSS and wants half-points.
   * Set whenever `fontSize` is.
   */
  sizeMultiple?: number;
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

/**
 * Whether this page prints its own title above the prose.
 *
 * **The rule is the EPUB's and every renderer owes it.** A half-title, a title
 * page, a copyright page and a contents list are furniture rather than
 * divisions of the book: no published book has a sheet headed "Copyright
 * page", and the name exists so the writer can find the page in a list. The
 * EPUB has always known that; the PDF, the Word file and the markdown did not,
 * so one book came out of this app with four different structures depending on
 * which button was pressed — the copyright sheet headed "Copyright page" in
 * three of them and correct in the fourth.
 *
 * Lives here because `LoadedChapter` does, and because a rule that four
 * renderers apply cannot be four expressions that might drift. A dedication, a
 * prologue or a page the writer named themselves is a real division and keeps
 * its heading.
 *
 * **The reading view is the fifth caller**, and it was the one screen still
 * answering this for itself — by not asking at all. It headed the writer's own
 * contents page "Table of contents" and their copyright page "Copyright page",
 * neither of which is in the file, on the screen whose whole job is to show the
 * file. It takes the two fields the rule turns on rather than a whole
 * `LoadedChapter`, for the reason `chapterNumeral` below does: the reader's
 * pages carry a chapter id and no `doc`, and making them build a document to
 * ask a question about a title is how a sixth copy of this rule gets written.
 */
export function printsHeading(
  chapter: Pick<LoadedChapter, "title" | "matter">,
): boolean {
  return !isApparatusPage(chapter.matter ?? "body", chapter.title);
}

/**
 * The standing numeral above a chapter's title, or null for no numeral.
 *
 * **The other half of the opener, and it had drifted exactly as the heading
 * rule once did.** A chapter still called "Chapter 1" *is* its number, so
 * printing a numeral above it says the same thing twice on the opening line of
 * every chapter of every book that kept the default titles — which is most of
 * them. `epub.ts` knew that; `print.ts`, the export wizard's own EPUB preview
 * and the Word file each answered it differently, so one book came out with
 * three different chapter openings depending on which button was pressed:
 *
 *   - EPUB:  "The Fourth Lamp" under a 3, "Chapter One" under nothing
 *   - PDF:   "The Fourth Lamp" under a 3, "Chapter One" under a 1
 *   - Word:  neither, ever — the file lost which chapter it was
 *
 * So it lives here beside `printsHeading`, for the same reason that one does:
 * a rule four renderers apply cannot be four expressions that might disagree.
 * `isGenericChapterTitle` is the store's own answer and knows both the digit
 * form and the spelled one, so the contents page and the opener cannot come to
 * different views about the same chapter.
 *
 * Front and back matter are named rather than numbered and carry no number to
 * print. The writer's own `hideChapterNumbers` is a *typesetting* choice and is
 * applied by the stylesheet, not here — one file then serves both settings, and
 * a reader who restyles the book keeps the number.
 */
export function chapterNumeral(
  /* The two fields the rule turns on, rather than a whole `LoadedChapter`:
     the export wizard's specimen sheet asks this about a chapter it has only
     the shelf's meta for, and making it build a document to ask a question
     about a title would be the sort of friction that ends in a fifth copy of
     the rule. */
  chapter: Pick<LoadedChapter, "title" | "number">,
): number | null {
  if (chapter.number === null || chapter.number === undefined) return null;
  return isGenericChapterTitle(chapter.title) ? null : chapter.number;
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

    /* **Cleaned once, here, so every renderer inherits it.** The XHTML side is
       covered by `escapeXml`, but the Word file and the Markdown do not go
       through it — and a control character is a corrupt `.docx` for the same
       reason it is a fatal EPUB, since that format is XML in a zip too. The IR
       is the one place all four formats agree on, so it is where the text has
       to become text. See `stripInvalidXml`. */
    const run: Run = { text: stripInvalidXml(node.text) };
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
          //
          // **Both forms, because the four renderers do not want the same
          // one.** The CSS string is what the EPUB, the print document and the
          // reading view emit; a `.docx` has no stylesheet of ours and measures
          // type in half-points, so it needs the number the string was built
          // from. Re-parsing the string a line later would be reading back
          // something this function had just written.
          if (typeof mark.attrs?.size === "number") {
            run.fontSize = `calc(var(--ms-size, 1em) * ${mark.attrs.size})`;
            run.sizeMultiple = mark.attrs.size;
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
 * - **Nothing on the page.** A page with no content at all has nothing to
 *   print but its own title.
 * - **A `[placeholder]` left anywhere on it.** Deliberately unforgiving — a
 *   copyright page with the year filled in and `[author name]` still in it is
 *   half-done, and half-done is the state that actually ships by accident.
 *
 * **A heading counts, unless it is the name of a division.** Every heading was
 * ignored outright for a long time, and that discarded the pages this matters
 * most for: a half-title page carries the book's title and nothing else, so
 * imported from a manuscript it arrives as a single `<h2>` — which was marked
 * Draft in the panel and dropped from every exported file, the writer's own
 * page silently missing from the book.
 *
 * The exclusion was not baseless, though, and the narrower rule is what keeps
 * both cases right. **The old one-page design** put every standard division on
 * a single sheet as a heading, and books made before it changed still carry
 * one; untouched, that page is a stack of printer's terms and nothing else,
 * and it must not ship. Its headings are division *names* — "Copyright page",
 * "Dedication" — where an imported page's heading is the writer's own words.
 * So the catalogue decides: a heading naming a standard section is
 * scaffolding, any other heading is writing.
 *
 * (Nothing this app seeds today is affected either way. `matterPageDoc` writes
 * paragraphs only and never a heading, because the page's name is printed
 * above the body by the editor and by each exporter.)
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
    if (text.trim() === "") continue;
    // A heading that names one of the standard divisions is the old one-page
    // template talking, not the writer — see the note above.
    if (b.kind === "heading" && matterPartOf(text) !== null) continue;
    prose = true;
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
