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
import { posToDOMRect } from "@tiptap/core";
import { fontSizeOptions, fontSizePt } from "@/lib/editor/font-size";
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

export function SelectionToolbar({
  editor,
  bodyPt,
}: {
  editor: Editor | null;
  /** The book's body size in points, so the size list can speak in points. */
  bodyPt: number;
}) {
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

  /**
   * The rectangle this bar is anchored to, held still while it is being used.
   *
   * **The bar is positioned from the selection, and a press changes the
   * selection's shape.** Bold sets Garamond's roman as its bold, which is 9%
   * wider; italic swaps in a face 16% narrower. So the rect the bar is centred
   * over grew or shrank under the writer's own pointer and the bar slid
   * sideways — out from under the button they were about to press next, which
   * is how one press of B becomes a press of I.
   *
   * Word's mini toolbar does not move while you work in it, and this is that:
   * the anchor is frozen the moment the pointer arrives (or a list opens), so
   * every press after it computes the same position, and released when the
   * writer leaves. Frozen at *the rect it already has*, so freezing is itself
   * invisible — nothing moves at the moment of pinning, only afterwards.
   *
   * A ref, like the two above, for the same reason: a render here makes new
   * props for the menu and new props start a loop.
   */
  const pinnedRect = useRef<DOMRect | null>(null);

  /**
   * The words this bar is about, kept for the whole of its life.
   *
   * **This is what makes a second press work**, and for most of this bar's life
   * only the font list had it. The problem is stated a few lines up and was
   * believed to end there: a press collapses the browser's selection and
   * ProseMirror syncs that collapse a tick later, and every other control "has
   * finished its work by then". True of the *first* press. The second one runs
   * against `from === to` — so Bold lands, and the Italic after it sets a stored
   * mark for the next character typed instead of touching the words still
   * highlighted under the bar. Nothing says so, because the pointer being on the
   * bar holds `shouldShow` true, so the bar goes on floating over a caret.
   *
   * The bar is only ever raised over a real selection, so the last non-empty one
   * *is* its subject. Captured below rather than at any one press, which is what
   * lets every control share it.
   */
  const range = useRef<{ from: number; to: number } | null>(null);

  /**
   * Remember the selection, and put it back the moment a press collapses it.
   *
   * **Both halves are one subscription because they are one question**, and the
   * order inside it is the guard: a collapsed selection is never captured, so
   * the collapse can never overwrite the range it is about to be corrected
   * with. The restore is only attempted while the pointer is on the bar or a
   * list is open — a collapse then can only have come from the bar, since the
   * bar is what the pointer is over. A writer clicking into their prose is not
   * over it, and their caret is left exactly where they put it.
   *
   * It runs **inside the event**, not in a frame after it, for the reason the
   * font picker's own note gives at length: the bubble is anchored to the
   * selection, so a frame with the collapsed position in it is a frame with the
   * whole bar drawn somewhere else.
   *
   * It cannot recurse — what it puts back is not collapsed, so the event that
   * follows takes the capture branch and only re-records the same range. And it
   * is inert on a browser that does not collapse the selection at all, since
   * there is then nothing for it to match.
   */
  useEffect(() => {
    if (!editor) return;
    const onSelection = () => {
      if (editor.isDestroyed) return;
      const selection = editor.state.selection;
      // A picture is a NodeSelection and belongs to the image toolbar; neither
      // remembering nor restoring it is this bar's business.
      if (!(selection instanceof TextSelection)) return;
      const { from, to } = selection;
      if (from !== to) {
        range.current = { from, to };
        // A new selection made anywhere but on the bar releases the held
        // anchor, so a pin can never survive into the next thing highlighted.
        // Inline rather than through `releasePosition`, which is declared past
        // this effect's early return.
        if (!pointerOnBar.current && !menuOpen.current) pinnedRect.current = null;
        return;
      }
      if (!pointerOnBar.current && !menuOpen.current) return;
      const at = range.current;
      if (!at) return;
      editor.commands.setTextSelection(at);
    };
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor]);

  // Stable references, or the BubbleMenu re-dispatches an "updateOptions"
  // transaction on every render — which re-renders this toolbar, which makes
  // new props, and so on without end. Memoising breaks that loop.
  const shouldShow = useCallback(
    ({ state, from, to }: { state: EditorState; from: number; to: number }) => {
      if (!editor?.isEditable) return false;
      if (pointerOnBar.current || menuOpen.current) return true;
      /*
       * **Gone once the writer is working somewhere else.**
       *
       * ProseMirror keeps its selection when focus leaves the editor, so
       * `from !== to` stays true indefinitely — and this bar went on floating
       * over the manuscript, covering two lines of it, while somebody typed in
       * the Search panel. Observed surviving three panel switches.
       *
       * Tiptap's own default `shouldShow` tests `view.hasFocus()` for exactly
       * this reason; passing a custom one replaces that default outright,
       * which is how the check went missing. It has to sit *below* the two
       * refs above, because pressing a control on this bar legitimately blurs
       * the editor for a moment and those are what hold the bar open through
       * it — the font list especially, which stays up waiting to be chosen
       * from.
       */
      if (!editor.isFocused) return false;
      if (from === to) return false;
      if (!(state.selection instanceof TextSelection)) return false;
      return state.doc.textBetween(from, to).trim().length > 0;
    },
    [editor],
  );
  const options = useMemo(() => ({ placement: "top" as const, offset: 8 }), []);

  // Memoised with the other two, or the BubbleMenu re-dispatches "updateOptions"
  // on every render. Returning null is how the plugin is told to fall back to
  // its own `posToDOMRect(view, from, to)` — see its `virtualElement` getter.
  const getReferencedVirtualElement = useCallback(() => {
    const rect = pinnedRect.current;
    if (!rect) return null;
    return { getBoundingClientRect: () => rect, getClientRects: () => [rect] };
  }, []);

  if (!editor) return null;

  // The selected text's current inline size (a multiple of body), and whether
  // its block is a heading — so the size buttons can show what is active.
  const size =
    (editor.getAttributes("fontSize").size as number | undefined) ?? null;
  const isHeadingBlock = editor.isActive("heading");

  // The selected paragraph's alignment, so the matching button shows as active.
  const currentAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;

  /**
   * Run a command on the words this bar is about.
   *
   * The second half of the fix above, and the half that covers the presses the
   * first cannot see. A writer who tabs to a button and presses Enter never
   * moves a pointer, so `pointerOnBar` is false and the guard stays quiet; the
   * same is true of a touchscreen, which has no hover at all. Putting the range
   * back here as well costs a comparison and makes the keyboard and the finger
   * behave like the mouse.
   *
   * Only ever restores a *collapsed* selection. A live one is either the words
   * the writer means or a new selection they have just made, and stamping the
   * remembered range over that would be this bar overruling them.
   */
  /** Hold the bar where it is; see `pinnedRect`. Idempotent, so the second
   *  reason to pin (a list opening over a pointer already on the bar) does not
   *  re-capture a rect that has since moved. */
  const pinPosition = () => {
    if (pinnedRect.current) return;
    const { from, to } = editor.state.selection;
    pinnedRect.current = posToDOMRect(editor.view, from, to);
  };

  /** Let it follow the selection again, once neither reason to hold it stands. */
  const releasePosition = () => {
    if (pointerOnBar.current || menuOpen.current) return;
    pinnedRect.current = null;
  };

  const apply = (run: (chain: ReturnType<Editor["chain"]>) => unknown) => {
    const chain = editor.chain().focus();
    const at = range.current;
    const { from, to } = editor.state.selection;
    if (at && from === to) chain.setTextSelection(at);
    run(chain);
    chain.run();
  };

  // Reset the selection to body text: clear any inline size, and if its block is
  // a heading (block-level, so it made the whole paragraph big), turn that back
  // into a paragraph too.
  const normalize = () =>
    apply((chain) => {
      if (isHeadingBlock) chain.setParagraph();
      chain.setFontSize(null);
    });

  return (
    <BubbleMenu
      editor={editor}
      // Only over a real text selection: skip the empty caret, a node (image)
      // selection, and a selection of nothing but whitespace. (Memoised above.)
      shouldShow={shouldShow}
      options={options}
      getReferencedVirtualElement={getReferencedVirtualElement}
      // Two rows in a box rather than one long bar. Eighteen controls in a line
      // ran wider than the page they float over, so the bar reached past the
      // paper on both sides and the thing it was formatting was the smaller of
      // the two. Split by what each row acts on — the selected words above, the
      // paragraphs they sit in below — it is about a third the width and the
      // grouping does some of the explaining.
      className="selection-toolbar flex w-max max-w-[min(21rem,calc(100vw-2rem))] flex-col gap-px
                 rounded-lg border border-line bg-panel p-0.5 shadow-xl"
      // Entering and leaving, rather than pressing and releasing: a writer who
      // presses a button and drags a little before letting go is still on the
      // bar, and so is one moving between two of its buttons.
      onMouseEnter={() => {
        pointerOnBar.current = true;
        pinPosition();
      }}
      onMouseLeave={() => {
        pointerOnBar.current = false;
        releasePosition();
      }}
    >
      {/* The selected words: their face, their weight and slant, their size.
          Every control on this row is an inline mark — none of them touches a
          character outside the selection. */}
      <div className="flex items-center gap-0.5">
        <FontPicker
          editor={editor}
          range={range}
          onOpenChange={(v) => {
            menuOpen.current = v;
            if (v) pinPosition();
            else releasePosition();
          }}
        />

        <Sep />

        <Btn
          label="Bold"
          shortcut="Ctrl+B"
          active={editor.isActive("bold")}
          onClick={() => apply((chain) => chain.toggleBold())}
        >
          <span className="font-bold">B</span>
        </Btn>
        <Btn
          label="Italic"
          shortcut="Ctrl+I"
          active={editor.isActive("italic")}
          onClick={() => apply((chain) => chain.toggleItalic())}
        >
          <span className="font-serif italic">I</span>
        </Btn>
        <Btn
          label="Underline"
          shortcut="Ctrl+U"
          active={editor.isActive("underline")}
          onClick={() => apply((chain) => chain.toggleUnderline())}
        >
          <span className="underline">U</span>
        </Btn>
        <Btn
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => apply((chain) => chain.toggleStrike())}
        >
          <span className="line-through">S</span>
        </Btn>

        <Sep />

        {/* Size — the selected words only, like the marks above, never the whole
          paragraph. It reads and writes points, against the book's own body
          size; what is stored is a multiple of that size, so a run keeps its
          proportion when the book's type changes. ¶ puts the selection back to
          body text. (Real block headings, which set a whole line, live in the Aa
          flyout.) */}
        <SizePicker
          editor={editor}
          bodyPt={bodyPt}
          size={size}
          apply={apply}
          onOpenChange={(v) => {
            menuOpen.current = v;
            if (v) pinPosition();
            else releasePosition();
          }}
        />
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
            onClick={() => apply((chain) => chain.setFontSize(multiple))}
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
            onClick={() => apply((chain) => chain.setTextAlign(option.value))}
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
          onClick={() => apply((chain) => chain.toggleBlockquote())}
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
          onClick={() => apply((chain) => chain.toggleBulletList())}
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
          onClick={() => apply((chain) => chain.toggleOrderedList())}
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
 * Roughly how tall a list wants to be — seven or eight rows and the padding.
 *
 * A measured height would need the menu rendered before it can be placed, which
 * is a frame of it in the wrong position. An approximation is enough for what
 * is being asked.
 */
const MENU_HEIGHT = 270;

/** The gap between the trigger and the list, and from the list to the edge. */
const MENU_GAP = 8;

/** The words a menu was opened about, for as long as it is open. */
type Range = { from: number; to: number };

/**
 * A list that drops out of this bar — the machinery both pickers need.
 *
 * There are two of these now, the face and the size, and every hard-won detail
 * below applies equally to both: where the list is drawn, that it may never
 * drop downwards, that it is portalled rather than positioned in place, and the
 * four ways it shuts. One copy, or the second picker is the first one's bugs
 * again with a year between them.
 *
 * **It only ever opens upwards, and it is allowed over the chrome.** This bar
 * floats *above* the selected words, so a list dropping downwards lands on the
 * very sentence being set — and looking at their own prose is the entire reason
 * a writer opened it. Flipping to whichever side had more room was worse than
 * useless: near the top of the page it chose down, covering the text, which is
 * the one thing it must not do. So it goes up, and where the page runs out it
 * goes over the manuscript's desk bar rather than turning round. A menu over
 * some chrome for a moment costs nothing; a menu over the words being chosen
 * for costs the whole feature.
 *
 * That is why it is **portalled and fixed** rather than absolutely positioned
 * inside the bar. It has to paint above the desk bar, and a `z-index` on a
 * descendant of the editor cannot escape the stacking contexts between it and
 * the top — which is exactly what put its first rows behind that bar before.
 * The same reason the Aa flyout in the rail is portalled.
 */
function BarMenu({
  editor,
  title,
  trigger,
  onOpenChange,
  onOpened,
  onShut,
  onMouseLeave,
  children,
}: {
  editor: Editor;
  /** The trigger's accessible name, which is also its tooltip. */
  title: string;
  /** What the closed control shows. */
  trigger: React.ReactNode;
  /** Tells the bar to stay put while the list is up — see `menuOpen`. */
  onOpenChange: (open: boolean) => void;
  /** After the list has opened on `range`. The font picker previews here. */
  onOpened?: (range: Range | null) => void;
  /** Before it closes, however it closes. */
  onShut?: () => void;
  onMouseLeave?: () => void;
  /** The rows. `close` shuts the list without applying anything. */
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * The selection this list was opened about.
   *
   * Distinct from the bar's shared `range`, and it has to be: that one follows
   * the writer and is updated on every new selection, which is exactly what the
   * "has the selection changed" test below cannot be built on — compared
   * against a value that moves with the thing it is measuring, nothing has ever
   * changed. This is a snapshot and stays put until the list is opened again.
   */
  const openedOn = useRef<Range | null>(null);

  /** Where the list is drawn, in window coordinates. See the note above. */
  const [place, setPlace] = useState<{
    left: number;
    bottom: number;
    maxHeight: number;
  } | null>(null);

  const shut = useCallback(() => {
    onShut?.();
    onOpenChange(false);
    setOpen(false);
  }, [onShut, onOpenChange]);

  const toggle = () => {
    if (open) {
      shut();
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to) return;
    openedOn.current = { from, to };

    /*
     * Pinned above the trigger, in window coordinates, capped to the window.
     *
     * `bottom` rather than `top`, so the list grows upwards from a fixed foot —
     * the row nearest the trigger stays where it is however many rows there
     * are, which is what makes the first one predictable to hit.
     */
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    setPlace({
      left: box.left,
      bottom: window.innerHeight - box.top + MENU_GAP,
      maxHeight: Math.min(MENU_HEIGHT, Math.max(0, box.top - MENU_GAP * 2)),
    });

    onOpenChange(true);
    setOpen(true);
    onOpened?.(openedOn.current);
  };

  /*
   * Three ways it shuts, and all three were once missing.
   *
   * **Escape**, like every other menu in the app.
   *
   * **A press anywhere but the list.** Clicking the page left it standing —
   * and worse, left the *bar* standing, because the bar is told to stay put
   * while a list is open (`menuOpen`). So a writer who clicked away to carry
   * on reading was followed around by a toolbar and a menu for something they
   * had stopped selecting. The trigger is excluded or the press that closes it
   * would be followed by the click that opens it again.
   *
   * **A resize or an outside scroll**, because a fixed position taken from a
   * rect goes stale the moment the page moves. Scrolling *inside* the list must
   * not dismiss it — its own position has not moved.
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
  }, [open, shut]);

  /*
   * The fourth way: **a new selection**.
   *
   * The open flag is component state and this toolbar is not remounted between
   * selections, so a list stayed open — and reappeared over every phrase
   * highlighted afterwards, having been asked for once. A menu is about the
   * words it was opened on; select different words and it is about nothing.
   * Word gets this right by having no state to leak: its mini toolbar is
   * rebuilt per selection.
   *
   * A *collapsed* selection is not a new one — it is the press that opened this
   * list, on its way to being put back by the bar's guard, and closing on it
   * would shut the list on the frame it opened.
   */
  const { from: selFrom, to: selTo } = editor.state.selection;
  useEffect(() => {
    if (!open) return;
    const at = openedOn.current;
    if (!at) return;
    if (selFrom === selTo) return;
    if (selFrom !== at.from || selTo !== at.to) shut();
  }, [open, selFrom, selTo, shut]);

  return (
    <span className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        // The whole reason this bar survives being used — see `Btn`.
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className={`flex h-6 cursor-pointer items-center gap-0.5 rounded pr-0.5
                    pl-2 outline-none transition-colors focus-visible:ring-2
                    focus-visible:ring-accent/60 ${
                      open ? "bg-raised" : "hover:bg-raised"
                    }`}
      >
        {trigger}
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
            onMouseLeave={onMouseLeave}
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
            {children(shut)}
          </div>,
          document.body,
        )}
    </span>
  );
}

