"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionImportDialog } from "@/components/editor/section-import-dialog";
import { showImportBanner } from "@/components/editor/import-banner-host";
import { IMPORT_ACCEPT, ImportError, importFile } from "@/lib/import";
import {
  importSummary,
  partOfImport,
  type ImportedChapter,
} from "@/lib/import/split";
import {
  chapterMatterOf,
  importIntoBook,
  newInImport,
  type Book,
  type ChapterMatter,
} from "@/lib/library-store";
import { ImportFailedDialog } from "@/components/editor/import-failed-dialog";

/**
 * Bringing a file into **one part** of the book, from that part's own card.
 *
 * The rail's import is "here is a book": it reads the whole file, sorts it into
 * the three parts by heading name, and asks one question — about the chapters,
 * because chapters are the only thing its Replace can clear. That is the right
 * shape for a manuscript in one file and the wrong shape for the common case
 * behind it, which is that a finished book is often *three* files. There was no
 * way to say "this file is my back matter", and so no way to say "replace the
 * back matter I have": a writer with eight switched-on templates and a file of
 * the real prose met "This book already has every page in that file", which was
 * true of the names and beside the point.
 *
 * **The whole flow lives here rather than in the panel**, mounted once per
 * card. Three copies of a decision that must agree is how the two whole-book
 * doors came to need `newInImport` and `importAsksFirst` pulled out of them, and
 * there is no reason to learn that twice.
 *
 * Four rules it keeps:
 *
 * - **Only what the file says belongs to this part is used.** `partOfImport`
 *   decides; everything else is *named* rather than dropped in silence, so a
 *   manuscript aimed at the Back matter card lands nothing and says why.
 * - **The question is only asked when the part already has pages.** An empty
 *   card has nothing at stake and takes the file straight in.
 * - **Replace clears this part and nothing else.** The chapters and the other
 *   end of the book are untouched, and the dialog says so.
 * - **Undo covers all of it**, through the same banner every other import uses.
 */
export function SectionImportButton({
  book,
  part,
  label,
}: {
  book: Book;
  part: ChapterMatter;
  /** The card's own heading — "Front matter", "Body matter", "Back matter". */
  label: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    kept: ImportedChapter[];
    leftOut: string[];
  } | null>(null);

  const bookId = book.id;
  const existing = book.chapters.filter((c) => chapterMatterOf(c) === part);
  /* What this part is counted in. The body is the only one a writer counts in
     chapters; the other two are named pages. */
  const noun = part === "body" ? "chapter" : "page";
  const here = label.toLowerCase();

  const run = (
    chapters: ImportedChapter[],
    mode: "add" | "replace",
    leftOut: readonly string[],
  ) => {
    setPending(null);
    const result = importIntoBook(bookId, chapters, mode, part);
    if (!result) {
      /* Only reachable from Add, and only when every page is one the book has
         — the dialog already said so on the button, so this is the belt to its
         braces rather than the first the writer hears of it. */
      setProblem(
        `Nothing went in. Every ${noun} in that file is one this book already has.`,
      );
      return;
    }

    /* **What landed, not what was handed over.** In `add` the pages the book
       already had are dropped on the way in, and a banner counting the file
       would claim them. */
    const landed =
      mode === "replace" ? chapters : newInImport(book, chapters);
    showImportBanner(bookId, importSummary(landed), result.undo, leftOut);
    router.push(`/book/${bookId}/chapter/${result.firstId}`);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setProblem(null);
    try {
      /* The part is told to the *parser* as well, and it is what makes a file
         with no heading styles work: the divider vocabulary gains this part's
         own page names, so "Afterword" and "Glossary" open a page where
         otherwise only "Epilogue" would. See `looksLikeMatterLine`. The body
         has no such vocabulary to add — its names are the standing ones. */
      const parsed = await importFile(file, part === "body" ? undefined : part);
      const { kept, leftOut } = partOfImport(parsed.chapters, part);

      if (!kept.length) {
        setProblem(
          leftOut.length > 0
            ? `Nothing in that file is ${here}. What it holds: ${leftOut.join(", ")}.`
            : `Nothing in that file is ${here}.`,
        );
        return;
      }

      // Nothing at stake in an empty part: no question, straight in.
      if (existing.length === 0) {
        run(kept, "add", leftOut);
        return;
      }
      setPending({ kept, leftOut });
    } catch (err) {
      setProblem(
        err instanceof ImportError
          ? err.message
          : "That file could not be read. It may be damaged, or not the format its name suggests.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Square and iconic, not a third text button: the body card already
          carries two, and `[Hide chapters][New chapter][Import]` across a
          250px card cuts the first label in half. The words are on the
          `aria-label` and the tooltip, where they cost no room. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={`Import a file into ${here}`}
        title={`Import a file into ${here}`}
        className={`flex w-9 shrink-0 cursor-pointer items-center justify-center
                    rounded-lg font-sans outline-none transition-colors
                    focus-visible:ring-2 disabled:opacity-45 ${CARD_OUTLINE}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5" />
          <path d="M3.5 12.5v2A1.5 1.5 0 0 0 5 16h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
        </svg>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={IMPORT_ACCEPT}
        // sr-only hides it from the eye but not from a screen reader, so
        // without a name it is an unexplained file control in the tab order.
        aria-label={`Import a file into ${here}`}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset immediately, or picking the same file twice does nothing.
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {pending && (
        <SectionImportDialog
          label={label}
          noun={noun}
          existingCount={existing.length}
          incomingCount={pending.kept.length}
          // Add's own arithmetic: what is left once the pages the book already
          // has are taken out. Replace spares nothing, so it needs no count.
          newCount={newInImport(book, pending.kept).length}
          leftOut={pending.leftOut}
          onAdd={() => run(pending.kept, "add", pending.leftOut)}
          onReplace={() => run(pending.kept, "replace", pending.leftOut)}
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

/* The card's own outlined button, copied from `book-panel.tsx` rather than
   exported from it, because importing the panel here would be a cycle — the
   panel mounts this. Three lines of class names against a circular import is
   the right trade; if a fourth screen wants them they move to `ui/`. */
const CARD_OUTLINE = `border border-fg/20 bg-transparent text-fg
                      hover:border-accent/60 hover:bg-fg/10
                      focus-visible:ring-accent/50`;
