"use client";

import { useEffect, useRef } from "react";
import { ToolGrid } from "@/components/shelf/tool-grid";
import type { Book } from "@/lib/library-store";

/**
 * Everything this app can do to one book, on one sheet.
 *
 * The book card used to carry all of it as chips — twenty-one identical grey
 * pills per card, three cards to a row. Two things were wrong with that and
 * neither is fixed by making the pills smaller. Nothing had any weight, so
 * *Write* and *Trash* were the same size and colour; and a pill has room for a
 * name but not for what the thing is, so a writer who did not already know what
 * "Comps" meant had no way to find out except by pressing it.
 *
 * So the card keeps the two verbs a writer came for, and this holds the rest —
 * grouped by the part of the job they belong to, and each one saying what it
 * does. It is longer to read than a row of pills and far quicker to use, which
 * is the trade a launcher should make.
 *
 * The list itself lives in `lib/book-tools.ts`, because the dashboard's Tools
 * area shows the same fifteen and two copies of fifteen descriptions is one
 * copy to forget.
 */
export function BookToolsDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `showModal` rather than an `open` attribute: it brings Escape, the focus
  // trap and the inert backdrop with it, none of which are worth rebuilding.
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
      className="m-auto w-[44rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line
                 bg-panel p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{book.title}</h2>
          <p className="mt-0.5 text-sm text-muted">
            Everything this app can do to this book. All of it works today.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 shrink-0 rounded-lg px-2.5 py-1.5 text-xl leading-none
                     text-muted hover:bg-raised"
        >
          ×
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
        <ToolGrid bookId={book.id} onPick={onClose} />
      </div>
    </dialog>
  );
}
