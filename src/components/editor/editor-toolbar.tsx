"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { PageMenu } from "@/components/editor/page-menu";
import { ACCEPTED, importImage } from "@/lib/image-import";
import type { Book } from "@/lib/library-store";

/**
 * The formatting toolbar.
 *
 * Every control maps to a command StarterKit already provides — nothing here is
 * decorative. Quote, lists and scene break are deliberately absent: each is
 * still reachable by typing ("> ", "- ", "1. ", "---"), so those buttons were
 * duplicating a path that already existed rather than providing one. Active state is read through useSyncExternalStore rather than
 * component state, because the truth lives in the editor: pressing ⌘B or moving
 * the caret into bold text has to light the button just as clicking it does.
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

function Button({
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
      // Active is the same neutral lift as hover, one step stronger — the
      // accent is reserved for actions, not for "this mark is on".
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2
                  text-sm outline-none transition-colors
                  disabled:cursor-default disabled:opacity-30
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

const Divider = () => <span className="mx-1 h-5 w-px bg-line" />;

export function EditorToolbar({
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

  if (!editor) {
    // Reserve the height so the manuscript doesn't jump when the editor mounts.
    return <div className="h-12 border-b border-line" />;
  }

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
      className="flex h-12 shrink-0 flex-wrap items-center gap-0.5 border-b
                 border-line px-3"
    >
      {([1, 2, 3] as const).map((level) => (
        <Button
          key={level}
          label={`Heading ${level}`}
          active={editor.isActive("heading", { level })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level }).run()
          }
        >
          <span className="font-serif">H{level}</span>
        </Button>
      ))}

      <Divider />

      <Button
        label="Bold"
        shortcut="Ctrl+B"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </Button>
      <Button
        label="Italic"
        shortcut="Ctrl+I"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif italic">I</span>
      </Button>
      <Button
        label="Underline"
        shortcut="Ctrl+U"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </Button>
      <Button
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </Button>
      <Button
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-xs">{"</>"}</span>
      </Button>
      <Button
        label="Link"
        active={editor.isActive("link")}
        onClick={promptForLink}
      >
        <span className="text-xs">🔗</span>
      </Button>

      <Divider />

      <Button
        label="Insert image"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
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
          <rect x="2.5" y="4" width="15" height="12" rx="2" />
          <circle cx="7" cy="8.5" r="1.2" />
          <path d="m3.5 14 4-4 3.5 3.5 2.5-2 3 3" />
        </svg>
      </Button>
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

      <Button
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
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
          <path d="M7 7H4V4" />
          <path d="M4.5 7.5a6 6 0 1 1-.8 5" />
        </svg>
      </Button>
      <Button
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
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
          <path d="M13 7h3V4" />
          <path d="M15.5 7.5a6 6 0 1 0 .8 5" />
        </svg>
      </Button>

      {problem && (
        <p
          role="status"
          className="ml-2 max-w-64 truncate font-sans text-xs text-red-400"
          title={problem}
        >
          {problem}
        </p>
      )}

      {/* Pushed to the far end: it describes the page, not the text on it. */}
      <div className="ml-auto">
        <PageMenu book={book} />
      </div>
    </div>
  );
}
