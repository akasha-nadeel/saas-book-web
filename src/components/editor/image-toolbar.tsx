"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
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
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md
                  px-1.5 text-sm outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active ? "bg-accent text-white" : "text-fg hover:bg-raised"
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

  const shouldShow = useCallback(
    () => (editor ? editor.isEditable && imageSelected(editor) : false),
    [editor],
  );
  const options = useMemo(() => ({ placement: "top" as const, offset: 8 }), []);

  if (!editor) return null;

  const attrs = editor.getAttributes("image");
  const align = (attrs.align as string) || "center";
  const width = (attrs.width as string | null) ?? null;

  const setImage = (patch: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("image", patch).run();

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageToolbar"
      shouldShow={shouldShow}
      options={options}
      className="flex items-center gap-0.5 rounded-lg border border-line
                 bg-panel px-1 py-1 shadow-xl"
    >
      {ALIGNS.map((option) => (
        <Btn
          key={option.value}
          label={option.label}
          active={align === option.value}
          onClick={() => setImage({ align: option.value })}
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
