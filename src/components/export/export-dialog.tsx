"use client";

import { useEffect, useRef, useState } from "react";
import { setBookAuthor, type Book } from "@/lib/library-store";
import { runExport, type Format } from "@/lib/export";

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "markdown", label: "Markdown", hint: "Plain text, reads anywhere" },
  { value: "docx", label: "Word (.docx)", hint: "What agents ask for" },
  { value: "epub", label: "EPUB", hint: "Whole book, for e-readers" },
];

export function ExportDialog({
  book,
  chapterId,
  onClose,
}: {
  book: Book;
  /** When set, the writer may choose this chapter or the whole book. */
  chapterId?: string;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("markdown");
  const [wholeBook, setWholeBook] = useState(!chapterId);
  const [manuscript, setManuscript] = useState(true);
  const [author, setAuthor] = useState(book.author ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // EPUB is whole-book only: a one-chapter e-book is not a thing anyone wants.
  const scopeIsBook = format === "epub" ? true : wholeBook;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const trimmed = author.trim();
      if (trimmed && trimmed !== book.author) setBookAuthor(book.id, trimmed);

      await runExport({
        book: { ...book, author: trimmed || undefined },
        chapterId: scopeIsBook ? undefined : chapterId,
        format,
        manuscript,
      });
      onClose();
    } catch (err) {
      console.error("[export] failed", err);
      setError("Something went wrong building the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes; clicking the panel must not.
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-sm
                 bg-offcream p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">Export “{book.title}”</h2>

        <fieldset className="mt-6">
          <legend className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
            Format
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            {FORMATS.map((f) => (
              <label
                key={f.value}
                className="flex cursor-pointer items-baseline gap-3 font-sans text-sm"
              >
                <input
                  type="radio"
                  name="format"
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  className="accent-burgundy"
                />
                <span>{f.label}</span>
                <span className="text-xs text-warmgray">{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {chapterId && format !== "epub" && (
          <fieldset className="mt-6">
            <legend className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
              What
            </legend>
            <div className="mt-3 flex gap-6 font-sans text-sm">
              <label className="flex cursor-pointer items-baseline gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={!wholeBook}
                  onChange={() => setWholeBook(false)}
                  className="accent-burgundy"
                />
                This chapter
              </label>
              <label className="flex cursor-pointer items-baseline gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={wholeBook}
                  onChange={() => setWholeBook(true)}
                  className="accent-burgundy"
                />
                Whole book
              </label>
            </div>
          </fieldset>
        )}

        {format === "docx" && (
          <label className="mt-6 flex cursor-pointer items-baseline gap-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={manuscript}
              onChange={(e) => setManuscript(e.target.checked)}
              className="accent-burgundy"
            />
            Standard manuscript format
          </label>
        )}

        {(format === "docx" || format === "epub") && (
          <label className="mt-6 block font-sans text-sm">
            <span className="font-sans text-xs tracking-[0.18em] text-warmgray uppercase">
              Author
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
              className="mt-2 w-full rounded-sm border-b border-ink/15
                         bg-transparent py-1 outline-none
                         focus-visible:border-gold"
            />
          </label>
        )}

        {error && <p className="mt-4 font-sans text-sm text-burgundy">{error}</p>}

        <div className="mt-8 flex justify-end gap-4 font-sans text-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm text-warmgray outline-none hover:text-ink
                       focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="rounded-sm text-burgundy outline-none disabled:opacity-50
                       focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            {busy ? "Building…" : "Export"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
