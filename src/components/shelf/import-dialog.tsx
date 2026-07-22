"use client";

import { useEffect, useRef, useState } from "react";
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
 * Importing a manuscript, as a modal on the shelf.
 *
 * Two ways in, the way the reference has two: a file from the device, or text
 * pasted straight in. The reference's second tab is a URL, which this app cannot
 * honour — it fetches nothing from a server — so "Paste text" takes its place
 * and does real work through the same parser.
 *
 * Reading a file or the pasted text produces a *proposal* — this title, these
 * chapters — and nothing is written until the writer agrees to it. Chapter
 * detection is guesswork, and guesswork that silently becomes a book is how you
 * end up with a novel in eighty-three pieces.
 */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"file" | "paste">("file");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ImportedBook | null>(null);
  const [title, setTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const read = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const book = await importFile(file);
      setProposal(book);
      setTitle(book.title);
    } catch (err) {
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

  const readPaste = () => {
    const text = pasteText.trim();
    if (!text) return;
    // Round-trips through the same parser: a .md file so headings become
    // chapters and the rest becomes prose.
    void read(new File([text], "Untitled Book.md", { type: "text/markdown" }));
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
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[38rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-panel
                 p-0 text-fg shadow-xl backdrop:bg-black/70"
    >
      <div className="flex max-h-[88vh] flex-col">
        <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-4">
          <h2 className="font-serif text-xl">Import a book</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-line p-1.5 text-muted outline-none
                       transition-colors hover:bg-raised hover:text-fg
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {proposal === null ? (
          <>
            <div className="flex gap-6 border-b border-line px-6">
              {(
                [
                  ["file", "Local file"],
                  ["paste", "Paste text"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTab(value);
                    setError(null);
                  }}
                  className={`relative -mb-px pb-3 font-sans text-sm font-medium
                              outline-none transition-colors ${
                                tab === value
                                  ? "text-fg"
                                  : "text-muted hover:text-fg"
                              }`}
                >
                  {label}
                  {tab === value && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="scroll-slim overflow-y-auto px-6 py-5">
              {tab === "file" ? (
                <>
                  <div
                    onDragOver={(e) => {
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
                    className={`rounded-xl border-2 border-dashed px-6 py-9
                                text-center transition-colors ${
                                  dragging
                                    ? "border-accent bg-accent/10"
                                    : "border-line"
                                }`}
                  >
                    {/* A little stack of pages, the way the reference stacks its
                        clips — so the empty zone reads as "files go here". */}
                    <div
                      aria-hidden="true"
                      className="relative mx-auto mb-4 h-16 w-24"
                    >
                      <div className="absolute top-1 left-2 h-14 w-16 -rotate-6 rounded-lg border border-line bg-raised" />
                      <div className="absolute top-0 right-2 h-14 w-16 rotate-6 rounded-lg border border-line bg-raised" />
                      <div className="absolute inset-x-0 top-1.5 mx-auto flex h-14 w-16 items-center justify-center rounded-lg border border-accent/40 bg-accent/10">
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="h-6 w-6 text-accent"
                        >
                          <path
                            d="M11.5 2.8H6.2a1.5 1.5 0 0 0-1.5 1.5v11.4a1.5 1.5 0 0 0 1.5 1.5h7.6a1.5 1.5 0 0 0 1.5-1.5V6.4z"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M11.5 2.8v2.9a.9.9 0 0 0 .9.9h2.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>

                    <p className="font-sans text-sm font-medium text-fg">
                      {busy ? "Reading…" : "Drag and drop your manuscript"}
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      It stays on your device — nothing is uploaded.
                    </p>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                      className="mt-4 rounded-lg border border-line bg-surface px-4
                                 py-2 font-sans text-sm font-medium text-fg
                                 outline-none transition-colors hover:bg-raised
                                 focus-visible:ring-2 focus-visible:ring-accent/60
                                 disabled:opacity-50"
                    >
                      Select file
                    </button>

                    <input
                      ref={inputRef}
                      type="file"
                      accept={IMPORT_ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void read(file);
                      }}
                    />
                  </div>

                  <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
                    Reads {IMPORT_FORMATS.map((f) => f.extension).join(", ")}.
                    Text, headings, bold and italic come through; images,
                    footnotes and comments do not. PDF and old .doc files cannot
                    be read here — save your manuscript as .docx first.
                  </p>
                </>
              ) : (
                <>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your manuscript here…"
                    className="scroll-slim min-h-[13rem] w-full resize-y rounded-xl
                               border border-line bg-surface px-3.5 py-3 font-sans
                               text-sm leading-relaxed text-fg placeholder:text-muted
                               focus-visible:border-accent focus-visible:outline-none"
                  />
                  <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                    Mark chapters with{" "}
                    <code className="rounded bg-raised px-1">#</code> headings.
                    Without them it comes in as a single chapter.
                  </p>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={!pasteText.trim() || busy}
                      onClick={readPaste}
                      className="rounded-lg bg-accent px-4 py-2 font-sans text-sm
                                 font-semibold text-white outline-none
                                 transition-colors hover:bg-accent-strong
                                 focus-visible:ring-2 focus-visible:ring-accent/60
                                 disabled:opacity-40"
                    >
                      {busy ? "Reading…" : "Continue"}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-line bg-raised px-3
                             py-2.5 font-sans text-sm"
                  style={{ color: "var(--color-danger)" }}
                >
                  {error}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="scroll-slim overflow-y-auto px-6 py-5">
              <label className="block font-sans text-sm">
                <span className="font-medium text-fg">Book title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled Book"
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface
                             px-3.5 py-2.5 text-fg placeholder:text-muted
                             focus-visible:border-accent focus-visible:outline-none"
                />
              </label>

              <div className="mt-5 flex items-baseline justify-between gap-3">
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
              <ol className="scroll-slim mt-2 max-h-72 overflow-y-auto rounded-lg border border-line">
                {proposal.chapters.map((chapter, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 border-b border-line px-3
                               py-2.5 font-sans text-sm last:border-b-0"
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

              <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                Chapters are worked out from the document’s headings. If this is
                wrong, go back — adding headings in your original and importing
                again is faster than fixing it afterwards.
              </p>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-line bg-raised px-3
                             py-2.5 font-sans text-sm"
                  style={{ color: "var(--color-danger)" }}
                >
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setProposal(null);
                  setError(null);
                }}
                className="rounded-lg px-3 py-2 font-sans text-sm text-muted
                           outline-none transition-colors hover:bg-raised
                           hover:text-fg focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                Choose another
              </button>
              <button
                type="button"
                onClick={create}
                className="rounded-lg bg-accent px-5 py-2 font-sans text-sm
                           font-semibold text-white outline-none transition-colors
                           hover:bg-accent-strong focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                Import book
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
