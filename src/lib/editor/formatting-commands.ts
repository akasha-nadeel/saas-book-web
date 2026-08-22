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

/** The single command map used by persistent and overlay formatting UI. */
export function applyFormattingCommand(
  editor: Editor,
  command: FormattingCommand,
): boolean {
  const chain = editor.chain().focus();

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
