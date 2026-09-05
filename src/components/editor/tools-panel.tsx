"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { Picker } from "@/components/ui/picker";
import { PromptDialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RailMark, useMarkHandle } from "@/components/editor/rail-mark";
import type { MarkName } from "@/components/editor/rail-mark";
import { ACCEPTED, importImage } from "@/lib/image-import";
import { insertWidthPercent } from "@/lib/editor/image-resize";
import { normalizeHref } from "@/lib/editor/link-url";
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
 * **A strip of tools, not a sheet of settings**, and the difference is what a
 * writer opens it for. It began as a full-height panel and then as a 320px
 * card of labelled rows — twelve of them, four groups, the whole of the type
 * and the page and the picture and the dictation laid out at once. That is a
 * settings screen, and it is the wrong shape for something opened to change
 * one thing: everything you are not doing is in front of you, and the card is
 * wide enough to cover the writing while you do it.
 *
 * So: a narrow column of tools at the rail's edge, each one either doing its
 * job on the press or opening a small panel beside it with *only* its own
 * rows. Nothing but the tool you asked for is on screen.
 *
 * **Six, and the count is the point.** Type, the paper (with the theme, which
 * is the same question), a picture, a link, dictation and typewriter
 * scrolling. A column of unlabelled glyphs is a memory test past about eight —
 * the argument that put a word under every icon on the rail — so this one
 * stops well short of that, and each carries a tooltip.
 *
 * **The four that act do not open anything**, and that is deliberate: a
 * picture opens the file picker, a link opens its dialog, and the two switches
 * flip where they stand and show it. A panel holding one switch would be a
 * second press for nothing.
 */

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Off-white", swatch: "#ededed" },
  { value: "sepia", label: "Grey", swatch: "#d6d6d6" },
  { value: "slate", label: "Charcoal", swatch: "#1c1c1c" },
  { value: "black", label: "Black", swatch: "#0d0d0d" },
];

