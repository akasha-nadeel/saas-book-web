"use client";

import { useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";

/**
 * The formatting toolbar.
 *
 * Every control maps to a command StarterKit already provides — nothing here is
 * decorative. Active state is read through useSyncExternalStore rather than
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
    // A counter rather than a snapshot object: any change re-reads isActive
    // directly off the editor, and a number is trivially stable to compare.
    () => (editor ? editor.state.tr.time : 0),
    () => 0,
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
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2
                  text-sm outline-none transition-colors
                  disabled:cursor-default disabled:opacity-30
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-line" />;

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  useEditorState(editor);

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
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span className="font-serif text-base leading-none">&ldquo;</span>
      </Button>
      <Button
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span className="text-xs">•—</span>
      </Button>
      <Button
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span className="text-xs">1.</span>
      </Button>
      <Button
        label="Scene break"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <span className="tracking-[0.2em] text-xs">***</span>
      </Button>

      <Divider />

      <Button
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <span className="text-sm">↶</span>
      </Button>
      <Button
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <span className="text-sm">↷</span>
      </Button>
    </div>
  );
}
