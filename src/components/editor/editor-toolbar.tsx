"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { setPref, type PaperColor, type Prefs } from "@/lib/library-store";

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

/** Swatch previews. The real colours live in globals.css keyed by data-paper;
 *  these only have to look like them in a 16px circle. */
const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Cream", swatch: "#f5f1e8" },
  { value: "sepia", label: "Sepia", swatch: "#f2e7d0" },
  { value: "slate", label: "Slate", swatch: "#1d2732" },
  { value: "black", label: "Black", swatch: "#0a0d11" },
];

function PaperPicker({ paper }: { paper: PaperColor }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = PAPERS.find((p) => p.value === paper) ?? PAPERS[0];

  // Close on an outside click or Escape — the two things every menu owes you.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Page colour: ${current.label}`}
        title="Page colour"
        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-muted
                   outline-none transition-colors hover:bg-raised hover:text-fg
                   focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border border-line"
          style={{ background: current.swatch }}
        />
        <span aria-hidden="true" className="text-[0.6rem]">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 z-20 w-40 rounded-md border
                     border-line bg-panel p-1 shadow-lg"
        >
          {PAPERS.map((p) => (
            <button
              key={p.value}
              role="menuitemradio"
              aria-checked={p.value === paper}
              onClick={() => {
                setPref("paper", p.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5
                          text-left font-sans text-sm outline-none
                          focus-visible:ring-2 focus-visible:ring-accent/60 ${
                            p.value === paper
                              ? "text-accent"
                              : "text-muted hover:bg-raised hover:text-fg"
                          }`}
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full border border-line"
                style={{ background: p.swatch }}
              />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorToolbar({
  editor,
  prefs,
}: {
  editor: Editor | null;
  prefs: Prefs;
}) {
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

      {/* Pushed to the far end: it changes the workspace, not the text. */}
      <div className="ml-auto">
        <PaperPicker paper={prefs.paper} />
      </div>
    </div>
  );
}
