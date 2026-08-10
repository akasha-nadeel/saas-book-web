"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { steppedFontSize } from "@/lib/editor/font-size";
import { previewFont } from "@/lib/editor/font-preview";
import { FONTS } from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";

/**
 * The floating formatting bar that appears over a text selection — the mini
 * toolbar a word processor pops up when you highlight text, so the common
 * formatting is under the pointer instead of across the room in the rail.
 *
 * Two rows, and the split is what each one acts on. **Type** above — the face,
 * the marks, the size steps — every one of them an inline mark that touches no
 * character outside the highlight. **Structure** below: heading sizes,
 * alignment, a quote and the two lists.
 *
 * The heading buttons size the *selection* rather than converting its block,
 * because clicking H1 on one word and watching the whole paragraph grow is the
 * surprise this avoids; real block headings live in the Aa flyout. They sit
 * with structure anyway, because that is what they read as — and because eleven
 * controls against seven left one row half the length of the other.
 *
 * Inline code and links were here and are not any more. Neither belongs in a
 * novel — there is no code in a manuscript, and a link cannot be followed in
 * print — so they were two of eighteen controls taking width from a bar that
 * was already too wide. Both marks remain in the document model, so a chapter
 * imported from HTML keeps them.
 *
 * Built on Tiptap's BubbleMenu, which sits it above the selection and follows
 * it as the page scrolls.
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
      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center
                  justify-center rounded text-xs outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    active ? "bg-accent text-accent-ink" : "text-fg hover:bg-raised"
                  }`}
    >
      {children}
    </button>
  );
}

const Sep = () => (
  <span aria-hidden="true" className="mx-px h-3.5 w-px bg-line" />
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

  /**
   * Whether the pointer is on the bar.
   *
   * The bar kept vanishing the moment a writer pressed anything on it, and
   * refusing the mousedown so the manuscript never blurs was not enough on its
   * own — several paths inside the menu plugin end at `hide()`, and chasing
   * which one fired is chasing a library's private business. This answers the
   * question the plugin is really asking. A writer with the pointer on the bar
   * is using the bar; nothing it does to the document is a reason to take it
   * away from them.
   *
   * A ref rather than state on purpose: it must not re-render the toolbar,
   * because a render here is what makes new props for the menu, and the whole
   * reason the values below are memoised is that new props start a loop.
   */
  const pointerOnBar = useRef(false);

  /**
   * Whether the font menu is open.
   *
   * The same answer as `pointerOnBar` to a second version of the same question,
   * and it is needed for a specific reason: pressing a control on this bar
   * collapses the browser's selection, ProseMirror syncs that collapse into its
   * own state a tick later, and from then on `from === to`. Every other control
   * has finished its work by then. The font menu has not — it is open, waiting
   * to be chosen from — so the moment the pointer wandered off the bar on its
   * way to the list, the whole bar and the list with it disappeared.
   *
   * A ref, like the one above, because a render here makes new props for the
   * menu and new props start a loop.
   */
  const menuOpen = useRef(false);

  // Stable references, or the BubbleMenu re-dispatches an "updateOptions"
  // transaction on every render — which re-renders this toolbar, which makes
  // new props, and so on without end. Memoising breaks that loop.
  const shouldShow = useCallback(
    ({ state, from, to }: { state: EditorState; from: number; to: number }) => {
      if (!editor?.isEditable) return false;
      if (pointerOnBar.current || menuOpen.current) return true;
      if (from === to) return false;
      if (!(state.selection instanceof TextSelection)) return false;
      return state.doc.textBetween(from, to).trim().length > 0;
    },
    [editor],
  );
  const options = useMemo(() => ({ placement: "top" as const, offset: 8 }), []);

  if (!editor) return null;

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
      className="flex w-max max-w-[min(21rem,calc(100vw-2rem))] flex-col gap-px
                 rounded-lg border border-line bg-panel p-0.5 shadow-xl"
      // Entering and leaving, rather than pressing and releasing: a writer who
      // presses a button and drags a little before letting go is still on the
      // bar, and so is one moving between two of its buttons.
      onMouseEnter={() => {
        pointerOnBar.current = true;
      }}
      onMouseLeave={() => {
        pointerOnBar.current = false;
      }}
    >
      {/* The selected words: their face, their weight and slant, their size.
          Every control on this row is an inline mark — none of them touches a
          character outside the selection. */}
      <div className="flex items-center gap-0.5">
        <FontPicker editor={editor} onOpenChange={(v) => (menuOpen.current = v)} />

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
          <span className="text-[0.62rem] leading-none">A−</span>
        </Btn>
        <Btn label="Bigger text" onClick={() => stepSize(1)}>
          <span className="text-xs leading-none">A+</span>
        </Btn>
        <Btn
          label="Normal size"
          active={size === null && !isHeadingBlock}
          onClick={normalize}
        >
          <span className="font-serif text-xs">¶</span>
        </Btn>
      </div>

      {/* The paragraphs the selection sits in. These are block forms — an
          alignment or a list belongs to a whole paragraph, and there is no
          such thing as half a bulleted line — so unlike the row above they
          reach the ends of the paragraphs the selection touches. That is why
          they are on a row of their own rather than mixed in with the marks. */}
      <div className="flex items-center gap-0.5">
        {/* Heading sizes. Inline like the row above — they size the selection
            rather than converting its block — but they read as structure, and
            they balance the two rows: eleven controls against seven left one
            row half the length of the other. */}
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

        <Sep />

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
              className="h-3 w-3"
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
            className="h-3 w-3"
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
            className="h-3 w-3"
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
            className="h-3 w-3"
          >
            <path d="M8 5.5h8M8 10h8M8 14.5h8" />
            <path d="M3 4.5h1V8M3 8h2" />
            <path d="M3.2 12.4c.2-.6 1.6-.6 1.6.3 0 .6-1.6 1.1-1.6 1.9h1.7" />
          </svg>
        </Btn>
      </div>
    </BubbleMenu>
  );
}

