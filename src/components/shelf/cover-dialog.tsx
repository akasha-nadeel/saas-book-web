"use client";

import { useEffect, useRef, useState } from "react";
import { BookCover } from "@/components/shelf/book-cover";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
} from "@/lib/image-import";
import {
  bookWordCount,
  setBookDetails,
  setCover,
  type Book,
} from "@/lib/library-store";
import { useCover } from "@/lib/use-library";

/**
 * Editing what a book looks like on the shelf.
 *
 * A dialog rather than a page, unlike setup: this is a change to something that
 * already exists and the writer is looking straight at it, so the shelf staying
 * visible behind is the point.
 *
 * Nothing is written until Save. Editing live would mean a mis-typed title
 * repainting the shelf on every keystroke, and would leave Cancel with nothing
 * to undo.
 */
export function CoverDialog({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const storedCover = useCover(book.id);

  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const [author, setAuthor] = useState(book.author ?? "");
  // Undefined means "unchanged"; null means "remove the one that is there".
  const [cover, setNextCover] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const preview = cover === undefined ? storedCover : cover;

  const save = (e: React.FormEvent) => {
    e.preventDefault();

    setBookDetails(book.id, { title, subtitle, author });

    if (cover !== undefined && !setCover(book.id, cover)) {
      // The text saved either way; only the picture did not fit.
      setError(
        "The text was saved, but the image was too large for this browser's storage.",
      );
      return;
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[34rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <form onSubmit={save} className="p-7">
        <h2 className="font-serif text-xl">Edit cover</h2>
        <p className="mt-1 font-sans text-sm text-muted">
          How this book appears on your shelf.
        </p>

        <div className="mt-6 flex items-start gap-5">
          <div className="w-28 shrink-0">
            <BookCover
              title={title.trim() || "Untitled Book"}
              subtitle={subtitle.trim() || undefined}
              author={author.trim() || undefined}
              words={bookWordCount(book)}
              image={preview}
              seed={book.id}
            />
          </div>

          <div className="min-w-0 flex-1">
            <label className="block font-sans text-sm">
              <span className="font-medium text-fg">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Book"
                autoFocus
                className="mt-1.5 w-full rounded-md border border-line bg-surface
                           px-3 py-2 text-fg placeholder:text-muted
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <label className="mt-4 block font-sans text-sm">
              <span className="font-medium text-fg">Subtitle</span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="A novel"
                className="mt-1.5 w-full rounded-md border border-line bg-surface
                           px-3 py-2 text-fg placeholder:text-muted
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <label className="mt-4 block font-sans text-sm">
              <span className="font-medium text-fg">Author</span>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="mt-1.5 w-full rounded-md border border-line bg-surface
                           px-3 py-2 text-fg placeholder:text-muted
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-line px-3 py-2 font-sans
                           text-sm text-fg outline-none transition-colors
                           hover:border-accent/60 hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {preview ? "Replace image" : "Choose image"}
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={() => {
                    setNextCover(null);
                    setError(null);
                  }}
                  className="rounded-md px-3 py-2 font-sans text-sm text-muted
                             outline-none transition-colors hover:bg-raised
                             hover:text-fg focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            // Reset, or choosing the same file twice fires nothing.
            e.target.value = "";
            if (!file) return;

            setError(null);
            const result = await importImage(file, {
              maxEdge: COVER_MAX_EDGE,
              maxBytes: COVER_MAX_BYTES,
            });
            if (result.ok) setNextCover(result.src);
            else setError(result.error);
          }}
        />

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-md border border-accent/50 bg-accent-deep/30
                       px-3 py-2.5 font-sans text-sm text-fg"
          >
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-end gap-2">
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
            type="submit"
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                       font-medium text-white outline-none transition-colors
                       hover:bg-accent-strong focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
