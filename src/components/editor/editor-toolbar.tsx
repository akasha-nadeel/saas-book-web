"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";

import { ACCEPTED, importImage } from "@/lib/image-import";
import { insertWidthPercent } from "@/lib/editor/image-resize";
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
  PARAGRAPH_STYLES,
  PARA_SPACINGS,
  TEXT_SIZES,
  paragraphStyleOf,
  paragraphStyleSettings,
  type ParagraphStyle,
} from "@/lib/typography";
import type { TextAlignValue } from "@/lib/editor/text-align";
import type { Dictation } from "@/lib/editor/use-dictation";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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

/**
 * Re-render on anything the editor does.
 *
 * Exported for the desk bar's undo and redo, which have to grey out the moment
 * there is nothing left to undo — `editor.can().undo()` is read at render time,
 * so without a subscription the buttons would answer whatever was true when
 * their component last happened to render.
 */
export function useEditorState(editor: Editor | null) {
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

  const show = () => {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

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
        /*
         * **Opened by a press, and only by a press.**
         *
         * It used to open on hover as well, and the two together cancelled each
         * other out in the commonest gesture there is: moving the pointer to
         * the button opened the panel, and the click that follows — which is
         * what everybody does — found it already open and shut it again. The
         * panel flashed and vanished, and pressing again did the same thing,
         * because the pointer never left.
         *
         * Hover was the wrong half to keep even on its own. This is not a
         * tooltip; it is eight form controls laid over the manuscript, and a
         * pointer travelling across the rail on its way somewhere else should
         * not pull them onto the page.
         */
        onClick={() => (open ? setOpen(false) : show())}
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
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOpen(false);
              }
            }}
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              // Sits to the left of the rail. The padding is the gap between
              // the two, kept inside the panel so a press that lands a pixel
              // short of the edge still counts as inside it.
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
  // Five sheets, no hues — the labels say the value each one actually is now,
  // since a swatch marked Cream that renders grey is a lie the eye catches
  // immediately. The stored values keep their old names: they are keys in
  // `prefs`, not words anybody reads, and renaming them would strand the
  // setting of every writer who already picked one.
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

export function ToolRail({
  editor,
  book,
  paper,
  dictation,
}: {
  editor: Editor | null;
  book: Book;
  paper: PaperColor;
  /**
   * Passed in rather than started here, because the chapter list carries a
   * second microphone button. One engine, two controls that agree.
   */
  dictation: Dictation;
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
      // The rail's own spacing, not a tighter one. These three sit in a column
      // with the cover above them and the view toggles below, and a group set
      // closer together than its neighbours reads as a sub-list of one of them.
      className="flex flex-col items-center gap-2"
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
                                    ? "bg-accent text-accent-ink"
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

            {/* The one control that answers "where does a paragraph begin".
                It sets the indent and the spacing together, because they are
                one decision — see paragraphStyleSettings. The two below stay
                for fine tuning, and follow whatever is chosen here. */}
            <Field label="Paragraphs">
              <select
                aria-label="Paragraph style"
                value={paragraphStyleOf(type)}
                onChange={(e) =>
                  setTypography(
                    book.id,
                    paragraphStyleSettings(e.target.value as ParagraphStyle),
                  )
                }
                className={SELECT_CLASS}
              >
                {PARAGRAPH_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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

          {/* Beside the page colour rather than off in the dashboard, because
              they are the same decision asked twice — how bright is this going
              to be — and the writer asking it is sitting in front of the
              manuscript at midnight, not on the shelf screen. */}
          <Field label="Theme">
            <ThemeToggle />
          </Field>
        </div>
      </Flyout>

      {/* No divider between these three. Type, a picture and dictation are one
          thing — putting words and marks on the page — and the rail already
          separates that whole group from the cover above it and the view
          toggles below. Three rules inside a five-icon column made every icon
          look like a section of its own. */}
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
        aria-label="Insert an image"
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
          /*
           * **With a width, because without one it arrives filling the page.**
           *
           * No width means no width *style*, which sounds like "its own size"
           * and is not: the stylesheet caps every picture at `max-width: 100%`,
           * and an imported one has been resized to 1400px on its longest edge
           * against a text column nearer 430. So every photograph landed at
           * exactly the full column and the writer's first act on it was always
           * to shrink it. `insertWidthPercent` leaves a picture that already
           * fits alone — a small logo blown up to half a column would be worse
           * than the problem.
           */
          const width = insertWidthPercent(
            result.stored.width,
            editor.view.dom.clientWidth,
          );
          /*
           * `insertContent` rather than `setImage`, and only because of the
           * types: the base extension declares its `width` as a number of
           * pixels, while ours is a percentage of the column (see
           * `resizable-image.ts`). `setImage` is a one-line wrapper around this
           * call in the extension itself, so nothing is being worked around
           * except its signature.
           */
          /*
           * **A new picture arrives right-aligned with the prose running past
           * it** — Word's "Square" wrap against the right margin, which is
           * where a figure sits in most manuscripts and what a writer inserting
           * one is nearly always about to set by hand.
           *
           * Set here rather than on the node's own `default`, deliberately: the
           * defaults are what `parseHTML` falls back to, so moving them would
           * re-align every picture in every book that carries no `data-align`
           * — including one coming back in through an import. This only decides
           * what a *newly inserted* picture starts as, which is the thing being
           * asked for. The toolbar's own controls still change either.
           *
           * `wrap` is only meaningful beside a left or right alignment (a
           * centred picture has no side for the words to take), so the two are
           * set together and stay in step, exactly as the image toolbar keeps
           * them.
           */
          editor
            .chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: {
                src: result.src,
                align: "right",
                wrap: true,
                ...(width ? { width } : null),
              },
            })
            .run();
        }}
      />

      {/* Dictation. Hidden entirely where the browser has no speech engine,
          rather than shown disabled: a control that can never work on this
          machine is worse than one that is not there. */}
      {dictation.supported && (
        <ToolButton
          label={
            dictation.listening
              ? "Stop dictating"
              : "Dictate — speak and the words are typed"
          }
          active={dictation.listening}
          onClick={() =>
            dictation.listening ? dictation.stop() : dictation.start()
          }
        >
          {/* The microphone gains a ring while it is live, so the state is
              visible from across the room — this is a control a writer turns on
              and then stops looking at. */}
          <span className="relative flex items-center justify-center">
            {dictation.listening && (
              <span
                aria-hidden="true"
                className="absolute -inset-1.5 animate-ping rounded-full bg-danger/40"
              />
            )}
            <Icon>
              <rect x="7.4" y="2.6" width="5.2" height="9.4" rx="2.6" />
              <path d="M4.6 9.6a5.4 5.4 0 0 0 10.8 0" />
              <path d="M10 15v2.4" />
            </Icon>
          </span>
        </ToolButton>
      )}

      {/* Undo and redo used to sit here. They are in the desk bar above the
          sheet now: everything left in this rail acts on the *page* — type,
          alignment, images — where those two act on the document's history,
          which is what the bar already reports with the word count and the save
          status. It also puts them a short reach from the text instead of at
          the far edge of the window. See HistoryControls in chapter-editor. */}

      {problem && (
        <p
          role="status"
          title={problem}
          className="px-1 text-center font-sans text-[0.6rem] leading-tight text-danger"
        >
          Too large
        </p>
      )}
    </div>
  );
}
