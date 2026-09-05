"use client";

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * The passage the assistant just wrote, held lit until the writer moves on.
 *
 * **This exists because the press went away.** Write mode used to hand the
 * writer a passage and two buttons; it applies the change now, so the only
 * evidence anything happened is seeing it happen. The page scrolls to the new
 * prose and it stays marked until the next thing the writer does in the
 * manuscript.
 *
 * **A decoration and not the selection**, which is the whole reason this file
 * exists rather than a `setTextSelection` call. Focus goes back to the chat box
 * after a send, and a browser paints an unfocused selection as a grey wash or
 * as nothing at all — so the one signal that a change landed would be invisible
 * exactly when it is needed. A decoration looks the same wherever focus is.
 *
 * **It clears on the writer's next move, not on a timer.** A passage that faded
 * after three seconds would be gone by the time somebody looked up from the
 * panel; one that stayed for good would be a second highlight fighting the
 * search's. Any transaction that changes the document or moves the selection
 * puts it away — which is to say, the moment the writer takes the pen back.
 *
 * A sibling of `search-highlight.ts` and built from its parts: same plugin
 * shape, same kind of inline decoration, and `scrollEditorToMatch` over there
 * is what takes the page to it.
 */

export interface WrittenRange {
  from: number;
  to: number;
}

export const writtenHighlightPluginKey = new PluginKey<WrittenRange | null>(
  "writtenHighlight",
);

export const WrittenHighlight = Extension.create({
  name: "writtenHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<WrittenRange | null>({
        key: writtenHighlightPluginKey,
        state: {
          init: () => null,
          apply(tr, value) {
            /* An explicit set wins, including the null that clears it — this is
               the transaction that carries the range in right after the write. */
            const next = tr.getMeta(writtenHighlightPluginKey) as
              | WrittenRange
              | null
              | undefined;
            if (next !== undefined) return next;
            if (!value) return null;

            /* **The writer's next move puts it away.** `docChanged` covers
               typing over it; `selectionSet` covers a click that lands the
               caret somewhere. Neither fires for the scroll that follows the
               write, which is why the highlight survives long enough to be
               seen. */
            if (tr.docChanged || tr.selectionSet) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const range = writtenHighlightPluginKey.getState(state);
            if (!range || range.from >= range.to) return null;

            /* Clamped, because the range was measured against the document as
               it was: an undo between the write and the paint would otherwise
               ask for positions the document no longer has, and ProseMirror
               throws rather than shrugging. */
            const end = Math.min(range.to, state.doc.content.size);
            const start = Math.min(range.from, end);
            if (start >= end) return null;

            try {
              return DecorationSet.create(state.doc, [
                Decoration.inline(start, end, { class: "oc-written-passage" }),
              ]);
            } catch {
              return null;
            }
          },
        },
      }),
    ];
  },
});

/** Light the passage that was just written. `null` puts the mark away. */
export function markWritten(
  editor: Editor | null | undefined,
  range: WrittenRange | null,
) {
  if (!editor || editor.isDestroyed) return;
  try {
    const { tr } = editor.state;
    editor.view.dispatch(tr.setMeta(writtenHighlightPluginKey, range));
  } catch {
    /* A dispatch onto a view that is going away is not worth a console line —
       the highlight is the least important thing on screen. */
  }
}
