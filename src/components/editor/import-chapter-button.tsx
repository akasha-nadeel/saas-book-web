"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RailButton } from "@/components/editor/icon-rail";
import { ImportModeDialog } from "@/components/editor/import-mode-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import { importSummary, type ImportedChapter } from "@/lib/import/split";
import { bookWordCount, importIntoBook, type Book } from "@/lib/library-store";

/**
 * Bringing a manuscript file into this book, from the manuscript's own rail.
 *
 * **It used to sit in the chapter list's header**, in a row with the step back
 * and a second microphone, and it is here now because that is where the writer
 * is looking: the right rail is the book's toolbar, and this belongs beside
 * Export rather than three clicks away inside a list. Import and Export are one
 * pair — the manuscript coming in and the manuscript going out — and neither
 * acts on the page, which is what the rail's last group is for.
 *
 * Self-contained on purpose. The whole flow travels together — the file input,
 * the add-or-replace question, the undo banner and the failure — because a
 * button in one component and its dialog in another is how a control ends up
 * offered in a place that cannot answer for it.
 */
export function ImportChapterButton({
  book,
  presentation = "rail",
}: {
  book: Book;
  presentation?: "rail" | "list";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportedChapter[] | null>(null);

  const bookId = book.id;

  const handleFile = async (file: File) => {
    setImporting(true);
    setProblem(null);
    try {
      const parsed = await importFile(file);
      // Already written here? Ask add-or-replace. An empty book just takes it.
      if (bookWordCount(book) > 0) {
        setPending(parsed.chapters);
        return;
      }
      run(parsed.chapters, "replace");
    } catch (err) {
      setProblem(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
    } finally {
      setImporting(false);
    }
  };

  const run = (chapters: ImportedChapter[], mode: "add" | "replace") => {
    setPending(null);
    const result = importIntoBook(bookId, chapters, mode);
    if (!result) {
      setProblem(
        "Those chapters could not be saved — the book may be too large for this browser's storage.",
      );
      return;
    }
    showImportBanner(bookId, importSummary(chapters), result.undo);
    router.push(`/book/${bookId}/chapter/${result.firstId}`);
  };

  return (
    <>
      {presentation === "rail" ? (
        <RailButton
          label={importing ? "Reading file…" : "Import a file"}
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" />
          <path d="M3.5 12.5v2A1.5 1.5 0 0 0 5 16h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
        </RailButton>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-sm text-fg outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-45"
        >
          <span>{importing ? "Reading file…" : "Import a file"}</span>
          <span aria-hidden="true" className="text-muted">↑</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={IMPORT_ACCEPT}
        // sr-only hides it from the eye but *not* from a screen reader, so
        // without a name it is an unexplained file control in the tab order.
        aria-label="Import a chapter file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset immediately, or picking the same file twice does nothing.
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {pending && (
        <ImportModeDialog
          existingCount={book.chapters.filter((c) => !c.matter).length}
          importCount={pending.length}
          onAdd={() => run(pending, "add")}
          onReplace={() => run(pending, "replace")}
          onClose={() => setPending(null)}
        />
      )}

      {problem && (
        <ImportFailedDialog
          message={problem}
          onClose={() => setProblem(null)}
        />
      )}
    </>
  );
}

/**
 * A failed read, said in a dialog.
 *
 * In the chapter list this was a paragraph under the button, which a rail has
 * no room for — and a rail button that silently does nothing on a damaged file
 * is the worst of the options. The message is the importer's own, which names
 * the format problem rather than saying the file is bad.
 */
function ImportFailedDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        <h2 className="font-serif text-xl">That file did not come in</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-2 font-sans text-sm
                       text-fg outline-none transition-colors hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
