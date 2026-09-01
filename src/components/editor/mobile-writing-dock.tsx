"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "./editor-toolbar";
import {
  RailMark,
  useMarkHandle,
  type MarkName,
} from "@/components/editor/rail-mark";

function DockButton({
  label,
  onClick,
  disabled,
  active,
  mark,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  mark?: MarkName;
  children?: React.ReactNode;
}) {
  const handle = useMarkHandle();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onMouseEnter={handle.onEnter}
      onMouseLeave={handle.onLeave}
      className={`group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-35 ${
        /* `accent/10`, the one answer to selected the rails, the panels and the
           dashboard sidebar all give now. It was `raised`, which is also this
           button's own hover — so on a phone, where there is no pointer, the
           selected control and a just-tapped one were the same colour. */
        active
          ? "bg-accent/10 text-fg"
          : "text-muted hover:bg-raised hover:text-fg"
      }`}
    >
      {mark ? (
        // Smaller here than on the rails: the dock gives each control a label
        // under its icon and five of them a phone's width.
        <RailMark mark={mark} markRef={handle.ref} size={22} />
      ) : (
        <span aria-hidden="true" className="text-base leading-none">
          {children}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

export function MobileWritingDock({
  editor,
  formatOpen,
  assistantOpen,
  moreOpen,
  onFormat,
  onAssistant,
  onMore,
}: {
  editor: Editor | null;
  formatOpen: boolean;
  assistantOpen: boolean;
  moreOpen: boolean;
  onFormat: () => void;
  onAssistant: () => void;
  onMore: () => void;
}) {
  useEditorState(editor);
  const live = editor && !editor.isDestroyed ? editor : null;

  return (
    <nav
      aria-label="Writing tools"
      className="oc-writing-dock fixed inset-x-0 bottom-(--oc-keyboard-inset) z-[35] hidden h-[calc(var(--oc-writing-dock-height)+var(--oc-safe-bottom))] items-stretch gap-1 border-t border-line bg-panel/96 px-[max(0.5rem,var(--oc-safe-left))] pt-1 pb-(--oc-safe-bottom) backdrop-blur"
    >
      <DockButton
        label="Undo"
        disabled={!live?.can().undo()}
        onClick={() => live?.chain().focus().undo().run()}
      >
        ↶
      </DockButton>
      <DockButton
        label="Redo"
        disabled={!live?.can().redo()}
        onClick={() => live?.chain().focus().redo().run()}
      >
        ↷
      </DockButton>
      <DockButton label="Format" active={formatOpen} onClick={onFormat}>
        Aa
      </DockButton>
      <DockButton
        label="AI"
        active={assistantOpen}
        onClick={onAssistant}
        mark="assistant"
      />
      <DockButton label="More" active={moreOpen} onClick={onMore}>
        •••
      </DockButton>
    </nav>
  );
}
