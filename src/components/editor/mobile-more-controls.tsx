"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ImportChapterButton } from "@/components/editor/import-chapter-button";
import {
  RailMark,
  useMarkHandle,
  type MarkName,
} from "@/components/editor/rail-mark";
import { ACCEPTED, importImage } from "@/lib/image-import";
import { ListGroup, SectionHeader } from "@/components/ui/list";
import { insertWidthPercent } from "@/lib/editor/image-resize";
import type { Dictation } from "@/lib/editor/use-dictation";
import { setPref, type Book, type Prefs } from "@/lib/library-store";

function Action({
  label,
  detail,
  onClick,
  active,
  mark,
  glyph,
  icon,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  active?: boolean;
  mark?: MarkName;
  glyph?: string;
  icon?: React.ReactNode;
}) {
  const handle = useMarkHandle();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      onMouseEnter={handle.onEnter}
      onMouseLeave={handle.onLeave}
      /* **A row in a group, not a card of its own.** Each of these carried its
         own border, radius and ground, so a section of four read as four
         stacked plates on a sheet that is already a card. The group draws the
         container; the row draws itself. `min-h-12` stays — this is the one
         place in the pass with a real touch target to hit. */
      className={`group flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset ${
        active ? "bg-accent/10 text-fg" : "text-fg hover:bg-raised"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {mark ? (
          <RailMark mark={mark} markRef={handle.ref} size={26} />
        ) : glyph ? (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised font-sans text-base font-semibold text-fg"
          >
            {glyph}
          </span>
        ) : icon ? (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted"
          >
            {icon}
          </span>
        ) : null}
        <span className="truncate font-semibold">{label}</span>
      </span>
      {detail && <span className="shrink-0 text-[11px] text-muted">{detail}</span>}
    </button>
  );
}

export function MobileMoreControls({
  book,
  prefs,
  dictation,
  canShare,
  onShare,
  onDetails,
  runCommand,
}: {
  book: Book;
  prefs: Prefs;
  dictation: Dictation;
  canShare: boolean;
  onShare: () => void;
  onDetails: () => void;
  runCommand: (command: (editor: Editor) => void) => void;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProblem, setImageProblem] = useState<string | null>(null);

  const pickImage = async (file: File) => {
    setImageBusy(true);
    setImageProblem(null);
    const result = await importImage(file);
    setImageBusy(false);
    if (!result.ok) {
      setImageProblem(result.error);
      return;
    }

    runCommand((live) => {
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
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section>
        <SectionHeader>Insert and write</SectionHeader>
        <ListGroup>
        <Action
          label={imageBusy ? "Preparing image…" : "Insert image"}
          detail="JPG, PNG, WebP"
          mark="image"
          onClick={() => imageRef.current?.click()}
        />
        <input
          ref={imageRef}
          type="file"
          accept={ACCEPTED}
          aria-label="Insert an image"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void pickImage(file);
          }}
        />
        {imageProblem && (
          <p role="status" className="bg-danger/10 px-3.5 py-2 text-[13px] text-danger">
            {imageProblem}
          </p>
        )}
        {dictation.supported && (
          <Action
            label={dictation.listening ? "Stop dictating" : "Start dictation"}
            detail={dictation.listening ? "Listening" : "Speech to text"}
            active={dictation.listening}
            mark="mic"
            onClick={() =>
              dictation.listening ? dictation.stop() : dictation.start()
            }
          />
        )}
        </ListGroup>
      </section>

      <section>
        <SectionHeader>Writing view</SectionHeader>
        <ListGroup>
        <Action
          label="Typewriter scrolling"
          detail={prefs.typewriter ? "On" : "Off"}
          active={prefs.typewriter}
          mark="typewriter"
          onClick={() => setPref("typewriter", !prefs.typewriter)}
        />
        <Action
          label="Paragraph marks"
          detail={prefs.marks ? "Shown" : "Hidden"}
          active={prefs.marks}
          glyph="¶"
          onClick={() => setPref("marks", !prefs.marks)}
        />
        </ListGroup>
      </section>

      <section>
        <SectionHeader>Book</SectionHeader>
        <ListGroup>
        {canShare && (
          <Action
            label="Share"
            mark="home"
            onClick={onShare}
          />
        )}
        <ImportChapterButton book={book} presentation="list" />
        <Link
          href={`/book/${book.id}/export`}
          className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2 text-[13px] font-medium text-fg outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset"
        >
          <span className="flex min-w-0 items-center gap-3">
            <RailMark mark="export" size={26} />
            <span className="truncate font-semibold">Export</span>
          </span>
          <span aria-hidden="true" className="text-[11px] text-muted">
            Word, EPUB, PDF
          </span>
        </Link>
        <Action
          label="Book details"
          mark="chapters"
          onClick={onDetails}
        />
        </ListGroup>
      </section>
    </div>
  );
}
