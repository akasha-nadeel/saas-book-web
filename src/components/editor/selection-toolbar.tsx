"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { steppedFontSize } from "@/lib/editor/font-size";
import { FONTS } from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";

/**
 * The floating formatting bar that appears over a text selection — the mini
 * toolbar a word processor pops up when you highlight text, so the common
 * formatting is under the pointer instead of across the room in the rail.
 *
 * The quick formatting under the pointer: the inline marks (weight, slant,
 * underline, strike, code, a link) and inline size, which touch only the
 * selected words; paragraph alignment; and the block forms — a quote (the
 * indented, ruled passage) and bulleted or numbered lists. Inline size uses
 * A− / A+ to step, ¶ to reset, and H1–H3 for heading-like sizes, all applied to
 * the selection rather than converting its block, because clicking a block
 * heading on one word and watching the whole paragraph grow is the surprise this
 * avoids. Real block headings live in the Aa flyout. Built on Tiptap's
 * BubbleMenu, which sits it above the selection and follows it as the page
 * scrolls.
 */

/** Re-render on every editor change, so the active states stay in step with the
 *  selection. ProseMirror's state is a new object per transaction. */
function useEditorTick(editor: Editor | null) {
  return useSyncExternalStore(
    (onChange) => {
      if (!editor) return () => {};
      editor.on("selectionUpdate", onChange);
      editor.on("transaction", onChange);
      return () => {
        editor.off("selectionUpdate", onChange);
        editor.off("transaction", onChange);
      };
    },
    () => editor?.state ?? null,
    () => null,
  );
}

