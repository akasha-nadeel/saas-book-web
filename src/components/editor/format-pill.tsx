"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Picker } from "@/components/ui/picker";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ALIGN_OPTIONS,
  useEditorState,
} from "@/components/editor/editor-toolbar";
import { setTypography, typographyOf, type Book } from "@/lib/library-store";
import { FONTS, TEXT_SIZES } from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";
import { applyFormattingCommand } from "@/lib/editor/formatting-commands";

/**
 * The formatting bar, as a pill over the top of the page.
 *
 * **It was a 16rem column behind an icon in the right rail.** Block type, the
 * marks and eight labelled typography rows, stacked vertically and reachable
 * only by finding a "T" in a vertical rail and pressing it. A writer who did
 * not know the rail was there had no formatting at all; one who did paid two
 * presses for every bold.
 *
 * Now it arrives when the caret lands in the prose and leaves when it goes.
 *
 * ## Four rules holding it up
 *
 * - **It is centred on the page, not on the window.** It mounts inside the desk
 *   strip, which already sizes its own row to `geom.pageW * zoom * PAGE_SCALE`
 *   and centres it — the same number the paper below is drawn from. So the pill
 *   sits over the middle of the sheet at any zoom, and follows the page sideways
 *   when the side panel opens, without measuring anything.
 * - **It replaces the strip's readings rather than stacking above them.** Word
 *   count, zoom and the save status stand down while it is here; none of the
 *   three is wanted mid-sentence and all three come back when the caret leaves.
 *   **Undo and redo are the exception and come with it** — undo is the control a
 *   writer wants *most* while typing, and hiding the strip would take it away
 *   exactly then.
 * - **It stands down for the selection bar.** `selection-toolbar.tsx` floats
 *   these same controls over *selected* text. Both at once would be the same
 *   buttons drawn twice, so this shows only while the caret is collapsed: click
 *   into a paragraph and you get the pill, select words and the bar takes over,
 *   on the words it is about.
 * - **Pressing it must not move the caret.** Every button calls `preventDefault`
 *   on `mousedown` — the same guard the selection toolbar's carry — so the
 *   editor never loses focus and the command applies to the paragraph the
 *   writer is in rather than to nothing. It is also what lets a mark set here
 *   survive as a *stored mark*, which is how "bold from here on" works.
 */

/**
 * Whether the formatting bar should be showing.
 *
 * **Exported because two components need one answer.** The pill draws itself
 * and the desk strip has to stand its readings down at the same moment; two
 * copies of this test would disagree for a frame and the row would flicker.
 */
export function useFormatPillVisible(editor: Editor | null): boolean {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (!editor) return;

    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      /**
       * **Answered a frame late, deliberately.** `blur` fires *before* the
       * browser moves focus, so reading `document.activeElement` inside it
       * names the element being left rather than the one being entered — and
       * the bar would stand down the moment a writer reached for its own font
       * menu. One frame later the answer is right.
       */
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        /* Focus inside the pill or in a menu it opened is still "in the
           editor" as far as this is concerned: the caret has not gone
           anywhere, the writer is choosing a size. The menus portal to
           `document.body`, so they are found by their role rather than by
           being inside the bar. */
        const active = document.activeElement;
        const inChrome =
          active instanceof Element &&
          !!active.closest('[data-format-pill], [role="menu"]');
        /**
         * **Focus alone decides it, and a selection does not take it away.**
         *
         * This required a collapsed caret until 2026-09-04, so that the
         * floating selection bar could have the field to itself over selected
         * words. What that produced was Ctrl+A putting the formatting bar
         * away — at the exact moment a writer has selected everything *in
         * order to format it*. A persistent toolbar that disappears when you
         * make a selection is not persistent.
         *
         * The two now share the screen on an ordinary selection, deliberately:
         * this one never moves, and the floating one comes to the words. The
         * selection bar stands down for a select-all, where it has nothing to
         * point at — see `selection-toolbar.tsx`.
         */
        setShowing(editor.isFocused || inChrome);
      });
    };

    read();
    editor.on("focus", read);
    editor.on("blur", read);
    editor.on("selectionUpdate", read);
    document.addEventListener("focusin", read);

    return () => {
      cancelAnimationFrame(frame);
      editor.off("focus", read);
      editor.off("blur", read);
      editor.off("selectionUpdate", read);
      document.removeEventListener("focusin", read);
    };
  }, [editor]);

  return showing;
}

