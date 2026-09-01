import type { Editor } from "@tiptap/react";

/**
 * Putting the assistant's prose into the manuscript.
 *
 * **This is the only file in the app that writes model output into a book**,
 * and everything about it is arranged so that stays true and stays small.
 *
 * **Two anchors, both exact, and no third.** A replacement lands on the range
 * the writer selected; an insertion lands after the block the caret is in.
 * There is deliberately no "find the passage the model quoted and change that":
 * a model paraphrases its own quotation about as often as it reproduces it, and
 * the failure mode of a near miss is somebody else's paragraph rewritten. The
 * writer's selection cannot be misidentified.
 *
 * **Nothing here parses HTML, and nothing may.** Tiptap reads a bare string
 * passed to `insertContentAt` as markup, so `<b>` in a reply would arrive as a
 * tag rather than as four characters — the exact hole `markdown.ts` was written
 * to close, reopened at the other end of the same feature. Everything below
 * builds ProseMirror JSON with the words in a `text` node, where they can only
 * ever be words.
 *
 * **One transaction per change.** Both commands go through a single `chain()`,
 * which dispatches once, so one press of undo puts the writer's own prose back
 * — the same guarantee `replaceAllInEditor` in `src/lib/search.ts` makes, and
 * for the same reason.
 */

export type WriteAnchor =
  | { kind: "selection"; from: number; to: number; text: string }
  | { kind: "caret"; pos: number };

/** A Tiptap JSON node, as much of one as this file builds. */
interface ContentNode {
  type: string;
  text?: string;
  content?: ContentNode[];
}

/**
 * The model's prose, split the way a manuscript reads it.
 *
 * A blank line starts a new paragraph; a single newline inside one is the soft
 * wrap of a quoted line and becomes a space. That is Markdown's own rule, and
 * it is what a `>` block from a model actually contains — `markdown.ts` joins a
 * quote's lines with `\n` and leaves the blank ones in.
 *
 * Pure, and the reason it is: this is where prose stops being a string and
 * becomes document content, so it is the one step worth being able to check
 * without an editor.
 */
export function textToParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Paragraph nodes, for prose being added as blocks of its own. */
function paragraphNodes(paragraphs: string[]): ContentNode[] {
  return paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
}

/**
 * What to put in place of a selection.
 *
 * **A single paragraph goes in as text, not as a paragraph**, because a
 * selection is usually part of one — half a sentence, a clause — and replacing
 * it with a block node would split the paragraph it sits in and leave the
 * writer with two. As text it lands inside whatever block it was taken from,
 * which is what "replace these words" means. Several paragraphs have nowhere to
 * go but blocks.
 */
function replacementContent(paragraphs: string[]): ContentNode[] {
  if (paragraphs.length === 1) return [{ type: "text", text: paragraphs[0] }];
  return paragraphNodes(paragraphs);
}

/** What the assistant would work on if it were asked right now. */
export function anchorFor(editor: Editor | null | undefined): WriteAnchor | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      return {
        kind: "selection",
        from,
        to,
        text: editor.state.doc.textBetween(from, to, "\n\n", " "),
      };
    }
    return { kind: "caret", pos: from };
  } catch {
    return null;
  }
}

/**
 * Where "below" is: after the whole top-level block the caret sits in.
 *
 * Depth 1 rather than the caret's own depth, so a caret inside a list item puts
 * the new paragraph after the *list* rather than between two bullets, which is
 * what a writer means by below.
 */
export function insertBelowPos(editor: Editor | null | undefined): number | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    const { $from } = editor.state.selection;
    if ($from.depth === 0) return editor.state.doc.content.size;
    return $from.after(1);
  } catch {
    return null;
  }
}

/** Put `text` in place of `range`. One transaction, so one undo takes it back. */
export function applyReplacement(
  editor: Editor | null | undefined,
  range: { from: number; to: number },
  text: string,
): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable) return false;

  const paragraphs = textToParagraphs(text);
  if (paragraphs.length === 0) return false;

  try {
    return editor
      .chain()
      .focus()
      .insertContentAt(range, replacementContent(paragraphs))
      .scrollIntoView()
      .run();
  } catch {
    return false;
  }
}

/** Put `text` in as new paragraphs at `pos`. One transaction, as above. */
export function applyInsertion(
  editor: Editor | null | undefined,
  pos: number,
  text: string,
): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable) return false;

  const paragraphs = textToParagraphs(text);
  if (paragraphs.length === 0) return false;

  try {
    return editor
      .chain()
      .focus()
      .insertContentAt(pos, paragraphNodes(paragraphs))
      .scrollIntoView()
      .run();
  } catch {
    return false;
  }
}

/** Words, counted the way the rest of the app counts them. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * A passage shortened to something that fits on one line of a rail.
 *
 * Both ends rather than the opening alone: the writer is checking that this is
 * the passage they highlighted, and the end of a selection is where a stray
 * extra sentence shows up.
 */
export function passagePreview(text: string, limit = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const head = Math.ceil((limit - 1) / 2);
  const tail = limit - 1 - head;
  return `${flat.slice(0, head).trimEnd()}…${flat.slice(flat.length - tail).trimStart()}`;
}
