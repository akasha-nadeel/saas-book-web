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

/**
 * Where a change landed, so the caller can take the writer to it.
 *
 * Returned rather than a boolean because with no button to press, the writer's
 * only evidence that anything happened is seeing it happen: the panel scrolls
 * the page here and holds the passage lit until the next keystroke. Null is the
 * old `false` — nothing was written.
 *
 * **Measured from the document's size, not from the content that went in.**
 * `insertContentAt` reports neither, and counting the JSON would be counting
 * the wrong thing: a paragraph node is two positions more than its text, and
 * smart quotes and the input rules can change the length on the way in.
 */
export interface WrittenRange {
  from: number;
  to: number;
}

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

/**
 * Put `text` in place of `range`. One transaction, so one undo takes it back.
 *
 * Answers the range the new prose occupies, or null if nothing was written.
 */
export function applyReplacement(
  editor: Editor | null | undefined,
  range: { from: number; to: number },
  text: string,
): WrittenRange | null {
  if (!editor || editor.isDestroyed || !editor.isEditable) return null;

  const paragraphs = textToParagraphs(text);
  if (paragraphs.length === 0) return null;

  try {
    const before = editor.state.doc.content.size;
    const ok = editor
      .chain()
      .focus()
      .insertContentAt(range, replacementContent(paragraphs))
      .scrollIntoView()
      .run();
    if (!ok) return null;

    /* What went in is what the document grew by, plus what it lost. The old
       range is gone, so the new one starts where it did. */
    const grew = editor.state.doc.content.size - before;
    return { from: range.from, to: range.to + grew };
  } catch {
    return null;
  }
}

/**
 * Put `text` in as new paragraphs at `pos`. One transaction, as above.
 *
 * Answers the range the new prose occupies, or null if nothing was written.
 */
export function applyInsertion(
  editor: Editor | null | undefined,
  pos: number,
  text: string,
): WrittenRange | null {
  if (!editor || editor.isDestroyed || !editor.isEditable) return null;

  const paragraphs = textToParagraphs(text);
  if (paragraphs.length === 0) return null;

  try {
    const before = editor.state.doc.content.size;
    const ok = editor
      .chain()
      .focus()
      .insertContentAt(pos, paragraphNodes(paragraphs))
      .scrollIntoView()
      .run();
    if (!ok) return null;

    // Nothing was removed, so the whole of the growth is the new prose.
    return { from: pos, to: pos + (editor.state.doc.content.size - before) };
  } catch {
    return null;
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