/**
 * The face the selected words are set in.
 *
 * Three things about it, and each of them is how the tools writers already
 * use behave.
 *
 * **It names the face it is on.** It read "Aa", drawn in the current face, on
 * the reasoning that a name takes six times the width and a reader picks a
 * typeface by looking at it. Half right: a *list* of faces has to be drawn in
 * its faces, and the closed control has to say which one you are on — two
 * letters cannot, because at 12px the difference between Garamond and Palatino
 * is a serif or two, and "Aa" in the book's own face and "Aa" in Georgia look
 * the same to anybody not comparing them side by side. Google Docs, Word and
 * every type tool print the name. So does this, drawn in that face, which is
 * both answers at once.
 *
 * **Hovering an option sets the words in it** — Word's Live Preview, and the
 * reason it has survived twenty years is that a typeface is the one choice
 * nobody can make from a name. It is a decoration rather than the real mark, so
 * nothing is written, nothing enters undo and nothing reaches autosave; see
 * `font-preview.ts`.
 *
 * **The range is remembered when the menu opens**, and this is the bug fix
 * rather than a nicety. Every other control on this bar acts on the *first*
 * click, so the selection is still there when the command runs. This one takes
 * two — open, then choose — and the selection does not survive the gap: the
 * bar's `preventDefault` keeps focus in the prose but the caret still collapses
 * on the press, and by the time the second click arrives there is nothing
 * highlighted to set a face on. So the command ran against an empty cursor and
 * a writer watched the font not change. Holding the range and putting it back
 * (`setTextSelection`) makes the second click as good as the first — and gives
 * the preview above something stable to draw on.
 *
 * "Book" is the empty value, and it means *no mark at all* rather than the
 * book's face written in: a chapter set explicitly to Garamond would keep
 * Garamond after the writer changed the book to Baskerville, which is not what
 * leaving it alone means.
 */
