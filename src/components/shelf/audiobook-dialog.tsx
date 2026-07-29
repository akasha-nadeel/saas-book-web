"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseText } from "@/lib/import/plain-text";
import { splitIntoChapters } from "@/lib/import/split";
import { titleFromFileName } from "@/lib/import";
import { createBookFromImport } from "@/lib/library-store";

/**
 * Turns a recording into a book.
 *
 * The transcript is the only new thing here. Once the words exist they go
 * through the same parseText → splitIntoChapters → createBookFromImport path a
 * .docx takes, so an audiobook arrives as an ordinary book — chaptered where
 * the reader announced chapters, and editable like any other.
 *
 * A spoken "Chapter Four" is a paragraph like any other to the splitter, which
 * is exactly why this works: it already recognises those lines.
 */
type Stage = "idle" | "sending" | "reading" | "building";

const ACCEPT = "audio/*,.mp3,.m4a,.wav,.webm,.ogg,.flac";

export function AudiobookDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const busy = stage !== "idle";

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage("sending");

    let text: string;
    try {
      const body = new FormData();
      body.append("audio", file);
      const response = await fetch("/api/transcribe", { method: "POST", body });
      const payload = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !payload.text) {
        setError(payload.error ?? "The recording could not be transcribed.");
        setStage("idle");
        return;
      }
      text = payload.text;
    } catch {
      setError("Could not reach the transcriber. Check your connection.");
      setStage("idle");
      return;
    }

    setStage("reading");
    // Not markdown: a transcript has no syntax in it, and treating a spoken
    // "hash" or asterisk as formatting would put marks in the prose.
    const book = splitIntoChapters(
      parseText(text, false),
      titleFromFileName(file.name),
    );

    setStage("building");
    const made = createBookFromImport(book.title, book.chapters);
    if (!made) {
      setError(
        "There was no room to store the transcript. Free some space and try again.",
      );
      setStage("idle");
      return;
    }

    router.push(`/book/${made.bookId}/chapter/${made.chapterId}`);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Not dismissable mid-transcription: the request is already in flight
        // and the writer would have no idea whether it had been charged for.
        if (e.target === dialogRef.current && !busy) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Import an audiobook</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          Pick a recording and it is transcribed, split where the reader
          announces a chapter, and opened as a book you can edit.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so choosing the same file twice fires onChange again.
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-raised px-3.5 py-3 font-sans text-sm
                       leading-relaxed text-fg"
          >
            {error}
          </p>
        )}

        {busy ? (
          <div className="mt-5 rounded-lg bg-raised px-3.5 py-3">
            <p className="font-sans text-sm font-medium text-fg">
              {STAGE_LABEL[stage]}
            </p>
            {fileName && (
              <p className="mt-1 truncate font-sans text-xs text-muted">
                {fileName}
              </p>
            )}
            {stage === "sending" && (
              <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                A long recording takes a few minutes. Leave this open.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
            MP3, M4A, WAV, WebM, OGG or FLAC, up to 25MB. Longer recordings need
            splitting first.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-4 py-2 font-sans text-sm font-medium text-muted
                       outline-none transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/50
                       disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold
                       text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60 disabled:opacity-60"
          >
            {busy ? "Working…" : "Choose a recording"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  sending: "Transcribing the recording…",
  reading: "Finding the chapters…",
  building: "Making the book…",
};
