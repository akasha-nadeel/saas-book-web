"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { PromptDialog } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { applyFormattingCommand } from "@/lib/editor/formatting-commands";
import type { TextAlignValue } from "@/lib/editor/text-align";
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
import { normalizeHref } from "@/lib/editor/link-url";
import { useEditorState } from "./editor-toolbar";

const ALIGNMENTS: { value: TextAlignValue; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
];

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

/* Filled rather than outlined, like every field in the pass. `text-base` and
   `h-11` stay: this sheet is thumbs on glass, and 16px is also what stops iOS
   zooming the page when a field takes focus. */
const SELECT =
  "h-11 w-full rounded-[10px] bg-raised px-3 text-base text-fg outline-none focus:ring-2 focus:ring-accent/50";

function MarkButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      /* **The filled active state stays, and it is the one place in the pass
         that keeps a full accent fill.** Elsewhere selected is a tint, because
         it marks *where you are*; a B/I/U toggle marks *what the next
         character will be*, on a touch sheet with no pointer to hover with. A
         tint is not enough to answer that at a glance. */
      className={`flex h-11 min-w-11 flex-1 items-center justify-center rounded-[10px] text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active
          ? "bg-accent text-accent-ink"
          : "bg-raised text-fg hover:bg-raised/70"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-bold tracking-wide text-muted uppercase sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3">
      <span>{label}</span>
      <span className="min-w-0 normal-case">{children}</span>
    </label>
  );
}

/** Full formatting surface shared by every overlay presentation. */
export function FormatControls({
  editor,
  book,
  paper,
  runCommand,
}: {
  editor: Editor;
  book: Book;
  paper: PaperColor;
  /** Restores a saved selection before running the command on mobile. */
  runCommand?: (command: (editor: Editor) => void) => void;
}) {
  useEditorState(editor);
  const type = typographyOf(book);
  const [linkAsked, setLinkAsked] = useState<string | null>(null);
  const run = (command: (liveEditor: Editor) => void) =>
    runCommand ? runCommand(command) : command(editor);
  const command = (value: Parameters<typeof applyFormattingCommand>[1]) =>
    run((live) => {
      applyFormattingCommand(live, value);
    });

  const ownAlign = (editor.getAttributes("paragraph").textAlign ??
    editor.getAttributes("heading").textAlign) as TextAlignValue | undefined;
  const activeAlign = ownAlign ?? type.align;
  const existingLink = editor.getAttributes("link").href as string | undefined;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section>
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Style
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <MarkButton
            label="Normal text"
            active={editor.isActive("paragraph")}
            onClick={() => command({ type: "paragraph" })}
          >
            ¶
          </MarkButton>
          {([1, 2, 3] as const).map((level) => (
            <MarkButton
              key={level}
              label={`Heading ${level}`}
              active={editor.isActive("heading", { level })}
              onClick={() => command({ type: "heading", level })}
            >
              H{level}
            </MarkButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Marks and lists
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <MarkButton label="Bold" active={editor.isActive("bold")} onClick={() => command({ type: "bold" })}>
            <strong>B</strong>
          </MarkButton>
          <MarkButton label="Italic" active={editor.isActive("italic")} onClick={() => command({ type: "italic" })}>
            <em>I</em>
          </MarkButton>
          <MarkButton label="Underline" active={editor.isActive("underline")} onClick={() => command({ type: "underline" })}>
            <span className="underline">U</span>
          </MarkButton>
          <MarkButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => command({ type: "strike" })}>
            <span className="line-through">S</span>
          </MarkButton>
          <MarkButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => command({ type: "bulletList" })}>
            • List
          </MarkButton>
          <MarkButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => command({ type: "orderedList" })}>
            1. List
          </MarkButton>
          <MarkButton
            label={existingLink ? "Edit link" : "Add link"}
            active={editor.isActive("link")}
            onClick={() => setLinkAsked(existingLink ?? "https://")}
          >
            Link
          </MarkButton>
          <MarkButton label="Inline code" active={editor.isActive("code")} onClick={() => command({ type: "code" })}>
            {"</>"}
          </MarkButton>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
          Type and spacing
        </h3>
        <Field label="Font">
          <select
            aria-label="Font"
            value={type.font}
            onChange={(event) => setTypography(book.id, { font: event.target.value })}
            className={SELECT}
          >
            {FONTS.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
                {font.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size">
          <select
            aria-label="Text size in points"
            value={String(type.sizePt)}
            onChange={(event) => setTypography(book.id, { sizePt: Number(event.target.value) })}
            className={SELECT}
          >
            {TEXT_SIZES.map((size) => (
              <option key={size} value={size}>{size} pt</option>
            ))}
          </select>
        </Field>
        <Field label="Line spacing">
          <select
            aria-label="Line spacing"
            value={String(type.leading)}
            onChange={(event) => setTypography(book.id, { leading: Number(event.target.value) })}
            className={SELECT}
          >
            {LEADINGS.map((leading) => (
              <option key={leading.value} value={leading.value}>{leading.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Paragraphs">
          <select
            aria-label="Paragraph style"
            value={paragraphStyleOf(type)}
            onChange={(event) =>
              setTypography(
                book.id,
                paragraphStyleSettings(event.target.value as ParagraphStyle),
              )
            }
            className={SELECT}
          >
            {PARAGRAPH_STYLES.map((style) => (
              <option key={style.value} value={style.value}>{style.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Indent">
          <select
            aria-label="First-line indent"
            value={String(type.indentIn)}
            onChange={(event) => setTypography(book.id, { indentIn: Number(event.target.value) })}
            className={SELECT}
          >
            {INDENTS.map((indent) => (
              <option key={indent.value} value={indent.value}>{indent.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Para space">
          <select
            aria-label="Paragraph spacing"
            value={String(type.paraSpacingPt)}
            onChange={(event) => setTypography(book.id, { paraSpacingPt: Number(event.target.value) })}
            className={SELECT}
          >
            {PARA_SPACINGS.map((spacing) => (
              <option key={spacing.value} value={spacing.value}>{spacing.label}</option>
            ))}
          </select>
        </Field>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Alignment
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ALIGNMENTS.map((alignment) => (
            <MarkButton
              key={alignment.value}
              label={`Align ${alignment.label.toLowerCase()}`}
              active={activeAlign === alignment.value}
              onClick={() => command({ type: "align", value: alignment.value })}
            >
              {alignment.label}
            </MarkButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Paper and app
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="flex min-w-0 gap-2">
            <legend className="sr-only">Page colour</legend>
            {PAPERS.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={paper === choice.value}
                aria-label={choice.label}
                onClick={() => setPref("paper", choice.value)}
                className={`h-11 w-11 rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  paper === choice.value ? "border-accent" : "border-line"
                }`}
                style={{ background: choice.swatch }}
              />
            ))}
          </fieldset>
          <ThemeToggle />
        </div>
      </section>

      {linkAsked !== null && (
        <PromptDialog
          title={existingLink ? "Edit this link" : "Add a link"}
          label="Link address"
          initial={linkAsked}
          confirmLabel={existingLink ? "Update" : "Add link"}
          placeholder="https://"
          onRemove={
            existingLink
              ? () => run((live) => live.chain().focus().unsetLink().run())
              : undefined
          }
          removeLabel="Remove link"
          /* A bare domain is a link too — see `normalizeHref`, which the bar
             over a selection runs its input through as well, so every box in
             the app stores the same thing. */
          onSubmit={(typed) => {
            const href = normalizeHref(typed);
            if (href) run((live) => live.chain().focus().setLink({ href }).run());
          }}
          onClose={() => setLinkAsked(null)}
        />
      )}
    </div>
  );
}
