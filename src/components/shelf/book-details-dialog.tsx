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
import { Button } from "@/components/ui/button";

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
      className="m-auto w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg bg-tremor-background
                 p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="scroll-slim h-full overflow-y-auto p-4 pb-[max(1rem,var(--oc-safe-bottom))] sm:p-7">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          <div className="w-28 shrink-0 self-center sm:self-start">
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
            <h2 className="font-serif text-xl leading-snug text-tremor-content-strong">
              {book.title}
            </h2>
            {book.subtitle ? (
              <p className="mt-1 font-serif text-sm text-tremor-content italic">
                {book.subtitle}
              </p>
            ) : null}
            {book.author ? (
              <p className="mt-2 font-sans text-xs tracking-wide text-tremor-content uppercase">
                {book.author}
              </p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 font-sans text-sm">
              <div>
                <dt className="text-xs text-tremor-content">Chapters</dt>
                <dd className="tabular-nums text-tremor-content-strong">{chapters}</dd>
              </div>
              <div>
                <dt className="text-xs text-tremor-content">Words</dt>
                <dd className="tabular-nums text-tremor-content-strong">
                  {words.toLocaleString()}
                  {book.targetWords
                    ? ` of ${book.targetWords.toLocaleString()}`
                    : ""}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-tremor-content">Last opened</dt>
                <dd className="text-tremor-content-strong">{relativeTime(book.lastOpenedAt)}</dd>
              </div>
              {/* Genre alone since 2026-08-15. This row read "Form" and joined
                  the genre to the book's `kind` — novel, novella or short
                  story — and the picker that set that came off `/book/new`.
                  See the note at the top of `book-kinds.ts`. */}
              {book.genre ? (
                <div className="col-span-2">
                  <dt className="text-xs text-tremor-content">Genre</dt>
                  <dd className="text-tremor-content-strong">{book.genre}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" onClick={onEditCover} className="text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-strong">
            Edit details
          </Button>

          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={onClose} className="text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-strong">
              Cancel
            </Button>

            {/* **The Read button came off on 2026-08-25.** It pushed to
                `/book/[bookId]/read?from=shelf`, and `read` is in
                `HIDDEN_BOOK_TOOL_PATHS` — so the proxy answered every press
                with a redirect to the shelf the writer had just come from.
                A control that looks like it works and quietly returns you to
                where you started is worse than one that is missing.

                The reading view itself is untouched and still tested. This
                button comes back with it. */}
            <Button autoFocus onClick={() => router.push(`/book/${book.id}`)}>
              Open book
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
