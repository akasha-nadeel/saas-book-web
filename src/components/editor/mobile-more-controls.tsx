"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ImportChapterButton } from "@/components/editor/import-chapter-button";
import { ACCEPTED, importImage } from "@/lib/image-import";
import { insertWidthPercent } from "@/lib/editor/image-resize";
import type { Dictation } from "@/lib/editor/use-dictation";
import { setPref, type Book, type Prefs } from "@/lib/library-store";

function Action({
  label,
  detail,
  onClick,
  active,
  imgSrc,
  glyph,
  icon,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  active?: boolean;
  imgSrc?: string;
  glyph?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active
          ? "border-accent bg-raised text-fg shadow-xs"
          : "border-line bg-surface/50 text-fg hover:bg-raised"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
          />
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
      {detail && <span className="shrink-0 text-xs text-muted">{detail}</span>}
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
      <section className="grid gap-2">
        <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
          Insert and write
        </h3>
        <Action
          label={imageBusy ? "Preparing image…" : "Insert image"}
          detail="JPG, PNG, WebP"
          imgSrc="/icons/icon-image.png"
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
          <p role="status" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {imageProblem}
          </p>
        )}
        {dictation.supported && (
          <Action
            label={dictation.listening ? "Stop dictating" : "Start dictation"}
            detail={dictation.listening ? "Listening" : "Speech to text"}
            active={dictation.listening}
            imgSrc="/icons/icon-mic.png"
            onClick={() =>
              dictation.listening ? dictation.stop() : dictation.start()
            }
          />
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
          Writing view
        </h3>
        <Action
          label="Typewriter scrolling"
          detail={prefs.typewriter ? "On" : "Off"}
          active={prefs.typewriter}
          imgSrc="/icons/icon-typewriter.png"
          onClick={() => setPref("typewriter", !prefs.typewriter)}
        />
        <Action
          label="Paragraph marks"
          detail={prefs.marks ? "Shown" : "Hidden"}
          active={prefs.marks}
          glyph="¶"
          onClick={() => setPref("marks", !prefs.marks)}
        />
      </section>

      <section className="grid gap-2">
        <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
          Book
        </h3>
        {canShare && (
          <Action
            label="Share"
            imgSrc="/icons/icon-home.png"
            onClick={onShare}
          />
        )}
        <ImportChapterButton book={book} presentation="list" />
        <Link
          href={`/book/${book.id}/export`}
          className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3.5 py-2 text-sm font-medium text-fg outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-export.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="truncate font-semibold">Export</span>
          </span>
          <span aria-hidden="true" className="text-xs text-muted">
            Word, EPUB, PDF
          </span>
        </Link>
        <Action
          label="Book details"
          imgSrc="/icons/icon-chapters.png"
          onClick={onDetails}
        />
      </section>
    </div>
  );
}