function FontPicker({
  editor,
  range,
  onOpenChange,
}: {
  editor: Editor;
  /** The bar's shared record of the words being formatted. */
  range: React.RefObject<Range | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const current =
    (editor.getAttributes("fontFamily").font as string | null) ?? null;
  const chosen = FONTS.find((f) => f.id === current) ?? null;

  const choose = (id: string | null, close: () => void) => {
    previewFont(editor, null, null);
    const chain = editor.chain().focus();
    // Put the selection back before acting on it. Without this the command
    // lands on whatever the two clicks left behind, which is a collapsed
    // cursor — see the note above the component.
    if (range.current) chain.setTextSelection(range.current);
    chain.setFontFamily(id).run();
    close();
  };

  // A preview left behind by an unmount would be a stray face on the page with
  // no menu to explain it.
  useEffect(() => {
    return () => {
      previewFont(editor, null, null);
    };
  }, [editor]);

  const name = chosen?.label ?? "the book’s own";

  return (
    <BarMenu
      editor={editor}
      title={`Font of the selected text — ${name}`}
      onOpenChange={onOpenChange}
      onOpened={(at) => previewFont(editor, at, null)}
      onShut={() => previewFont(editor, null, null)}
      // Back to the highlight with no face on it, not to nothing: the menu is
      // still open and still about those words. Cleared on the list rather than
      // per row, so travelling between two rows never flashes the original face
      // in between.
      onMouseLeave={() => previewFont(editor, range.current, null)}
      trigger={
        /* The name, set in its own face.

           **A fixed width, not a maximum.** Sized to its content the control
           grew and shrank with the name — "Book" to "Baskerville" is half an
           inch — so the whole bar changed width and, being centred over the
           selection, slid sideways every time a face was chosen. It is also
           what keeps the row from outgrowing the paragraph it is formatting,
           which is why it was capped in the first place. */
        <span
          className="w-[5.25rem] truncate text-left text-xs leading-none text-fg"
          style={{ fontFamily: chosen ? chosen.stack : undefined }}
        >
          {chosen?.label ?? "Book"}
        </span>
      }
    >
      {(close) => (
        <>
          <OptionRow
            label="Book default"
            active={current === null}
            onSelect={() => choose(null, close)}
            // The book's own face is what the words already look like with no
            // mark on them, so previewing it is previewing nothing — which is
            // exactly right, and is how a writer sees what removing the face
            // would do while some other face is applied.
            onPreview={() => previewFont(editor, range.current, bookFontCss())}
          />
          <span aria-hidden="true" className="my-1 block h-px bg-line" />
          {FONTS.map((font) => (
            <OptionRow
              key={font.id}
              label={font.label}
              stack={font.stack}
              active={current === font.id}
              onSelect={() => choose(font.id, close)}
              onPreview={() => previewFont(editor, range.current, font.stack)}
            />
          ))}
        </>
      )}
    </BarMenu>
  );
}

/**
 * The size of the selected words, in points.
 *
 * **It reads and writes points and stores a multiple**, which is the one thing
 * to understand about it. A writer thinks in points, and so does every other
 * type control in this app; the document stores a ratio against the book's body
 * size, so a run keeps its proportion when the book's own size moves. See
 * `fontSizeOptions`.
 *
 * It replaced an A− / A+ pair, which it strictly supersedes: those walked the
 * same scale one notch a press, with nothing on screen saying what size the
 * selection was or what the next press would give.
 *
 * **No hover preview here, where the face has one.** Live Preview earns its
 * keep on a typeface because nobody can pick one from a name; "14 pt" is not a
 * name, it is the answer.
 */
function SizePicker({
  editor,
  bodyPt,
  size,
  apply,
  onOpenChange,
}: {
  editor: Editor;
  /** The book's body size, which every label is worked out against. */
  bodyPt: number;
  /** The selection's stored multiple, or null for the body size. */
  size: number | null;
  apply: (run: (chain: ReturnType<Editor["chain"]>) => unknown) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const options = fontSizeOptions(bodyPt);

  const choose = (multiple: number | null, close: () => void) => {
    apply((chain) => chain.setFontSize(multiple));
    close();
  };

  /*
   * The trigger prints the size the selection **really is**, not the nearest
   * row of the list. A chapter can carry a multiple this scale does not offer —
   * an import, or one written before the scale existed — and rounding that into
   * an offered size on the very control that reports it would be the screen
   * quietly misreporting the document. No row shows a tick in that case, which
   * is the honest answer: none of them is what the selection is set to.
   */
  const shown = fontSizePt(bodyPt, size);

  return (
    <BarMenu
      editor={editor}
      title={`Size of the selected text — ${shown} point`}
      onOpenChange={onOpenChange}
      trigger={
        // Fixed width for the reason the face's name is, and more sharply: this
        // one changes on nearly every press, and a bar centred on the selection
        // slides sideways whenever it resizes.
        <span className="w-[2.5rem] text-left text-xs leading-none text-fg tabular-nums">
          {shown} pt
        </span>
      }
    >
      {(close) =>
        options.map((option) => (
          <OptionRow
            key={option.pt}
            label={`${option.pt} pt`}
            // The one row that is the book's own size, said so rather than left
            // to be worked out — it is the row that clears the mark, and a
            // writer choosing it is choosing "leave this alone".
            note={option.body ? "Body" : undefined}
            active={size === option.multiple}
            onSelect={() => choose(option.multiple, close)}
          />
        ))
      }
    </BarMenu>
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

/** One row of either list. */
function OptionRow({
  label,
  note,
  stack,
  active,
  onSelect,
  onPreview,
}: {
  label: string;
  /** A quiet word after the label — "Body" on the size that clears the mark. */
  note?: string;
  /** A face to draw the row in. Absent on a row that is not about a face. */
  stack?: string;
  active: boolean;
  onSelect: () => void;
  /** Set the selected words this way without applying it. Faces only. */
  onPreview?: () => void;
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
      <span className="flex items-baseline gap-1.5">
        {label}
        {note && (
          <span className={active ? "text-xs opacity-80" : "text-xs text-muted"}>
            {note}
          </span>
        )}
      </span>
      {active && (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 shrink-0"
        >
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      )}
    </button>
  );
}
