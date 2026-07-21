"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { PageMenu } from "@/components/editor/page-menu";
import { ACCEPTED, importImage } from "@/lib/image-import";
import { setPref, type Book, type PaperColor } from "@/lib/library-store";

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
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg
                  text-base outline-none transition-colors
                  disabled:cursor-default disabled:opacity-40
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
  <span aria-hidden="true" className="my-1 h-px w-7 shrink-0 bg-line" />
);

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    {children}
  </svg>
);

/**
 * A rail button whose tools fly out beside it.
 *
 * Rendered through a portal, which is not decoration: the rail scrolls, and an
 * overflow container clips absolutely positioned children. Anchored inside it
 * the panel was drawn but cut off at the rail's edge — visible as a sliver and
 * nothing more. A portal escapes the clip; the cost is positioning by hand from
 * the trigger's rect.
 *
 * Opens on hover, but not only on hover: a hover-only menu cannot be reached
 * from a keyboard and does not exist at all on a touch screen, so click and
 * focus open it too, and Escape closes it.
 */
function Flyout({
  label,
  children,
  trigger,
}: {
  label: string;
  children: React.ReactNode;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };
  const hideSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Long enough to cross the gap, short enough not to linger.
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // The panel is portalled, so it is not inside the trigger's subtree —
      // both have to be checked or clicking a tool would dismiss the menu.
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    // A fixed position taken from a rect goes stale the moment anything moves.
    const onMove = () => setOpen(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex h-11 w-11 shrink-0 items-center justify-center
                    rounded-lg outline-none transition-colors
                    focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      open
                        ? "bg-raised text-fg"
                        : "text-muted hover:bg-raised/50 hover:text-fg"
                    }`}
      >
        {trigger}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOpen(false);
              }
            }}
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              // Sits to the left of the rail, with the gap as padding so the
              // pointer never crosses dead space on its way over.
              transform: "translateX(-100%)",
              paddingRight: 8,
            }}
            className="z-50"
          >
            <div className="flex flex-col gap-1 rounded-md border border-line bg-panel p-2 shadow-xl">
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Cream", swatch: "#f5f1e8" },
  { value: "sepia", label: "Sepia", swatch: "#f2e7d0" },
  { value: "slate", label: "Slate", swatch: "#1d2732" },
  { value: "black", label: "Black", swatch: "#0a0d11" },
];

export function ToolRail({
  editor,
  book,
  paper,
}: {
  editor: Editor | null;
  book: Book;
  paper: PaperColor;
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
      <Flyout
        label="Text formatting"
        trigger={<span className="font-serif text-lg">Aa</span>}
      >
        <div className="flex gap-1">
          {([1, 2, 3] as const).map((level) => (
            <ToolButton
              key={level}
              label={`Heading ${level}`}
              active={editor.isActive("heading", { level })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level }).run()
              }
            >
              <span className="font-serif text-sm">H{level}</span>
            </ToolButton>
          ))}
        </div>

        <span aria-hidden="true" className="h-px w-full bg-line" />

        <div className="flex gap-1">
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
            <span className="font-mono text-xs">{"</>"}</span>
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
        </div>

        <span aria-hidden="true" className="h-px w-full bg-line" />

        <div
          role="radiogroup"
          aria-label="Page colour"
          className="flex items-center justify-center gap-1.5 py-1"
        >
          {PAPERS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={p.value === paper}
              aria-label={p.label}
              title={`Page colour: ${p.label}`}
              onClick={() => setPref("paper", p.value)}
              className={`h-5 w-5 rounded-full border-2 outline-none
                          transition-colors focus-visible:ring-2
                          focus-visible:ring-accent/60 ${
                            p.value === paper
                              ? "border-accent"
                              : "border-line hover:border-muted"
                          }`}
              style={{ background: p.swatch }}
            />
          ))}
        </div>
      </Flyout>

      <Divider />

      <ToolButton
        label="Insert image"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon>
          <rect x="2.6" y="3.8" width="14.8" height="12.4" rx="2" />
          <circle cx="7.1" cy="8.2" r="1.4" />
          <path d="m2.9 14.4 3.9-3.9a1.2 1.2 0 0 1 1.7 0l2.6 2.6 1.7-1.7a1.2 1.2 0 0 1 1.7 0l2.6 2.6" />
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
          <path d="M3.2 4.4v3.9h3.9" />
          <path d="M3.9 8.3a6.4 6.4 0 1 1-.5 5.3" />
        </Icon>
      </ToolButton>
      <ToolButton
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Icon>
          <path d="M16.8 4.4v3.9h-3.9" />
          <path d="M16.1 8.3a6.4 6.4 0 1 0 .5 5.3" />
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
