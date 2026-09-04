"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { Picker } from "@/components/ui/picker";
import { PromptDialog } from "@/components/ui/dialog";
import { SwitchTrack } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
import type { Dictation } from "@/lib/editor/use-dictation";
import { useEditorState } from "@/components/editor/editor-toolbar";

/**
 * Everything that decides how the page looks, and what can be put on it.
 *
 * **It is a panel because the rail had stopped meaning one thing.** These
 * controls arrived from the right-hand rail when that rail was folded into the
 * left one, and they brought a second kind of button with them: every other
 * item in that column opens the panel beside it, and these opened flyouts and
 * dialogs over the page. Nothing about a glyph tells a writer which they are
 * about to get. Behind one tab, the rail is a single promise again — press
 * this, and the panel shows you that.
 *
 * **It also retired a piece of geometry nobody should have had to keep.** The
 * type controls used to live in a portalled `Flyout` that positioned itself to
 * the *left* of its trigger, for no reason except that the trigger used to be
 * on the right edge of the window. A panel has an edge of its own and needs
 * none of that.
 *
 * The four groups are the four questions a writer is actually asking: what does
 * the text look like, what does the paper look like, what else goes on it, and
 * how does the page behave while I write.
 */

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

export function ToolsPanel({
  book,
  editor,
  paper,
  typewriter,
  dictation,
  canWrite,
}: {
  book: Book;
  editor?: Editor | null;
  paper: PaperColor;
  typewriter: boolean;
  dictation: Dictation;
  /** A viewer gets to *look* at the settings and change none of them. */
  canWrite: boolean;
}) {
  useEditorState(editor ?? null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [linkAsked, setLinkAsked] = useState<string | null>(null);

  const type = typographyOf(book);
  const live = editor && !editor.isDestroyed ? editor : null;
  const existingLink = live?.getAttributes("link").href as string | undefined;

  /** The book's own typography, which every one of these writes straight to. */
  const setType = (patch: Parameters<typeof setTypography>[1]) =>
    setTypography(book.id, patch);

  const addImage = async (file: File) => {
    if (!live) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await importImage(file);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }

      /* The rail's own insert, moved rather than rewritten — the reasoning for
         every attribute is in `editor-toolbar.tsx` and none of it changed by
         being pressed from a panel instead of a rail. In short: a width,
         because without one every photograph lands filling the column; right
         alignment with wrap, because that is where a figure sits in a
         manuscript; and `insertContent` rather than `setImage`, because the
         base extension types its width as pixels where ours is a percentage. */
      const width = insertWidthPercent(
        result.stored.width,
        live.view.dom.clientWidth,
      );
      live
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scroll-slim flex-1 overflow-y-auto px-3 py-4">
      <SectionHeader>Type</SectionHeader>
      <ListGroup tone="lifted">
        <ListRow
          title="Font"
          trailing={
            <Picker
              label="Font"
              value={type.font}
              onChange={(font) => setType({ font })}
              width={220}
              align="end"
              options={FONTS.map((f) => ({
                value: f.id,
                label: f.label,
                style: { fontFamily: f.stack },
              }))}
            />
          }
        />
        <ListRow
          title="Size"
          trailing={
            <Picker
              label="Size"
              value={String(type.sizePt)}
              onChange={(size) => setType({ sizePt: Number(size) })}
              width={140}
              align="end"
              options={TEXT_SIZES.map((s) => ({
                value: String(s),
                label: `${s} pt`,
              }))}
            />
          }
        />
        <ListRow
          title="Line spacing"
          trailing={
            <Picker
              label="Line spacing"
              value={String(type.leading)}
              onChange={(v) => setType({ leading: Number(v) })}
              width={180}
              align="end"
              options={LEADINGS.map((l) => ({
                value: String(l.value),
                label: l.label,
              }))}
            />
          }
        />
        <ListRow
          title="Paragraphs"
          trailing={
            <Picker
              label="Paragraph style"
              value={paragraphStyleOf(type)}
              onChange={(v) => setType(paragraphStyleSettings(v as ParagraphStyle))}
              width={200}
              align="end"
              options={PARAGRAPH_STYLES.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            />
          }
        />
        <ListRow
          title="First-line indent"
          trailing={
            <Picker
              label="First-line indent"
              value={String(type.indentIn)}
              onChange={(v) => setType({ indentIn: Number(v) })}
              width={180}
              align="end"
              options={INDENTS.map((i) => ({
                value: String(i.value),
                label: i.label,
              }))}
            />
          }
        />
        <ListRow
          title="Space between"
          trailing={
            <Picker
              label="Paragraph spacing"
              value={String(type.paraSpacingPt)}
              onChange={(v) => setType({ paraSpacingPt: Number(v) })}
              width={180}
              align="end"
              options={PARA_SPACINGS.map((s) => ({
                value: String(s.value),
                label: s.label,
              }))}
            />
          }
        />
      </ListGroup>

      <SectionHeader className="mt-5">The page</SectionHeader>
      <ListGroup tone="lifted">
        <ListRow
          title="Paper"
          trailing={
            /* Swatches rather than a picker: the choice is a colour, and five
               of them read faster as five colours than as five words. */
            <div
              role="radiogroup"
              aria-label="Page colour"
              className="flex items-center gap-1.5"
            >
              {PAPERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={paper === option.value}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setPref("paper", option.value)}
                  className={`h-5 w-5 rounded-full border transition-transform
                              outline-none hover:scale-110
                              focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                paper === option.value
                                  ? "border-accent ring-2 ring-accent/40"
                                  : "border-line"
                              }`}
                  style={{ background: option.swatch }}
                />
              ))}
            </div>
          }
        />
        {/* Beside the paper rather than off in the dashboard, because they are
            the same decision asked twice — how bright is this going to be — and
            the writer asking it is in front of the manuscript at midnight. */}
        <ListRow title="Theme" trailing={<ThemeToggle />} />
      </ListGroup>

      {canWrite && (
        <>
          <SectionHeader className="mt-5">Put on the page</SectionHeader>
          <ListGroup tone="lifted">
            <ListRow
              title="A picture"
              detail={busy ? "Reading the file…" : "Placed where the caret is"}
              disabled={busy || !live}
              onClick={() => fileRef.current?.click()}
            />
            <ListRow
              title={existingLink ? "Edit the link" : "A link"}
              detail="On the words you have selected"
              disabled={!live}
              onClick={() => setLinkAsked(existingLink ?? "https://")}
            />
          </ListGroup>
          {problem && (
            <p role="alert" className="mt-2 px-1 font-sans text-xs text-danger">
              {problem}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void addImage(file);
            }}
          />
        </>
      )}

      <SectionHeader className="mt-5">While you write</SectionHeader>
      <ListGroup tone="lifted">
        {/* Hidden outright where it cannot work — the engine is the browser's
            own, Chrome and Edge only, and a control that could never work on
            this machine is not drawn at all rather than drawn dead. */}
        {dictation.supported && (
          <ListRow
            title="Dictation"
            detail={
              dictation.listening ? "Listening" : "Speak and the words are typed"
            }
            onClick={() =>
              dictation.listening ? dictation.stop() : dictation.start()
            }
            trailing={<SwitchTrack on={dictation.listening} />}
          />
        )}
        <ListRow
          title="Typewriter scrolling"
          detail="Hold the caret at a fixed height"
          onClick={() => setPref("typewriter", !typewriter)}
          trailing={<SwitchTrack on={typewriter} />}
        />
      </ListGroup>

      {linkAsked !== null && live && (
        <PromptDialog
          title={existingLink ? "Edit link" : "Add link"}
          label="Address"
          initial={linkAsked}
          confirmLabel={existingLink ? "Update" : "Add link"}
          placeholder="https://"
          removeLabel="Remove link"
          onRemove={
            existingLink
              ? () => live.chain().focus().unsetLink().run()
              : undefined
          }
          onSubmit={(href) => live.chain().focus().setLink({ href }).run()}
          onClose={() => setLinkAsked(null)}
        />
      )}
    </div>
  );
}