/**
 * Roughly how tall the list wants to be — seven rows, a rule and the padding.
 *
 * A measured height would need the menu rendered before it can be placed, which
 * is a frame of it in the wrong position. An approximation is enough for what
 * is being asked.
 */
const MENU_HEIGHT = 270;

/** The gap between the trigger and the list, and from the list to the edge. */
const MENU_GAP = 8;

function FontPicker({
  editor,
  onOpenChange,
}: {
  editor: Editor;
  /** Tells the bar to stay put while the list is up — see `menuOpen`. */
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    (editor.getAttributes("fontFamily").font as string | null) ?? null;
  const chosen = FONTS.find((f) => f.id === current) ?? null;

  /** The words this menu is about, taken the moment it opens. See above. */
  const range = useRef<{ from: number; to: number } | null>(null);
  /**
   * Whether to put a collapsed selection back — see the guard below.
   *
   * **A ref set inside the click handler, not state read by an effect**, and
   * that is the whole difference between this working and not. An effect is
   * armed when React commits, and the collapse it exists to undo can fire
   * before that commit: the browser changes the selection, ProseMirror's DOM
   * observer notices, and `selectionUpdate` has come and gone while the
   * subscription is still queued. Sometimes it won the race and sometimes it
   * did not, which is exactly how this looked — the bar staying put on one
   * press and jumping to a caret on the next.
   */
  const guarding = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /**
   * Where the list is drawn — always above the trigger, in window coordinates.
   *
   * **It only ever opens upwards, and it is allowed over the chrome.** This bar
   * floats *above* the selected words, so a list dropping downwards lands on
   * the very sentence being previewed — and looking at their own prose in each
   * face is the entire reason a writer opened it. Flipping to whichever side
   * had more room was worse than useless: near the top of the page it chose
   * down, covering the text, which is the one thing it must not do. So it goes
   * up, and where the page runs out it goes over the manuscript's desk bar
   * rather than turning round. A menu over some chrome for a moment costs
   * nothing; a menu over the words being chosen for costs the whole feature.
   *
   * That is why it is **portalled and fixed** rather than absolutely positioned
   * inside the bar. It has to paint above the desk bar, and a `z-index` on a
   * descendant of the editor cannot escape the stacking contexts between it and
   * the top — which is exactly what put its first rows behind that bar before.
   * The same reason the Aa flyout in the rail is portalled.
   */
  const [place, setPlace] = useState<{
    left: number;
    bottom: number;
    maxHeight: number;
  } | null>(null);

  const shut = () => {
    // Disarmed first: everything after this may move the selection, and the
    // guard must not treat the writer's next click as a collapse to undo.
    guarding.current = false;
    previewFont(editor, null, null);
    onOpenChange(false);
    setOpen(false);
  };

  const toggle = () => {
    if (open) {
      shut();
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to) return;
    // Both set synchronously, inside the press, so the guard is already live
    // when the collapse this press causes arrives. See `guarding`.
    range.current = { from, to };
    guarding.current = true;

    /*
     * Pinned above the trigger, in window coordinates, capped to the window.
     *
     * `bottom` rather than `top`, so the list grows upwards from a fixed foot
     * — the row nearest the trigger stays where it is however many faces there
     * are, which is what makes the first one predictable to hit.
     */
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    setPlace({
      left: box.left,
      bottom: window.innerHeight - box.top + MENU_GAP,
      maxHeight: Math.min(MENU_HEIGHT, Math.max(0, box.top - MENU_GAP * 2)),
    });

    previewFont(editor, range.current, null);
    onOpenChange(true);
    setOpen(true);
  };

  const choose = (id: string | null) => {
    // The chain below sets the selection deliberately; the guard would see
    // nothing to undo, but it has no business running during a real edit.
    guarding.current = false;
    previewFont(editor, null, null);
    const chain = editor.chain().focus();
    // Put the selection back before acting on it. Without this the command
    // lands on whatever the two clicks left behind, which is a collapsed
    // cursor — see the note above.
    if (range.current) chain.setTextSelection(range.current);
    chain.setFontFamily(id).run();
    // The selection is genuinely back after that chain, so the bar can look
    // after itself again.
    onOpenChange(false);
    setOpen(false);
  };

  /*
   * Three ways it shuts, and all three were missing.
   *
   * **Escape**, like every other menu in the app.
   *
   * **A press anywhere but the list.** Clicking the page left it standing —
   * and worse, left the *bar* standing, because the bar is told to stay put
   * while the list is open (`menuOpen`). So a writer who clicked away to carry
   * on reading was followed around by a toolbar and a font menu for something
   * they had stopped selecting. The trigger is excluded or the press that
   * closes it would be followed by the click that opens it again.
   *
   * **A new selection.** The open flag is component state and the toolbar is
   * not remounted between selections, so the list stayed open — and reappeared
   * over every phrase highlighted afterwards, having been asked for once. A
   * menu is about the words it was opened on; select different words and it is
   * about nothing. This is the one Word gets right by having no state to leak:
   * its mini toolbar is rebuilt per selection.
   */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      shut();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      shut();
    };

    /* A fixed position taken from a rect goes stale the moment the page moves,
       so the list shuts on a resize or on a scroll outside itself. Scrolling
       *inside* the list must not dismiss it — its own position has not moved. */
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      shut();
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", shut);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", shut);
      document.removeEventListener("scroll", onScroll, true);
    };
    // `shut` closes over `editor` and refs, all stable for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editor]);

  /*
   * **Put the collapse back before it is ever painted.**
   *
   * The press that opens this menu collapses the browser's selection, and
   * ProseMirror syncs that collapse into its own state. The bubble is anchored
   * to the selection, so a selection that becomes a caret takes the bar with
   * it — and a caret sits at the *start* of what was highlighted, which is why
   * the whole toolbar jumped away the instant the list opened, and why the
   * words it was about stopped looking selected.
   *
   * Two things had to be true to fix it, and the first attempt only had one.
   * It runs **inside the selection event**, so the correcting transaction lands
   * in the same task as the collapse and the position the bar would have taken
   * is never laid out — a `requestAnimationFrame` fixed where the bar ended up
   * and not the lurch, because that is a whole frame drawn in the wrong place.
   * And it is **subscribed for the life of the component**, gated by a ref
   * rather than mounted when the menu opens: an effect is armed at commit time
   * and the collapse can beat it there.
   *
   * Only a *collapse* is undone. A writer deliberately highlighting something
   * else is a real selection, and the effect below closes the menu on it —
   * which is also what stops this recursing: the restored selection is not
   * collapsed, so the next event through here does nothing.
   */
  useEffect(() => {
    const onSelection = () => {
      if (!guarding.current) return;
      const at = range.current;
      if (!at || editor.isDestroyed) return;
      const { from, to } = editor.state.selection;
      if (from === to) editor.commands.setTextSelection(at);
    };
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor]);

  // Highlighting something else closes it. `selection` is read from the tick
  // above, so this runs whenever ProseMirror's selection moves — including the
  // restore above, which lands back on the remembered range and so reads as no
  // change at all.
  const { from: selFrom, to: selTo } = editor.state.selection;
  useEffect(() => {
    if (!open) return;
    const at = range.current;
    if (!at) return;
    // The collapse this menu causes is not a new selection — it is the old one
    // on its way to being put back, and closing on it would shut the list on
    // the frame it opened.
    if (selFrom === selTo) return;
    if (selFrom !== at.from || selTo !== at.to) shut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selFrom, selTo]);

  // A preview left behind by an unmount would be a stray face on the page with
  // no menu to explain it.
  useEffect(() => {
    return () => {
      previewFont(editor, null, null);
    };
  }, [editor]);

  const label = chosen?.label ?? "Book";

  return (
    <span className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Font of the selected text — ${chosen?.label ?? "the book’s own"}`}
        title={`Font of the selected text — ${chosen?.label ?? "the book’s own"}`}
        className={`flex h-6 cursor-pointer items-center gap-0.5 rounded pr-0.5
                    pl-2 outline-none transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/60 ${
                      open ? "bg-raised" : "hover:bg-raised"
                    }`}
      >
        {/* The name, set in its own face.

            **A fixed width, not a maximum.** Sized to its content the control
            grew and shrank with the name — "Book" to "Baskerville" is half an
            inch — so the whole bar changed width and, being centred over the
            selection, slid sideways every time a face was chosen. It is also
            what keeps the row from outgrowing the paragraph it is formatting,
            which is why it was capped in the first place. */}
        <span
          className="w-[5.25rem] truncate text-left text-xs leading-none text-fg"
          style={{ fontFamily: chosen ? chosen.stack : undefined }}
        >
          {label}
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

      {open &&
        place &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            // A list of our own, not a native select. A select cannot be opened
            // without taking focus, and taking focus out of the manuscript is
            // what closes this whole bar — the dropdown would have been torn
            // off its own hinge before anyone could pick from it.
            //
            // Back to the highlight with no face on it, not to nothing: the
            // menu is still open and still about those words. Cleared on the
            // list rather than per row, so travelling between two rows never
            // flashes the original face in between.
            onMouseLeave={() => previewFont(editor, range.current, null)}
            style={{
              position: "fixed",
              left: place.left,
              bottom: place.bottom,
              maxHeight: place.maxHeight,
            }}
            // Above the manuscript's desk bar, and under the app's dialogs.
            className="scroll-slim z-[45] w-44 overflow-y-auto rounded-lg
                       border border-line bg-panel p-1 shadow-xl"
          >
            <FontOptionRow
              label="Book default"
              active={current === null}
              onSelect={() => choose(null)}
              // The book's own face is what the words already look like with no
              // mark on them, so previewing it is previewing nothing — which is
              // exactly right, and is how a writer sees what removing the face
              // would do while some other face is applied.
              onPreview={() =>
                previewFont(editor, range.current, bookFontCss())
              }
            />
            <span aria-hidden="true" className="my-1 block h-px bg-line" />
            {FONTS.map((font) => (
              <FontOptionRow
                key={font.id}
                label={font.label}
                stack={font.stack}
                active={current === font.id}
                onSelect={() => choose(font.id)}
                onPreview={() => previewFont(editor, range.current, font.stack)}
              />
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}

/**
 * The book's own face, as CSS, for previewing "Book default".
 *
 * Read off the manuscript container rather than passed down, because that is
 * where `typography.ts` puts it — one place, whatever the book is set to. The
 * fallback matches the CSS's own (`.manuscript .tiptap`), so a preview before
 * any book has overridden it shows the same thing the page does.
 */
function bookFontCss(): string {
  if (typeof document === "undefined") return "var(--font-serif)";
  const surface = document.querySelector(".manuscript .tiptap");
  const value = surface
    ? getComputedStyle(surface).fontFamily
    : "";
  return value || "var(--font-serif)";
}

function FontOptionRow({
  label,
  stack,
  active,
  onSelect,
  onPreview,
}: {
  label: string;
  /** Absent for "Book default", which is the absence of a face, not a face. */
  stack?: string;
  active: boolean;
  onSelect: () => void;
  /** Set the selected words in this face without applying it. */
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      // Pointer rather than mouse, so a pen or a touch drag previews too; and
      // on focus, so a writer arrowing through the list with the keyboard gets
      // the same preview a pointer does.
      onPointerEnter={onPreview}
      onFocus={onPreview}
      style={stack ? { fontFamily: stack } : undefined}
      className={`flex w-full cursor-pointer items-center justify-between
                  rounded-md px-2.5 py-1.5 text-left text-sm outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/50 ${
                    active ? "bg-accent text-accent-ink" : "text-fg hover:bg-raised"
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
          className="h-3 w-3"
        >
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      )}
    </button>
  );
}
