"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { PageMenu } from "@/components/editor/page-menu";
import { ACCEPTED, importImage } from "@/lib/image-import";
import {
  setPref,
  setTypography,
  typographyOf,
  type Book,
  type PaperColor,
} from "@/lib/library-store";
import {
  FONTS,
  INDENTS,
  LEADINGS,
  PARA_SPACINGS,
  TEXT_SIZES,
} from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";

/** The four alignments, each with a small icon of ruled lines. */
const ALIGN_OPTIONS: {
  value: TextAlignValue;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "left", label: "Align left", icon: alignIcon("M3.5 5h13M3.5 9h8M3.5 13h13M3.5 17h8") },
  { value: "center", label: "Align centre", icon: alignIcon("M3.5 5h13M6 9h8M3.5 13h13M6 17h8") },
  { value: "right", label: "Align right", icon: alignIcon("M3.5 5h13M8.5 9h8M3.5 13h13M8.5 17h8") },
  { value: "justify", label: "Justify", icon: alignIcon("M3.5 5h13M3.5 9h13M3.5 13h13M3.5 17h13") },
];

function alignIcon(d: string) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d={d} />
    </svg>
  );
}

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

/** A labelled row in the Aa flyout: a name on the left, its control on the
 *  right. Every typography control is one row, so the panel stays a single
 *  narrow column with no sideways overflow. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[5.5rem] shrink-0 font-sans text-[0.62rem] tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const SELECT_CLASS = `w-full cursor-pointer truncate rounded-md border
  border-line bg-raised px-2 py-1.5 font-sans text-xs text-fg outline-none
  transition-colors hover:border-muted focus-visible:ring-2
  focus-visible:ring-accent/60`;

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
    // A fixed position taken from a rect goes stale the moment the page moves,
    // so the panel closes on resize or an outside scroll. But the panel itself
    // scrolls now, and scrolling *inside* it must not dismiss it — its fixed
    // position does not change, so those events are ignored.
    const onResize = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
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

  // The book's body typography — changed live from the Aa flyout below.
  const type = typographyOf(book);

  if (!editor) return null;

  // The selected block's own alignment, or the book default when it has none —
  // so the alignment buttons show what the paragraph is actually set to.
  const blockAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;
  const activeAlign: TextAlignValue = blockAlign ?? type.align;

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
        label="Text & type"
        trigger={<span className="font-serif text-lg">Aa</span>}
      >
        <div className="flex max-h-[78vh] w-64 flex-col gap-2 overflow-x-hidden overflow-y-auto pr-0.5">
          <div className="flex gap-1">
            {/* Normal text — turns a heading back into body prose. Its own
                button so a paragraph accidentally made a heading is one click to
                fix, rather than guessing which H toggles it off. */}
            <ToolButton
              label="Normal text"
              active={editor.isActive("paragraph")}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <span className="font-serif text-sm">¶</span>
            </ToolButton>
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

          {/* Body typography — the whole manuscript's face, size and spacing,
              each a compact dropdown so the panel stays one narrow column. These
              write to the book, so the writing surface and the export change
              together. Page geometry stays in the ▤ menu. */}
          <div className="flex flex-col gap-2">
            <Field label="Font">
              <select
                aria-label="Font"
                value={type.font}
                onChange={(e) =>
                  setTypography(book.id, { font: e.target.value })
                }
                className={SELECT_CLASS}
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Size (pt)">
              <select
                aria-label="Text size in points"
                value={String(type.sizePt)}
                onChange={(e) =>
                  setTypography(book.id, { sizePt: Number(e.target.value) })
                }
                className={SELECT_CLASS}
              >
                {TEXT_SIZES.map((s) => (
                  <option key={s} value={String(s)}>
                    {s} pt
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Alignment">
              {/* Per paragraph, applied to the selection — not the whole book.
                  The book's default (type.align) shows as active on a paragraph
                  that has no alignment of its own. */}
              <div className="flex gap-1">
                {ALIGN_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={activeAlign === option.value}
                    title={option.label}
                    onClick={() =>
                      editor.chain().focus().setTextAlign(option.value).run()
                    }
                    className={`flex h-8 flex-1 items-center justify-center
                                rounded-md outline-none transition-colors
                                focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                  activeAlign === option.value
                                    ? "bg-accent text-white"
                                    : "text-fg hover:bg-raised"
                                }`}
                  >
                    {option.icon}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Line spacing">
              <select
                aria-label="Line spacing"
                value={String(type.leading)}
                onChange={(e) =>
                  setTypography(book.id, { leading: Number(e.target.value) })
                }
                className={SELECT_CLASS}
              >
                {LEADINGS.map((l) => (
                  <option key={l.value} value={String(l.value)}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Indent">
              <select
                aria-label="First-line indent"
                value={String(type.indentIn)}
                onChange={(e) =>
                  setTypography(book.id, { indentIn: Number(e.target.value) })
                }
                className={SELECT_CLASS}
              >
                {INDENTS.map((i) => (
                  <option key={i.value} value={String(i.value)}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Para space">
              <select
                aria-label="Paragraph spacing"
                value={String(type.paraSpacingPt)}
                onChange={(e) =>
                  setTypography(book.id, {
                    paraSpacingPt: Number(e.target.value),
                  })
                }
                className={SELECT_CLASS}
              >
                {PARA_SPACINGS.map((s) => (
                  <option key={s.value} value={String(s.value)}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <span aria-hidden="true" className="h-px w-full bg-line" />

          <Field label="Page colour">
            <div
              role="radiogroup"
              aria-label="Page colour"
              className="flex items-center gap-1.5"
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
          </Field>
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