export function FormatPill({
  editor,
  book,
  visible,
  history,
}: {
  editor: Editor | null;
  book: Book;
  visible: boolean;
  /**
   * Undo and redo, passed in rather than rebuilt.
   *
   * `HistoryControls` lives in `chapter-editor.tsx` with the desk strip it was
   * written for, and it is the same pair either way — a second copy would be a
   * second answer to "can this be undone".
   */
  history?: React.ReactNode;
}) {
  /* Same subscription the rail uses: Tiptap's active-mark state changes on
     transactions React knows nothing about, so without this the buttons never
     light — which is the whole of whether a writer can see that bold is on. */
  useEditorState(editor);

  if (!editor) return null;

  const type = typographyOf(book);
  const blockAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;
  const activeAlign: TextAlignValue = blockAlign ?? type.align;

  return (
    /* **Mounted always and hidden with opacity**, not unmounted: a bar torn
       down and rebuilt cannot fade, and one that appears the instant a caret
       lands is a flash rather than an arrival. `pointer-events-none` while
       hidden so it never catches a press meant for the strip underneath.

       `absolute` and centred on the strip — which is centred on the page. */
    <div
      data-format-pill=""
      role="toolbar"
      aria-label="Formatting"
      aria-hidden={!visible}
      /* **Below the bar, not on it.** It was centred on the desk strip, which
         is a 36px row against a 50px bar — so it hung seven pixels over the
         strip's top edge, and the strip is the first thing in the window, so
         those seven pixels were cut off by the edge of the app. Hanging it
         from the strip's underside puts the whole of it on screen and reads
         as what it is: a bar floating over the page rather than one crammed
         into the chrome above it. */
      className={`absolute top-full left-1/2 z-20 mt-1 hidden -translate-x-1/2
                  items-center gap-1 rounded-2xl border border-line bg-panel
                  px-2 py-1.5 shadow-lg transition-all duration-150 md:flex ${
                    visible
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
    >
      <PillButton
        label="Normal text"
        active={editor.isActive("paragraph")}
        onClick={() => applyFormattingCommand(editor, { type: "paragraph" })}
      >
        <span className="font-serif text-base">¶</span>
      </PillButton>
      {([1, 2, 3] as const).map((level) => (
        <PillButton
          key={level}
          label={`Heading ${level}`}
          active={editor.isActive("heading", { level })}
          onClick={() =>
            applyFormattingCommand(editor, { type: "heading", level })
          }
        >
          <span className="font-serif text-sm">H{level}</span>
        </PillButton>
      ))}

      <Rule />

      <PillButton
        label="Bold"
        shortcut="Ctrl B"
        active={editor.isActive("bold")}
        onClick={() => applyFormattingCommand(editor, { type: "bold" })}
      >
        <span className="font-bold">B</span>
      </PillButton>
      <PillButton
        label="Italic"
        shortcut="Ctrl I"
        active={editor.isActive("italic")}
        onClick={() => applyFormattingCommand(editor, { type: "italic" })}
      >
        <span className="font-serif italic">I</span>
      </PillButton>
      <PillButton
        label="Underline"
        shortcut="Ctrl U"
        active={editor.isActive("underline")}
        onClick={() => applyFormattingCommand(editor, { type: "underline" })}
      >
        <span className="underline">U</span>
      </PillButton>
      <PillButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => applyFormattingCommand(editor, { type: "strike" })}
      >
        <span className="line-through">S</span>
      </PillButton>

      <Rule />

      {/* The two a writer reaches for. The rest of the book's typography —
          line spacing, paragraphs, indent, para space — is in the rail's
          Type & page flyout: those are set once for the whole manuscript, not
          per caret, and they cannot live in a menu opened from this one
          anyway, since two portalled menus dismiss each other. */}
      <Picker
        label="Font"
        value={type.font}
        onChange={(font) => setTypography(book.id, { font })}
        width={220}
        options={FONTS.map((f) => ({
          value: f.id,
          label: f.label,
          style: { fontFamily: f.stack },
        }))}
      />
      <Picker
        label="Size"
        value={String(type.sizePt)}
        onChange={(size) => setTypography(book.id, { sizePt: Number(size) })}
        width={140}
        options={TEXT_SIZES.map((s) => ({
          value: String(s),
          label: `${s} pt`,
        }))}
      />

      <Rule />

      {/* Per paragraph, applied where the caret is — not to the whole book.
          The book's default shows as active on a paragraph with none of its
          own. */}
      {ALIGN_OPTIONS.map((option) => (
        <PillButton
          key={option.value}
          label={option.label}
          active={activeAlign === option.value}
          onClick={() =>
            applyFormattingCommand(editor, {
              type: "align",
              value: option.value,
            })
          }
        >
          {option.icon}
        </PillButton>
      ))}

      {history && (
        <>
          <Rule />
          <div className="flex items-center gap-0.5">{history}</div>
        </>
      )}
    </div>
  );
}

function Rule() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />;
}

/**
 * One command in the pill.
 *
 * **`onMouseDown` preventing default is the load-bearing line.** Without it the
 * press moves focus out of the manuscript before the click lands, the caret is
 * gone by the time the command runs, and any mark it set is dropped with the
 * selection. It is the same guard the selection toolbar's buttons carry.
 */
function PillButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`group relative flex h-9 w-9 shrink-0 items-center
                  justify-center rounded-lg outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? /* A filled accent, not the subtle raised pill the rail
                           uses. This is the one control on screen whose *state*
                           a writer is checking mid-sentence — "am I still in
                           bold" — and a tint they have to look twice at is a
                           question rather than an answer. */
                        "bg-accent text-accent-ink"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      {children}
      <Tooltip label={label} shortcut={shortcut} side="bottom" nowrap />
    </button>
  );
}
