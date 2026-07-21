"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IMPORT_ACCEPT,
  IMPORT_FORMATS,
  ImportError,
  importFile,
} from "@/lib/import";
import type { ImportedBook } from "@/lib/import/split";
import { createBookFromImport } from "@/lib/library-store";

/**
 * Bringing an existing manuscript in.
 *
 * The screen has two states on purpose. Reading the file produces a *proposal*
 * — this title, these chapters, these lengths — and nothing is written until
 * the writer agrees to it. Chapter detection is guesswork whatever care goes
 * into it, and guesswork that silently becomes a book is how somebody ends up
 * with a novel in eighty-three pieces and no idea why.
 */
export function ImportBook() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ImportedBook | null>(null);
  const [title, setTitle] = useState("");

  const read = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const book = await importFile(file);
      setProposal(book);
      setTitle(book.title);
    } catch (err) {
      // A message written for the writer if we wrote one; anything else is a
      // bug, and saying "something went wrong" is the honest version of that.
      setError(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
      setProposal(null);
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!proposal) return;

    const result = createBookFromImport(title, proposal.chapters);
    if (!result) {
      setError(
        "This book could not be saved — it is too large for this browser's storage. Nothing was added to your library.",
      );
      return;
    }
    router.push(`/book/${result.bookId}/chapter/${result.chapterId}`);
  };

  const totalWords = proposal
    ? proposal.chapters.reduce((sum, c) => sum + c.words, 0)
    : 0;

  return (
    // A fixed height with its own overflow, not min-height: the body is
    // overflow-hidden for the editor's fixed shell, so a page that merely grows
    // past the viewport has no way to reach what is below the fold. This also
    // gives the sticky action bar a real scrollport to pin itself to.
    <main className="scroll-slim h-dvh overflow-y-auto bg-surface px-4 py-12">
      <div className="mx-auto w-full max-w-[34rem]">
        <h1 className="text-center font-serif text-3xl text-fg">
          Import a manuscript
        </h1>
        <p className="mt-2 text-center font-sans text-sm text-muted">
          Bring in a book you have already started. Nothing is added to your
          library until you have seen what came through.
        </p>

        {proposal === null ? (
          <>
            <div
              onDragOver={(e) => {
                // Without preventDefault the browser opens the file instead.
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void read(file);
              }}
              className={`mt-9 rounded-lg border-2 border-dashed px-6 py-12
                          text-center transition-colors ${
                            dragging
                              ? "border-accent bg-accent-deep/30"
                              : "border-line"
                          }`}
            >
              <p className="font-sans text-sm text-fg">
                {busy ? "Reading…" : "Drop your manuscript here"}
              </p>
              <p className="mt-1 font-sans text-xs text-muted">or</p>

              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-3 rounded-md bg-accent px-4 py-2 font-sans text-sm
                           font-semibold text-white outline-none
                           transition-colors hover:bg-accent-strong
                           focus-visible:ring-2 focus-visible:ring-accent/60
                           disabled:opacity-50"
              >
                Choose a file
              </button>

              <input
                ref={inputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset, or choosing the same file twice fires nothing.
                  e.target.value = "";
                  if (file) void read(file);
                }}
              />
            </div>

            <div className="mt-5 font-sans text-xs text-muted">
              <p>
                Reads{" "}
                {IMPORT_FORMATS.map((f) => f.extension).join(", ")}. Text,
                headings, bold and italic come through; styling, images,
                footnotes and comments do not.
              </p>
              <p className="mt-2">
                PDF and old .doc files cannot be read here — export or save your
                manuscript as .docx first.
              </p>
            </div>

            {/* Announced, not pretended. Transcription is not a parser — it
                needs a speech model, which means a server and a bill — so this
                says where it is going rather than offering a button that would
                take a file and lose it. */}
            <section className="mt-8 rounded-lg border border-dashed border-line p-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <rect x="7.6" y="2.6" width="4.8" height="9" rx="2.4" />
                    <path d="M4.8 9.4a5.2 5.2 0 0 0 10.4 0" />
                    <path d="M10 14.6v2.8" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="font-sans text-sm font-semibold text-fg">
                    Audiobook to text
                  </h2>
                  <p className="mt-1 font-sans text-xs text-muted">
                    Upload a recording and have it transcribed into chapters.
                    Not built yet — this is here so you know it is planned, not
                    because it works.
                  </p>
                </div>

                <button
                  type="button"
                  disabled
                  title="Not available yet"
                  className="shrink-0 cursor-not-allowed rounded-md border
                             border-line px-3 py-2 font-sans text-sm text-muted
                             opacity-60"
                >
                  Coming soon
                </button>
              </div>
            </section>
          </>
        ) : (
          <div className="mt-9">
            <label className="block font-sans text-sm">
              <span className="font-medium text-fg">Book title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Book"
                className="mt-1.5 w-full rounded-md border border-line bg-panel
                           px-3 py-2.5 text-fg placeholder:text-muted
                           focus-visible:border-accent
                           focus-visible:outline-none"
              />
            </label>

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <p className="font-sans text-sm font-medium text-fg">
                {proposal.chapters.length}{" "}
                {proposal.chapters.length === 1 ? "chapter" : "chapters"}
              </p>
              <p className="font-sans text-sm tabular-nums text-muted">
                {totalWords.toLocaleString()} words
              </p>
            </div>

            {/* The whole point of the preview: chapter detection is a guess,
                and this is where it can be checked before it becomes a book. */}
            <ol className="scroll-slim mt-2 max-h-80 overflow-y-auto rounded-md border border-line">
              {proposal.chapters.map((chapter, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-3 border-b border-line
                             px-3 py-2.5 font-sans text-sm last:border-b-0"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-fg">
                    {chapter.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {chapter.words.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-2 font-sans text-xs text-muted">
              Chapters are worked out from the document’s headings. If this is
              wrong, cancel — adding headings in your original and importing
              again is faster than fixing it afterwards.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-md border border-accent/50 bg-accent-deep/30
                           px-3 py-2.5 font-sans text-sm text-fg"
              >
                {error}
              </p>
            )}

            {/* Pinned to the bottom of the viewport. A long chapter list pushed
                this below the fold, which left the one action the whole screen
                exists for out of sight at exactly the moment it was needed. */}
            <div
              className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center
                         justify-end gap-2 border-t border-line bg-surface
                         px-4 py-4"
            >
              <button
                type="button"
                onClick={() => {
                  setProposal(null);
                  setError(null);
                }}
                className="rounded-md px-3 py-2.5 font-sans text-sm text-muted
                           outline-none transition-colors hover:bg-raised
                           hover:text-fg focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                Choose another file
              </button>
              <button
                type="button"
                onClick={create}
                className="rounded-md bg-accent px-5 py-2.5 font-sans text-sm
                           font-semibold text-white outline-none
                           transition-colors hover:bg-accent-strong
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Add to my library
              </button>
            </div>
          </div>
        )}

        {proposal === null && error && (
          <p
            role="alert"
            className="mt-5 rounded-md border border-accent/50 bg-accent-deep/30
                       px-3 py-2.5 font-sans text-sm text-fg"
          >
            {error}
          </p>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="rounded-sm font-sans text-sm text-muted outline-none
                       transition-colors hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Back to your books
          </Link>
        </div>
      </div>
    </main>
  );
}
