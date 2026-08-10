import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Word's Live Preview, for the face: hover a font and the selected words are
 * set in it, before anything is chosen.
 *
 * A typeface is the one formatting choice nobody can make from its name. Six
 * serifs listed as words is six guesses, and the way a writer settles it is by
 * looking at their own sentence in each — which is what Word has done since
 * 2007 and what every type tool has copied since. The alternative is apply,
 * look, undo, apply, look, undo.
 *
 * **The preview is a decoration, not a mark**, and that is the whole design.
 * Applying the real mark on hover and taking it off again would put six entries
 * in the undo stack for a decision nobody has made yet, would mark the chapter
 * dirty and hand it to autosave, and would leave a stray face behind if the
 * pointer left the menu on a frame the cleanup missed. A decoration is a
 * *view* concern: the document does not change, the mark does not exist, and
 * the moment the preview is cleared there is nothing to unwind.
 *
 * Two things follow from that. The transaction that sets it carries no steps,
 * so Tiptap's `update` never fires and autosave never hears about it — hovering
 * a menu is not an edit. And `addToHistory: false` is set anyway, belt and
 * braces, because a preview appearing in undo would be the same bug in a
 * quieter form.
 *
 * The range is mapped through every transaction rather than re-read from the
 * selection, so a preview survives anything that moves the text underneath it.
 */

interface Preview {
  from: number;
  to: number;
  /**
   * A CSS font stack, not an id — this never touches the document model.
   *
   * Null while the menu is open but nothing is being hovered: the highlight is
   * still drawn, because the words have to keep looking selected the whole time
   * the menu is about them. Pressing the trigger collapses the real selection
   * (see `FontPicker`), so the browser stops painting it exactly when a writer
   * most needs to see which words they are changing — they are choosing a face
   * *for that sentence*, and a menu floating over unhighlighted prose is a menu
   * about nothing in particular. Word keeps its grey band up for the same
   * reason.
   */
  css: string | null;
}

export const fontPreviewKey = new PluginKey<Preview | null>("fontPreview");

export const FontPreview = Extension.create({
  name: "fontPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin<Preview | null>({
        key: fontPreviewKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const next = tr.getMeta(fontPreviewKey) as
              | Preview
              | null
              | undefined;
            // `undefined` means this transaction said nothing about the
            // preview; null means clear it. The two have to be different or
            // every ordinary keystroke would wipe it.
            if (next !== undefined) return next;
            if (!value) return null;
            const from = tr.mapping.map(value.from);
            const to = tr.mapping.map(value.to);
            return from < to ? { ...value, from, to } : null;
          },
        },
        props: {
          decorations(state) {
            const preview = fontPreviewKey.getState(state);
            if (!preview) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(preview.from, preview.to, {
                class: "oc-font-preview",
                ...(preview.css
                  ? { style: `font-family: ${preview.css}` }
                  : {}),
              }),
            ]);
          },
        },
      }),
    ];
  },
});

/**
 * Show the preview over a range, with or without a face on it.
 *
 * A null `range` takes it down; a null `css` keeps the highlight and drops the
 * face, which is the state while the menu is open and nothing is hovered.
 *
 * The range is passed in rather than read from the selection here, because by
 * the time a writer is hovering a menu the DOM selection has already been
 * dropped — which is the same reason the picker remembers the range when it
 * opens. See `FontPicker`.
 */
export function previewFont(
  editor: Editor,
  range: { from: number; to: number } | null,
  css: string | null,
) {
  const showing = fontPreviewKey.getState(editor.state);
  const wanted =
    range && range.from < range.to
      ? { from: range.from, to: range.to, css }
      : null;

  // Nothing to say. Dispatching regardless would re-render the view on every
  // mouse move across a menu row.
  if (!showing && !wanted) return;
  if (
    showing &&
    wanted &&
    showing.from === wanted.from &&
    showing.to === wanted.to &&
    showing.css === wanted.css
  ) {
    return;
  }

  const tr = editor.state.tr.setMeta(fontPreviewKey, wanted);
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}
