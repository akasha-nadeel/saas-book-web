import type { Editor } from "@tiptap/react";
import type { TextAlignValue } from "./text-align";

export type FormattingCommand =
  | { type: "paragraph" }
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "bulletList" }
  | { type: "orderedList" }
  | { type: "align"; value: TextAlignValue };

/**
 * The single command map used by persistent and overlay formatting UI.
 *
 * **`focus()` is asked for only when the editor has not got it**, and that is
 * not a micro-optimisation. Tiptap's focus command sets the selection, and
 * `tr.setSelection` clears ProseMirror's `storedMarks` — which is the entire
 * mechanism behind "bold from here on": with a collapsed caret, toggling a mark
 * stores it for the next thing typed rather than changing anything now. Calling
 * focus on an editor that already has it puts a selection reset in front of
 * every toggle, so the mark was set and dropped in the same transaction and the
 * button went dark again the moment it was pressed.
 *
 * The callers that need the focus keep it: the mobile dock and the rail can
 * both be pressed while the caret is elsewhere. The ones that already guard it
 * — the format pill and the selection toolbar, which `preventDefault` on
 * `mousedown` precisely so the editor never blurs — now get the toggle alone.
 */
export function applyFormattingCommand(
  editor: Editor,
  command: FormattingCommand,
): boolean {
  const chain = editor.isFocused ? editor.chain() : editor.chain().focus();

  switch (command.type) {
    case "paragraph":
      return chain.setParagraph().run();
    case "heading":
      return chain.toggleHeading({ level: command.level }).run();
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "underline":
      return chain.toggleUnderline().run();
    case "strike":
      return chain.toggleStrike().run();
    case "code":
      return chain.toggleCode().run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "align":
      return chain.setTextAlign(command.value).run();
  }
}
