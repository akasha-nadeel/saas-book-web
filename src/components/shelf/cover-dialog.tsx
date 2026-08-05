"use client";

import { useEffect, useRef, useState } from "react";
import { BookCover } from "@/components/shelf/book-cover";
import { GENRES } from "@/lib/book-kinds";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
} from "@/lib/image-import";
import {
  bookWordCount,
  setBookDetails,
  type Book,
} from "@/lib/library-store";
import { useCover } from "@/lib/use-library";
import { clearCover, saveCover } from "@/lib/cover-save";

/**
 * Editing what a book *is*: its title, who wrote it, what kind of book it is,
 * and the picture on the front.
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
  const [genre, setGenre] = useState(book.genre ?? "");
  // Undefined means "unchanged"; null means "remove the one that is there".
  const [cover, setNextCover] = useState<string | null | undefined>(undefined);
  /* The picked file itself, held until Save.
     The dialog is a form — nothing is committed until the writer presses the
     button — so the full-size copy cannot be stored at the moment the file is
     chosen, or cancelling would leave artwork behind for a cover that was
     never set. See `saveCover`. */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const preview = cover === undefined ? storedCover : cover;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    setBookDetails(book.id, { title, subtitle, author, genre });

    if (coverFile) {
      // One call sets all three: the thumbnail, the full-size artwork the
      // export packages, and the measurements the dashboard checks.
      const result = await saveCover(book.id, coverFile);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } else if (cover === null) {
      await clearCover(book.id);
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
        <h2 className="font-serif text-xl">Edit book details</h2>
        <p className="mt-1 font-sans text-sm text-muted">
          What this book is, and how it appears on your shelf.
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

            {/* Genre, which until now could only be set when a book was made.
                That was fine while every book came from /book/new, which asks
                — an imported one never does, and a book without it silently
                dead-ends comp titles, categories, the blurb examples and the
                structure targets, because `buildQuery()` has nothing to search
                on. Four broken tools, one blank field, and nothing anywhere
                that let a writer fill it in.

                A select rather than free text: the same list `/book/new` offers
                and `suggestTarget()` knows about, so the three cannot drift. */}
            <label className="mt-4 block font-sans text-sm">
              <span className="font-medium text-fg">Genre</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line bg-surface
                           px-3 py-2 text-fg focus-visible:border-accent
                           focus-visible:outline-none"
              >
                <option value="">Not sure yet</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Comp titles, categories, blurb examples and structure all read
                this.
              </span>
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
                    setCoverFile(null);
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
          aria-label="Choose a cover image"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            // Reset, or choosing the same file twice fires nothing.
            e.target.value = "";
            if (!file) return;

            setError(null);
            /* **Measure the original before it is shrunk.**
               `importImage` compresses to 700px and 250KB to fit a browser, so
               after this line the writer's real artwork is gone and its
               dimensions are unknowable. Reading them here is the only chance:
               without it, setting a cover through this dialog left the
               dashboard with nothing to check, and a writer who had just
               chosen a cover saw no cover findings at all — which reads as the
               check having passed rather than as never having run. */
            const result = await importImage(file, {
              maxEdge: COVER_MAX_EDGE,
              maxBytes: COVER_MAX_BYTES,
            });
            if (result.ok) {
              setNextCover(result.src);
              setCoverFile(file);
            } else setError(result.error);
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
                       font-medium text-accent-ink outline-none transition-colors
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
