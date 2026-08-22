"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

export interface EditorSelectionRange {
  from: number;
  to: number;
}

export function clampEditorSelection(
  range: EditorSelectionRange,
  documentSize: number,
): EditorSelectionRange {
  const max = Math.max(0, documentSize);
  const from = Math.min(max, Math.max(0, range.from));
  const to = Math.min(max, Math.max(from, range.to));
  return { from, to };
}

/** Keep the last useful range while a dialog or drawer owns focus. */
export function usePreservedEditorSelection(editor: Editor | null) {
  const range = useRef<EditorSelectionRange | null>(null);

  const capture = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    range.current = { from, to };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const remember = () => {
      const { from, to } = editor.state.selection;
      // Prefer a real range, but remember a caret when nothing has been
      // selected yet so closing a panel still returns to the writing position.
      if (from !== to || !range.current) range.current = { from, to };
    };
    remember();
    editor.on("selectionUpdate", remember);
    return () => {
      editor.off("selectionUpdate", remember);
    };
  }, [editor]);

  const restore = useCallback(() => {
    if (!editor || editor.isDestroyed || !range.current) return false;
    const next = clampEditorSelection(
      range.current,
      editor.state.doc.content.size,
    );
    return editor.commands.setTextSelection(next);
  }, [editor]);

  const run = useCallback(
    (command: (liveEditor: Editor) => void) => {
      if (!editor || editor.isDestroyed) return;
      restore();
      command(editor);
      capture();
    },
    [capture, editor, restore],
  );

  return { capture, restore, run };
}
