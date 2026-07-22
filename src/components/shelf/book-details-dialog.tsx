"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import { bookWordCount, type Book } from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useCover } from "@/lib/use-library";

/**
 * What a book is, before opening it.
 *
 * The shelf card carries only a title and subtitle now, which is what a spine
 * carries. Everything else about a book — who wrote it, how long it is, when it
 * was last touched — lives here, on the way in.
 */
export function BookDetailsDialog({
  book,
  onClose,
  onEditCover,
}: {
  book: Book;
  onClose: () => void;
  onEditCover: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cover = useCover(book.id);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const words = bookWordCount(book);
  const chapters = book.chapters.length;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-7">
        <div className="flex items-start gap-5">
          <div className="w-28 shrink-0">
            <BookCover
              title={book.title}
              subtitle={book.subtitle}
              author={book.author}
              words={words}
              image={cover}
              seed={book.id}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl leading-snug text-fg">
              {book.title}
            </h2>
            {book.subtitle ? (
              <p className="mt-1 font-serif text-sm text-muted italic">
                {book.subtitle}
              </p>
            ) : null}
            {book.author ? (
              <p className="mt-2 font-sans text-xs tracking-wide text-muted uppercase">
                {book.author}
              </p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 font-sans text-sm">
              <div>
                <dt className="text-xs text-muted">Chapters</dt>
                <dd className="tabular-nums text-fg">{chapters}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Words</dt>
                <dd className="tabular-nums text-fg">
                  {words.toLocaleString()}
                  {book.targetWords
                    ? ` of ${book.targetWords.toLocaleString()}`
                    : ""}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Last opened</dt>
                <dd className="text-fg">{relativeTime(book.lastOpenedAt)}</dd>
              </div>
              {book.genre || book.kind ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Form</dt>
                  <dd className="text-fg">
                    {[book.genre, book.kind === "short-story" ? "short story" : book.kind]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onEditCover}
            className="rounded-md px-3 py-2 font-sans text-sm text-muted
                       outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Edit cover
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 font-sans text-sm text-muted
                         outline-none transition-colors hover:bg-raised
                         hover:text-fg focus-visible:ring-2
                         focus-visible:ring-accent/60"
            >
              Cancel
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => router.push(`/book/${book.id}`)}
              className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                         font-medium text-white outline-none transition-colors
                         hover:bg-accent-strong focus-visible:ring-2
                         focus-visible:ring-accent/60"
            >
              Open book
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
