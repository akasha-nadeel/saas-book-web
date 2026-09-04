"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Menu } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ALIGN_OPTIONS,
  Field,
  SELECT_CLASS,
  useEditorState,
} from "@/components/editor/editor-toolbar";
import { setTypography, typographyOf, type Book } from "@/lib/library-store";
import {
  FONTS,
  INDENTS,
  LEADINGS,
  PARAGRAPH_STYLES,
  PARA_SPACINGS,
  TEXT_SIZES,
  paragraphStyleOf,
  paragraphStyleSettings,
  type ParagraphStyle,
} from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";
import { applyFormattingCommand } from "@/lib/editor/formatting-commands";

/**
 * The formatting bar, as a pill over the page.
 *
 * **It was a 16rem column behind an icon on the right edge.** Everything here
 * lived in the `Text & type` flyout: block type, the marks, and eight labelled
 * typography rows, stacked vertically and reachable only by finding a "T" in a
 * vertical rail and pressing it. A writer who did not know the rail was there
 * had no formatting at all, and one who did paid two presses for every bold.
 *
 * **Now it arrives when you click into the prose and leaves when you click
 * out** — the arrangement every editor a writer has already used puts it in,
 * and the one that costs nothing when they are only reading.
 *
 * ## The three rules holding it up
 *
 * - **It stands down for the selection bar.** `selection-toolbar.tsx` already
 *   floats these same controls over *selected* text, and only over a real
 *   selection. Both on screen at once would be the same buttons drawn twice a
 *   few hundred pixels apart, so this shows only while the caret is collapsed:
 *   click into a paragraph and you get the pill, select words in it and the bar
 *   takes over, on the words it is about. One formatting surface at a time.
 * - **Pressing it must not dismiss it.** Every button here calls
 *   `preventDefault` on `mousedown`, which is how the selection toolbar keeps
 *   the caret too — the editor never loses focus, so the command applies to the
 *   paragraph the writer is in rather than to nothing. The selects *do* take
 *   focus, since a select the keyboard cannot reach is not a control, so the
 *   blur is checked a tick later against where focus actually went.
 * - **Page colour and theme are not here.** They are settings about the page
 *   and the app, not about the paragraph the caret is in, and a bar that
 *   appears because you started writing should be about what you are writing.
 *   They stay in the rail.
 */

/** How far the four typography rows are from the pill's own row. */
const OVERFLOW_WIDTH = 268;

