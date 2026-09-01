"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";

/**
 * The floating bar over a selected image — a word processor's picture toolbar.
 *
 * When an image is selected it offers what you actually do to a picture: sit it
 * on the left, centre or right of the column; set a quick width (a quarter, a
 * half, full column, or its natural size); and delete it. Fine width control is
 * the drag handles on the image itself (see ImageNodeView); this bar is the
 * common presets under the pointer.
 */

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
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // The same refusal the text bar's buttons carry, and for a sharper
      // reason. Pressing a button moves focus to it, which blurs the
      // manuscript; Tiptap then re-focuses on the next frame *and scrolls the
      // caret into view*, so every press on this bar jumped the page under the
      // picture being worked on. Refused, focus never leaves the prose, the
      // node selection is never disturbed, and the bar is still there for the
      // next press — which is what "align it, then size it" needs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md
                  px-1.5 text-sm outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active ? "bg-accent text-accent-ink" : "text-fg hover:bg-raised"
                  }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />;

/** True when the selection is an image node. */
function imageSelected(editor: Editor): boolean {
  const { selection } = editor.state;
  return (
    selection instanceof NodeSelection && selection.node.type.name === "image"
  );
}

const ALIGNS: { value: string; label: string; d: string }[] = [
  { value: "left", label: "Align left", d: "M3.5 5h13M3.5 9h8M3.5 13h13M3.5 17h8" },
  { value: "center", label: "Align centre", d: "M3.5 5h13M6 9h8M3.5 13h13M6 17h8" },
  { value: "right", label: "Align right", d: "M3.5 5h13M8.5 9h8M3.5 13h13M8.5 17h8" },
];

const WIDTHS: { value: string | null; label: string }[] = [
  { value: "25%", label: "25%" },
  { value: "50%", label: "50%" },
  { value: "100%", label: "Full" },
  { value: null, label: "Fit" },
];

export function ImageToolbar({ editor }: { editor: Editor | null }) {
  useEditorTick(editor);

  /**
   * Whether the pointer is on the bar.
   *
   * A press legitimately blurs the manuscript for a moment, and the focus test
   * below would take the bar away underneath it. The text toolbar keeps the
   * same ref for the same reason, and it is a ref rather than state there and
   * here alike: a render makes new props for the menu plugin, and new props
   * start a loop.
   */
  const pointerOnBar = useRef(false);

  const shouldShow = useCallback(() => {
    if (!editor?.isEditable) return false;
    if (pointerOnBar.current) return true;
    /*
     * **Gone once the writer is working somewhere else.** ProseMirror keeps its
     * selection when focus leaves the editor, so a selected picture stays
     * selected indefinitely and this bar went on floating over the manuscript
     * while somebody typed in the Search panel. Tiptap's own default
     * `shouldShow` tests focus for exactly this reason and passing a custom one
     * replaces it — which is how the check went missing here after the text bar
     * had already been fixed for it.
     */
    if (!editor.isFocused) return false;
    return imageSelected(editor);
  }, [editor]);
  const options = useMemo(() => ({ placement: "top" as const, offset: 8 }), []);

  if (!editor) return null;

  const attrs = editor.getAttributes("image");
  const align = (attrs.align as string) || "center";
  const width = (attrs.width as string | null) ?? null;
  const wrap = attrs.wrap === true;

  const setImage = (patch: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("image", patch).run();

  // Wrapping and alignment are one decision in two controls, so they are kept
  // in step here rather than left to produce a state that cannot be drawn.
  // Text can only run beside a picture that is over on one side; a centred one
  // has no side for the words to take.
  const setAlign = (value: string) =>
    setImage({ align: value, ...(value === "center" ? { wrap: false } : null) });

  const toggleWrap = () =>
    setImage(
      wrap
        ? { wrap: false }
        : // Turning it on from centre has to pick a side. Right is the one a
          // writer means: the picture out of the way, the words leading in.
          { wrap: true, ...(align === "center" ? { align: "right" } : null) },
    );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageToolbar"
      shouldShow={shouldShow}
      options={options}
      // The same lifted card the selection bar wears — the two float over the
      // same page and appeared a radius and a shadow apart.
      className="flex items-center gap-0.5 rounded-xl border border-line/60
                 bg-panel px-1 py-1
                 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.16)]"
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
      {ALIGNS.map((option) => (
        <Btn
          key={option.value}
          label={option.label}
          active={align === option.value}
          onClick={() => setAlign(option.value)}
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

      {WIDTHS.map((option) => (
        <Btn
          key={option.label}
          label={`Width: ${option.label}`}
          active={width === option.value}
          onClick={() => setImage({ width: option.value })}
        >
          <span className="text-xs tabular-nums">{option.label}</span>
        </Btn>
      ))}

      <Sep />

      {/* Word's "Wrap text": the prose runs alongside the picture rather than
          resuming beneath it. */}
      <Btn
        label={wrap ? "Stop text wrapping" : "Wrap text around image"}
        active={wrap}
        onClick={toggleWrap}
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
          {/* Lines of text shortened around a block on the right — the shape
              the setting makes on the page. */}
          <rect x="11.5" y="4" width="5" height="6" rx="0.5" fill="currentColor" stroke="none" />
          <path d="M3.5 5h6M3.5 8h6M3.5 11h13M3.5 14h13" />
        </svg>
      </Btn>

      <Sep />

      <Btn
        label="Delete image"
        onClick={() => editor.chain().focus().deleteSelection().run()}
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
          style={{ color: "var(--color-danger)" }}
        >
          <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10" />
        </svg>
      </Btn>
    </BubbleMenu>
  );
}