function Btn({
  onClick,
  active,
  label,
  shortcut,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // The whole reason this bar stays on screen.
      //
      // Pressing a button moves focus to it, which blurs the manuscript, and a
      // bubble menu over a blurred editor has nothing to point at — so it hid
      // the instant a writer pressed anything on it. Refusing the mousedown
      // means focus never leaves the prose in the first place: the click still
      // fires, the selection is never dropped, and the bar is still there for
      // the next button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center
                  justify-center rounded-md text-sm outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    active ? "bg-accent text-white" : "text-fg hover:bg-raised"
                  }`}
    >
      {children}
    </button>
  );
}

const Sep = () => (
  <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
);

/** The four alignments, each with a small icon of ruled lines. */
const ALIGN_OPTIONS: {
  value: TextAlignValue;
  label: string;
  d: string;
}[] = [
  {
    value: "left",
    label: "Align left",
    d: "M3.5 5h13M3.5 9h8M3.5 13h13M3.5 17h8",
  },
  {
    value: "center",
    label: "Align centre",
    d: "M3.5 5h13M6 9h8M3.5 13h13M6 17h8",
  },
  {
    value: "right",
    label: "Align right",
    d: "M3.5 5h13M8.5 9h8M3.5 13h13M8.5 17h8",
  },
  {
    value: "justify",
    label: "Justify",
    d: "M3.5 5h13M3.5 9h13M3.5 13h13M3.5 17h13",
  },
];

export function SelectionToolbar({ editor }: { editor: Editor | null }) {
  useEditorTick(editor);

  // Stable references, or the BubbleMenu re-dispatches an "updateOptions"
  // transaction on every render — which re-renders this toolbar, which makes
  // new props, and so on without end. Memoising breaks that loop.
  const shouldShow = useCallback(
    ({ state, from, to }: { state: EditorState; from: number; to: number }) => {
      if (!editor?.isEditable) return false;
      if (from === to) return false;
      if (!(state.selection instanceof TextSelection)) return false;
      return state.doc.textBetween(from, to).trim().length > 0;
    },
    [editor],
  );
  const options = useMemo(() => ({ placement: "top" as const, offset: 8 }), []);

  if (!editor) return null;

  const promptForLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link address", previous ?? "https://");
    if (href === null) return;
    if (href.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  };

  // The selected text's current inline size (a multiple of body), and whether
  // its block is a heading — so the size buttons can show what is active.
  const size =
    (editor.getAttributes("fontSize").size as number | undefined) ?? null;
  const isHeadingBlock = editor.isActive("heading");

  // The selected paragraph's alignment, so the matching button shows as active.
  const currentAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;

  // Grow/shrink the selected text's size inline — only the selection changes,
  // not its whole paragraph.
  const stepSize = (direction: 1 | -1) => {
    editor.chain().focus().setFontSize(steppedFontSize(size, direction)).run();
  };

  // Reset the selection to body text: clear any inline size, and if its block is
  // a heading (block-level, so it made the whole paragraph big), turn that back
  // into a paragraph too.
  const normalize = () => {
    const chain = editor.chain().focus();
    if (isHeadingBlock) chain.setParagraph();
    chain.setFontSize(null).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      // Only over a real text selection: skip the empty caret, a node (image)
      // selection, and a selection of nothing but whitespace. (Memoised above.)
      shouldShow={shouldShow}
      options={options}
      // Two rows in a box rather than one long bar. Eighteen controls in a line
      // ran wider than the page they float over, so the bar reached past the
      // paper on both sides and the thing it was formatting was the smaller of
      // the two. Split by what each row acts on — the selected words above, the
      // paragraphs they sit in below — it is about a third the width and the
      // grouping does some of the explaining.
      className="flex w-max max-w-[min(28rem,calc(100vw-2rem))] flex-col gap-1
                 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
    >
      {/* The selected words: their face, their weight and slant, their size.
          Every control on this row is an inline mark — none of them touches a
          character outside the selection. */}
      <div className="flex items-center gap-0.5">
        <FontPicker editor={editor} />

        <Sep />

        <Btn
          label="Bold"
          shortcut="Ctrl+B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </Btn>
        <Btn
          label="Italic"
          shortcut="Ctrl+I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="font-serif italic">I</span>
        </Btn>
        <Btn
          label="Underline"
          shortcut="Ctrl+U"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </Btn>
        <Btn
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </Btn>

        <Sep />

        {/* Size — every one of these changes only the selected text, like the
          marks above, never the whole paragraph. A− / A+ step finely; ¶ resets
          to body size; H1–H3 jump to heading-like sizes. (Real block headings,
          which set a whole line, live in the Aa flyout.) */}
        <Btn label="Smaller text" onClick={() => stepSize(-1)}>
          <span className="text-[0.7rem] leading-none">A−</span>
        </Btn>
        <Btn label="Bigger text" onClick={() => stepSize(1)}>
          <span className="text-sm leading-none">A+</span>
        </Btn>
        <Btn
          label="Normal size"
          active={size === null && !isHeadingBlock}
          onClick={normalize}
        >
          <span className="font-serif text-sm">¶</span>
        </Btn>

        <Sep />

        {(
          [
            [1, 2],
            [2, 1.5],
            [3, 1.3],
          ] as const
        ).map(([level, multiple]) => (
          <Btn
            key={level}
            label={`Heading ${level} size`}
            active={size === multiple}
            onClick={() => editor.chain().focus().setFontSize(multiple).run()}
          >
            <span className="font-serif text-xs">H{level}</span>
          </Btn>
        ))}
      </div>

      {/* The paragraphs the selection sits in. These are block forms — an
          alignment or a list belongs to a whole paragraph, and there is no
          such thing as half a bulleted line — so unlike the row above they
          reach the ends of the paragraphs the selection touches. That is why
          they are on a row of their own rather than mixed in with the marks. */}
      <div className="flex items-center gap-0.5">
        {/* Alignment of the paragraph(s) in the selection. */}
        {ALIGN_OPTIONS.map((option) => (
          <Btn
            key={option.value}
            label={option.label}
            active={currentAlign === option.value}
            onClick={() =>
              editor.chain().focus().setTextAlign(option.value).run()
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d={option.d} />
            </svg>
          </Btn>
        ))}

        <Sep />

        {/* Block forms: a quote (the indented, ruled passage — a letter, an
          epigraph) and lists. Toggling turns them off again. */}
        <Btn
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M4 5.5h9M4 10h12M4 14.5h9" />
            <path d="M16.5 4v5" />
          </svg>
        </Btn>
        <Btn
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M7 5.5h9M7 10h9M7 14.5h9" />
            <circle cx="4" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="4" cy="10" r="0.9" fill="currentColor" stroke="none" />
            <circle
              cx="4"
              cy="14.5"
              r="0.9"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </Btn>
        <Btn
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M8 5.5h8M8 10h8M8 14.5h8" />
            <path d="M3 4.5h1V8M3 8h2" />
            <path d="M3.2 12.4c.2-.6 1.6-.6 1.6.3 0 .6-1.6 1.1-1.6 1.9h1.7" />
          </svg>
        </Btn>

        <Sep />

        <Btn
          label="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <span className="font-mono text-xs">{"</>"}</span>
        </Btn>
        <Btn
          label="Link"
          active={editor.isActive("link")}
          onClick={promptForLink}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" />
            <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" />
          </svg>
        </Btn>
      </div>
    </BubbleMenu>
  );
}

/**
 * The face the selected words are set in.
 *
 * A select rather than a row of buttons: there are six faces and they are told
 * apart by seeing them, not by an icon, so each option is drawn in the face it
 * names. That is also why it sits first — it is the widest thing here and the
 * one a reader looks at rather than scans.
 *
 * "Book" is the empty value, and it means *no mark at all* rather than the
 * book's face written in: a chapter set explicitly to Garamond would keep
 * Garamond after the writer changed the book to Baskerville, which is not what
 * leaving it alone means.
 */
function FontPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current =
    (editor.getAttributes("fontFamily").font as string | null) ?? null;
  const chosen = FONTS.find((f) => f.id === current) ?? null;

  const choose = (id: string | null) => {
    editor.chain().focus().setFontFamily(id).run();
    setOpen(false);
  };

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Font of the selected text"
        title="Font of the selected text"
        className={`flex h-8 cursor-pointer items-center gap-1 rounded-md pr-1
                    pl-2 outline-none transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/60 ${
                      open ? "bg-raised" : "hover:bg-raised"
                    }`}
      >
        {/* "Aa" in the face itself rather than its name spelled out. A name
            takes six times the width and says less — a reader picks a typeface
            by looking at it. */}
        <span
          className="text-sm leading-none text-fg"
          style={{ fontFamily: chosen ? chosen.stack : undefined }}
        >
          Aa
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 text-muted"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          // A list of our own, not a native select. A select cannot be opened
          // without taking focus, and taking focus out of the manuscript is
          // what closes this whole bar — the dropdown would have been torn off
          // its own hinge before anyone could pick from it.
          className="absolute top-full left-0 z-20 mt-1.5 w-44 rounded-lg border
                     border-line bg-panel p-1 shadow-xl"
        >
          <FontOptionRow
            label="Book default"
            active={current === null}
            onSelect={() => choose(null)}
          />
          <span aria-hidden="true" className="my-1 block h-px bg-line" />
          {FONTS.map((font) => (
            <FontOptionRow
              key={font.id}
              label={font.label}
              stack={font.stack}
              active={current === font.id}
              onSelect={() => choose(font.id)}
            />
          ))}
        </div>
      )}
    </span>
  );
}

function FontOptionRow({
  label,
  stack,
  active,
  onSelect,
}: {
  label: string;
  /** Absent for "Book default", which is the absence of a face, not a face. */
  stack?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      style={stack ? { fontFamily: stack } : undefined}
      className={`flex w-full cursor-pointer items-center justify-between
                  rounded-md px-2.5 py-1.5 text-left text-sm outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/50 ${
                    active ? "bg-accent text-white" : "text-fg hover:bg-raised"
                  }`}
    >
      {label}
      {active && (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      )}
    </button>
  );
}
