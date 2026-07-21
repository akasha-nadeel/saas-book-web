"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { PageMenu } from "@/components/editor/page-menu";
import { ACCEPTED, importImage } from "@/lib/image-import";
import type { Book } from "@/lib/library-store";

/**
 * The formatting tools, as a column in the right rail.
 *
 * These used to be a row above the manuscript. Moving them into the rail gives
 * the page back that height — on a laptop the toolbar was a noticeable slice of
 * the writing area — and matches the reference, which keeps no permanent
 * toolbar over the page at all.
 *
 * Every control maps to a command StarterKit already provides. Quote, lists and
 * scene break stay absent: each is reachable by typing "> ", "- ", "1. " or
 * "---", so a button would duplicate a path rather than provide one.
 */

function useEditorState(editor: Editor | null) {
  return useSyncExternalStore(
    (onChange) => {
      if (!editor) return () => {};
      // Selection covers caret moves; transaction covers the marks themselves.
      editor.on("selectionUpdate", onChange);
      editor.on("transaction", onChange);
      return () => {
        editor.off("selectionUpdate", onChange);
        editor.off("transaction", onChange);
      };
    },
    // ProseMirror's EditorState is immutable: a new object per transaction,
    // the same reference between them. That is exactly what getSnapshot needs.
    // (Do not reach for `editor.state.tr` here — it *creates* a transaction on
    // every access, so the snapshot never compares equal and React spins.)
    () => editor?.state ?? null,
    () => null,
  );
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  shortcut,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md
                  text-sm outline-none transition-colors
                  disabled:cursor-default disabled:opacity-25
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? "bg-raised text-fg"
                      : "text-muted hover:bg-raised/50 hover:text-fg"
                  }`}
    >
      {children}
    </button>
  );
}

const Divider = () => (
  <span aria-hidden="true" className="my-1 h-px w-6 shrink-0 bg-line" />
);

const Icon = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </svg>
);

export function ToolRail({
  editor,
  book,
}: {
  editor: Editor | null;
  book: Book;
}) {
  useEditorState(editor);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="vertical"
      className="flex flex-col items-center gap-1"
    >
      {([1, 2, 3] as const).map((level) => (
        <ToolButton
          key={level}
          label={`Heading ${level}`}
          active={editor.isActive("heading", { level })}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          <span className="font-serif text-xs">H{level}</span>
        </ToolButton>
      ))}

      <Divider />

      <ToolButton
        label="Bold"
        shortcut="Ctrl+B"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton
        label="Italic"
        shortcut="Ctrl+I"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton
        label="Underline"
        shortcut="Ctrl+U"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolButton>
      <ToolButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-[0.65rem]">{"</>"}</span>
      </ToolButton>
      <ToolButton
        label="Link"
        active={editor.isActive("link")}
        onClick={promptForLink}
      >
        <Icon>
          <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" />
          <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" />
        </Icon>
      </ToolButton>

      <Divider />

      <ToolButton
        label="Insert image"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon>
          <rect x="2.5" y="4" width="15" height="12" rx="2" />
          <circle cx="7" cy="8.5" r="1.2" />
          <path d="m3.5 14 4-4 3.5 3.5 2.5-2 3 3" />
        </Icon>
      </ToolButton>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // Reset immediately, or picking the same file twice does nothing.
          e.target.value = "";
          if (!file) return;

          setBusy(true);
          setProblem(null);
          const result = await importImage(file);
          setBusy(false);

          if (!result.ok) {
            setProblem(result.error);
            return;
          }
          editor.chain().focus().setImage({ src: result.src }).run();
        }}
      />

      <Divider />

      <ToolButton
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Icon>
          <path d="M7 7H4V4" />
          <path d="M4.5 7.5a6 6 0 1 1-.8 5" />
        </Icon>
      </ToolButton>
      <ToolButton
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Icon>
          <path d="M13 7h3V4" />
          <path d="M15.5 7.5a6 6 0 1 0 .8 5" />
        </Icon>
      </ToolButton>

      <Divider />

      <PageMenu book={book} />

      {problem && (
        <p
          role="status"
          title={problem}
          className="px-1 text-center font-sans text-[0.6rem] leading-tight text-red-400"
        >
          Too large
        </p>
      )}
    </div>
  );
}