/** Which tools open a panel of their own. The rest act where they stand. */
type ToolPanel = "type" | "paper";

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
  const [open, setOpen] = useState<ToolPanel | null>(null);

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
         being pressed from here. In short: a width, because without one every
         photograph lands filling the column; right alignment with wrap,
         because that is where a figure sits in a manuscript; and
         `insertContent` rather than `setImage`, because the base extension
         types its width as pixels where ours is a percentage. */
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

  /** A press on a tool that opens a panel. Second press puts it away. */
  const show = (which: ToolPanel) =>
    setOpen((now) => (now === which ? null : which));

  return (
    <>
      <div className="flex items-start gap-2">
        <div
          /* The strip. `float` is the card ground from the elevation ladder —
             see the note beside `--color-float`. */
          className="scroll-slim flex max-h-full shrink-0 flex-col items-center
                     gap-1 overflow-y-auto rounded-2xl border border-line
                     bg-float p-1.5 shadow-2xl"
        >
          <Tool
            mark="type"
            label="Type"
            active={open === "type"}
            onClick={() => show("type")}
          />
          <Tool
            mark="paper"
            label="Paper and theme"
            active={open === "paper"}
            onClick={() => show("paper")}
          />

          {canWrite && (
            <>
              <Rule />
              <Tool
                mark="image"
                label={busy ? "Reading the file…" : "A picture"}
                disabled={busy || !live}
                onClick={() => fileRef.current?.click()}
              />
              <Tool
                mark="link"
                label={existingLink ? "Edit the link" : "A link"}
                disabled={!live}
                onClick={() => setLinkAsked(existingLink ?? "https://")}
              />
            </>
          )}

          <Rule />
          {/* Hidden outright where it cannot work — the engine is the browser's
              own, Chrome and Edge only, and a control that could never work on
              this machine is not drawn at all rather than drawn dead. */}
          {dictation.supported && (
            <Tool
              mark="mic"
              label={dictation.listening ? "Stop dictation" : "Dictation"}
              active={dictation.listening}
              onClick={() =>
                dictation.listening ? dictation.stop() : dictation.start()
              }
            />
          )}
          <Tool
            mark="typewriter"
            label="Typewriter scrolling"
            active={typewriter}
            onClick={() => setPref("typewriter", !typewriter)}
          />
        </div>

        {open && (
          <div
            /* Beside the strip and no taller than it needs to be. Its own
               ground is `float` as well: it is the same object opened out, not
               a second surface stacked on the first. */
            className="oc-tools-card scroll-slim max-h-full w-64 overflow-y-auto
                       rounded-2xl border border-line bg-float p-3 shadow-2xl"
          >
            {open === "type" && (
              <>
                <SectionHeader className="mb-2">Type</SectionHeader>
                <ListGroup tone="lifted">
                  <ListRow
                    title="Font"
                    trailing={
                      <Picker
                        label="Font"
                        value={type.font}
                        onChange={(font) => setType({ font })}
                        width={200}
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
                        onChange={(v) =>
                          setType(paragraphStyleSettings(v as ParagraphStyle))
                        }
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
              </>
            )}

            {open === "paper" && (
              <>
                <SectionHeader className="mb-2">Paper</SectionHeader>
                {/* Rows rather than a row of swatches: the panel has the width
                    for the name, and five colours with their names read faster
                    than five colours you have to hover to identify. */}
                <ListGroup tone="lifted" as="ul">
                  {PAPERS.map((option) => (
                    <ListRow
                      key={option.value}
                      title={option.label}
                      onClick={() => setPref("paper", option.value)}
                      leading={
                        <span
                          aria-hidden="true"
                          /* `block`, or the height and width have nothing to
                             apply to: the row wraps `leading` in a plain span,
                             so this is an inline box unless it is told
                             otherwise, and it came out a sliver. */
                          className={`block h-5 w-5 shrink-0 rounded-full border ${
                            paper === option.value
                              ? "border-accent ring-2 ring-accent/40"
                              : "border-line"
                          }`}
                          style={{ background: option.swatch }}
                        />
                      }
                      trailing={
                        paper === option.value ? (
                          <span className="text-accent">✓</span>
                        ) : null
                      }
                    />
                  ))}
                </ListGroup>

                {/* **The theme is here and not a tool of its own**, because it
                    is the same question the paper asks — how bright is this
                    going to be — and the writer asking it is in front of the
                    manuscript at midnight. Two glyphs for one decision is two
                    places to look for it. */}
                <SectionHeader className="mt-4 mb-2">Theme</SectionHeader>
                <ListGroup tone="lifted">
                  <ListRow title="Appearance" trailing={<ThemeToggle />} />
                </ListGroup>
              </>
            )}

          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className="mt-2 px-1 font-sans text-xs text-danger">
          {problem}
        </p>
      )}

      {canWrite && (
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
      )}

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
          /* A bare domain is a link too — see `normalizeHref`, which the bar
             over a selection runs its input through as well, so both
             boxes store the same thing. */
          onSubmit={(typed) => {
            const href = normalizeHref(typed);
            if (href) live.chain().focus().setLink({ href }).run();
          }}
          onClose={() => setLinkAsked(null)}
        />
      )}
    </>
  );
}

/**
 * One tool in the strip.
 *
 * The rail's own button, one size down and without the word: this column is
 * seven tall rather than eleven, every one of them carries a tooltip, and the
 * strip is narrow on purpose. `active` means *this is what is open* for the
 * three that open a panel, and *this is on* for the two switches — the same
 * thing to look at either way, which is why one flag covers both.
 */
function Tool({
  mark,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  mark: MarkName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const handle = useMarkHandle();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onMouseEnter={handle.onEnter}
      onMouseLeave={handle.onLeave}
      onFocus={handle.onEnter}
      onBlur={handle.onLeave}
      className={`group relative flex h-10 w-10 shrink-0 items-center
                  justify-center rounded-xl outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? "bg-lifted text-accent"
                      : "text-fg/80 hover:bg-lifted hover:text-fg"
                  } ${disabled ? "opacity-40" : ""}`}
    >
      <RailMark mark={mark} markRef={handle.ref} size={20} />
      <Tooltip label={label} side="right" nowrap />
    </button>
  );
}

function Rule() {
  return <span aria-hidden="true" className="my-0.5 h-px w-5 bg-line" />;
}
