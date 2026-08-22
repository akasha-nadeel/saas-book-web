"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "./editor-toolbar";

function DockButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-35 ${
        active ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg"
      }`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {children}
      </span>
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
      >
        ✦
      </DockButton>
      <DockButton label="More" active={moreOpen} onClick={onMore}>
        •••
      </DockButton>
    </nav>
  );
}
