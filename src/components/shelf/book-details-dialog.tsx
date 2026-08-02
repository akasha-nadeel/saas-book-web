"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/shelf/book-cover";
import {
  bookChapterCount,
  bookWordCount,
  type Book,
} from "@/lib/library-store";
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
  const chapters = bookChapterCount(book);

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
            Edit details
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

            {/* The way to the reading view, which until now could only be
                reached from inside the editor's rail — so seeing the book as a
                book meant first opening it as a manuscript. Outlined rather
                than filled: reading is the second thing you come to a book for,
                and the primary belongs to writing. */}
            <button
              type="button"
              // ?from=shelf so the reader's back arrow returns here rather than
              // dropping the reader into an editor they never opened. Carried in
              // the URL rather than in history, so it survives a reload and a
              // shared link behaves the same way.
              onClick={() => router.push(`/book/${book.id}/read?from=shelf`)}
              className="flex items-center gap-2 rounded-md border border-line
                         px-3.5 py-2 font-sans text-sm font-medium text-fg
                         outline-none transition-colors hover:border-accent/60
                         hover:bg-raised focus-visible:ring-2
                         focus-visible:ring-accent/60"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M10 5.5C8.6 4.6 7 4.2 5 4.2c-.6 0-1 .4-1 1v9c0 .6.4 1 1 1 2 0 3.6.4 5 1.3" />
                <path d="M10 5.5c1.4-.9 3-1.3 5-1.3.6 0 1 .4 1 1v9c0 .6-.4 1-1 1-2 0-3.6.4-5 1.3" />
                <path d="M10 5.5v11" />
              </svg>
              Read
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => router.push(`/book/${book.id}`)}
              className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                         font-medium text-accent-ink outline-none transition-colors
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
