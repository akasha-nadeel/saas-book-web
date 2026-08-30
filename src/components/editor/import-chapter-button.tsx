"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RailButton } from "@/components/editor/icon-rail";
import { ImportFailedDialog } from "@/components/editor/import-failed-dialog";
import { ImportModeDialog } from "@/components/editor/import-mode-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import {
  NOTHING_NEW,
  importAsksFirst,
  importSummary,
  type ImportedChapter,
} from "@/lib/import/split";
import {
  bookWordCount,
  importIntoBook,
  newInImport,
  type Book,
} from "@/lib/library-store";

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

      /* **Dropped here rather than inside the store**, so the writer is told
         which pages the book already had instead of meeting a storage error.
         Everything downstream — the question, the banner, the import itself —
         sees this list, so all three describe the same set of pages. */
      const fresh = newInImport(book, parsed.chapters);
      if (!fresh.length) {
        setProblem(NOTHING_NEW);
        return;
      }

      const written = bookWordCount(book) > 0;
      if (importAsksFirst(written, importSummary(fresh))) {
        setPending(fresh);
        return;
      }
      /* Nothing at stake: an empty book is replaced outright and numbered from
         one, and a file with no chapters in it can only ever be added to. */
      run(fresh, written ? "add" : "replace");
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
          imgSrc="/icons/icon-import.png"
        />
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3.5 py-2 text-left text-sm font-medium text-fg outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-45"
        >
          <span className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-import.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="truncate font-semibold">
              {importing ? "Reading file…" : "Import a file"}
            </span>
          </span>
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
          existing={importSummary(book.chapters)}
          incoming={importSummary(pending)}
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