export function FormatPill({
  editor,
  book,
}: {
  editor: Editor | null;
  book: Book;
}) {
  /* Same subscription the rail uses: Tiptap's active-mark state changes on
     transactions React knows nothing about, so without this the buttons never
     light. */
  useEditorState(editor);

  const pill = useRef<HTMLDivElement>(null);
  const [showing, setShowing] = useState(false);

  /**
   * Visible only while the editor holds a collapsed caret.
   *
   * **The blur is answered a tick late, deliberately.** `blur` fires *before*
   * the browser moves focus, so reading `document.activeElement` inside it
   * gives the element being left rather than the one being entered — and the
   * pill would hide itself the moment a writer reached for its own font select.
   * One frame later the answer is right.
   */
  useEffect(() => {
    if (!editor) return;

    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        // Focus inside the pill is still "in the editor" as far as this is
        // concerned — the caret has not gone anywhere, the writer is choosing
        // a size.
        const inPill =
          document.activeElement instanceof Node &&
          pill.current?.contains(document.activeElement);
        const { from, to } = editor.state.selection;
        setShowing((editor.isFocused || !!inPill) && from === to);
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

  if (!editor) return null;

  const type = typographyOf(book);
  const blockAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;
  const activeAlign: TextAlignValue = blockAlign ?? type.align;
  const paraStyle = paragraphStyleOf(type);

  return (
    /* **Mounted at all times and hidden with opacity**, not unmounted: a bar
       that is torn down and rebuilt cannot fade, and one that appears the
       instant a caret lands is a flash rather than an arrival.
       `pointer-events-none` while hidden so it never catches a press meant for
       the prose underneath.

       Below the panel's `z-40` on purpose — an open panel is a thing the writer
       asked for and this is a thing that turned up. */
    <div
      ref={pill}
      role="toolbar"
      aria-label="Formatting"
      aria-hidden={!showing}
      className={`fixed top-3 left-1/2 z-30 hidden -translate-x-1/2
                  items-center gap-0.5 rounded-full border border-line
                  bg-panel px-1.5 py-1 shadow-lg transition-all duration-150
                  md:flex ${
                    showing
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
    >
      <PillButton
        label="Normal text"
        active={editor.isActive("paragraph")}
        onClick={() => applyFormattingCommand(editor, { type: "paragraph" })}
      >
        <span className="font-serif text-sm">¶</span>
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

      {/* The two a writer changes most, inline. The rest are behind the ⋯,
          because seven selects in a row is a settings screen lying down. */}
      <select
        aria-label="Font"
        value={type.font}
        onChange={(e) => setTypography(book.id, { font: e.target.value })}
        className={PILL_SELECT}
      >
        {FONTS.map((f) => (
          <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Text size in points"
        value={String(type.sizePt)}
        onChange={(e) =>
          setTypography(book.id, { sizePt: Number(e.target.value) })
        }
        className={PILL_SELECT}
      >
        {TEXT_SIZES.map((s) => (
          <option key={s} value={String(s)}>
            {s} pt
          </option>
        ))}
      </select>

      <Rule />

      {/* Per paragraph, applied where the caret is — not to the whole book. The
          book's default shows as active on a paragraph with none of its own. */}
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

      <Rule />

      <Menu
        label="More typography"
        align="end"
        width={OVERFLOW_WIDTH}
        triggerClassName="flex h-7 w-7 items-center justify-center rounded-full
                          text-muted outline-none transition-colors
                          hover:bg-raised hover:text-fg focus-visible:ring-2
                          focus-visible:ring-accent/60"
        trigger={<span className="text-base leading-none">&#8943;</span>}
      >
        {() => (
          <div className="flex flex-col gap-2 p-1.5">
            <Field label="Line spacing">
              <select
                aria-label="Line spacing"
                value={String(type.leading)}
                onChange={(e) =>
                  setTypography(book.id, { leading: Number(e.target.value) })
                }
                className={SELECT_CLASS}
              >
                {LEADINGS.map((l) => (
                  <option key={l.value} value={String(l.value)}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Paragraphs">
              <select
                aria-label="Paragraph style"
                value={paraStyle}
                onChange={(e) =>
                  setTypography(
                    book.id,
                    paragraphStyleSettings(e.target.value as ParagraphStyle),
                  )
                }
                className={SELECT_CLASS}
              >
                {PARAGRAPH_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Indent">
              <select
                aria-label="First-line indent"
                value={String(type.indentIn)}
                onChange={(e) =>
                  setTypography(book.id, { indentIn: Number(e.target.value) })
                }
                className={SELECT_CLASS}
              >
                {INDENTS.map((i) => (
                  <option key={i.value} value={String(i.value)}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Para space">
              <select
                aria-label="Paragraph spacing"
                value={String(type.paraSpacingPt)}
                onChange={(e) =>
                  setTypography(book.id, {
                    paraSpacingPt: Number(e.target.value),
                  })
                }
                className={SELECT_CLASS}
              >
                {PARA_SPACINGS.map((s) => (
                  <option key={s.value} value={String(s.value)}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </Menu>
    </div>
  );
}

/** Compact enough that seven of them and four selects fit one line. */
const PILL_SELECT =
  "max-w-28 cursor-pointer truncate rounded-md bg-transparent px-1.5 py-1 " +
  "font-sans text-xs text-fg outline-none transition-colors hover:bg-raised " +
  "focus-visible:ring-2 focus-visible:ring-accent/60";

function Rule() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;
}

/**
 * One command in the pill.
 *
 * **`onMouseDown` preventing default is the load-bearing line.** Without it the
 * press moves focus out of the manuscript before the click lands, the caret is
 * gone by the time the command runs, and the pill hides itself on the way. It
 * is the same guard the selection toolbar's buttons carry, for the same reason.
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
      className={`group relative flex h-7 w-7 shrink-0 items-center
                  justify-center rounded-full outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? "bg-selected text-fg"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      {children}
      <Tooltip label={label} shortcut={shortcut} side="bottom" nowrap />
    </button>
  );
}
