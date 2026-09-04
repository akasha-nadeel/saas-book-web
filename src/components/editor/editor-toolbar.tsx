"use client";

import { useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";

import type { TextAlignValue } from "@/lib/editor/text-align";

/**
 * What is left of the editor’s right-hand tool rail.
 *
 * **The rail itself is gone.** It was a column of glyphs down the right edge
 * of the window whose every control opened a portalled flyout that positioned
 * itself leftwards, because there was nowhere else for it to go — and half of
 * what it held is now in the Page & type panel on the other side of the page,
 * where a control has room to be a labelled row instead of a glyph. Keeping
 * both would have been two ways to set one book’s type, which is how two
 * screens end up disagreeing about one manuscript.
 *
 * These two survive it because other screens had already borrowed them: the
 * alignment set is drawn by the formatting pill and the selection bar, and the
 * subscription below is what four different components re-render on.
 */
export const ALIGN_OPTIONS: {
  value: TextAlignValue;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "left", label: "Align left", icon: alignIcon("M3.5 5h13M3.5 9h8M3.5 13h13M3.5 17h8") },
  { value: "center", label: "Align centre", icon: alignIcon("M3.5 5h13M6 9h8M3.5 13h13M6 17h8") },
  { value: "right", label: "Align right", icon: alignIcon("M3.5 5h13M8.5 9h8M3.5 13h13M8.5 17h8") },
  { value: "justify", label: "Justify", icon: alignIcon("M3.5 5h13M3.5 9h13M3.5 13h13M3.5 17h13") },
];

function alignIcon(d: string) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The formatting tools, as a column in the right rail.
 *
 * These used to be a row above the manuscript. Moving them into the rail gives
 * the page back that height — on a laptop the toolbar was a noticeable slice of
 * the writing area — and matches the reference, which keeps no permanent
 * toolbar over the page at all.
 *
 * Every control maps to a command StarterKit already provides. Quote, lists and
 * scene break stay absent: each is reachable by typing "> ", "- ", "1. " or
 * "---", so a button would duplicate a path rather than provide one.
 */

/**
 * Re-render on anything the editor does.
 *
 * Exported for the desk bar's undo and redo, which have to grey out the moment
 * there is nothing left to undo — `editor.can().undo()` is read at render time,
 * so without a subscription the buttons would answer whatever was true when
 * their component last happened to render.
 */
export function useEditorState(editor: Editor | null) {
  return useSyncExternalStore(
    (onChange) => {
      if (!editor) return () => {};
      // Selection covers caret moves; transaction covers the marks themselves.
      editor.on("selectionUpdate", onChange);
      editor.on("transaction", onChange);
      return () => {
        editor.off("selectionUpdate", onChange);
        editor.off("transaction", onChange);
      };
    },
    // ProseMirror's EditorState is immutable: a new object per transaction,
    // the same reference between them. That is exactly what getSnapshot needs.
    // (Do not reach for `editor.state.tr` here — it *creates* a transaction on
    // every access, so the snapshot never compares equal and React spins.)
    () => editor?.state ?? null,
    () => null,
  );
}
