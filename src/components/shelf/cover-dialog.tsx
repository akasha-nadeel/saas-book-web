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
  setBareCover,
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
  /* Whether the artwork is left alone — see `setBareCover`. In the draft like
     everything else here, so the preview beside the fields answers before the
     writer commits to it. */
  const [bare, setBare] = useState(Boolean(book.bareCover));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const preview = cover === undefined ? storedCover : cover;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    setBookDetails(book.id, { title, subtitle, author, genre });

    /* Only when it moved. `setBareCover` is a commit of its own — a second
       shelf write, a second fan-out and a second push — and saving a retyped
       subtitle should not spend one on a field nobody touched. */
    if (bare !== Boolean(book.bareCover)) setBareCover(book.id, bare);

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
              bare={bare}
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* **Filled with `bg-fg`/`text-surface`, never a literal black.**
                  The same pair the covers tool's "Check another" uses, and for
                  the same reason: the two tokens invert *with* the palette, so
                  this is near-black carrying white by day and near-white
                  carrying black at night — where a typed `bg-black text-white`
                  is a black hole in a black screen after sunset, which is the
                  one way to get a filled control wrong here.

                  It is not `bg-accent`: the accent means "the way forward",
                  and the way forward on this dialog is Save. */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md bg-fg px-3 py-2 font-sans text-sm
                           font-medium text-surface outline-none
                           transition-opacity hover:opacity-90
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
                    /* The words come back with the artwork's departure. A
                       typeset face *is* the title, so a book left "bare" with
                       no picture would be a blank cloth cover with nothing on
                       it — and the flag would then lie in wait for the next
                       image, hiding the title on artwork nobody had said that
                       about. */
                    setBare(false);
                    setError(null);
                  }}
                  /* Quiet until hovered, then the status family's red. It
                     throws the artwork away, so it carries the danger colour —
                     but sitting permanently red beside a filled control it
                     would read as the primary action of the pair, which it is
                     the opposite of. Same treatment as the covers tool's own
                     Remove. */
                  className="rounded-md px-3 py-2 font-sans text-sm text-muted
                             outline-none transition-colors hover:bg-stop-bg
                             hover:text-danger focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  Remove image
                </button>
              )}
            </div>

            {/* **Whose words go on the front.**

                A designed jacket already carries the title, the subtitle and
                the byline, set by somebody who chose where they sit — and the
                shelf printed ours over the top of theirs, which is worse than
                showing nothing. `bareCover` and every reader of it have been
                in the store since the field was added; what was missing was
                anywhere to say so. This is that control, and it is here rather
                than on the covers tool because the question is about the
                *relationship* between the three fields above and the picture
                beside them — both are on this screen and nowhere else at once.

                Only with artwork, because `BookCover` ignores it without: a
                typeset face is the title, so hiding the words there would
                leave a blank cloth cover.

                The hint is not a nicety. The fields stay in the book and go on
                driving the EPUB's metadata, the title page and the shop
                listing — this changes the picture and nothing else — and a
                writer who reads "hide the title" without that has every reason
                to think they are deleting it. */}
            {preview && (
              <button
                type="button"
                role="switch"
                aria-checked={bare}
                onClick={() => setBare(!bare)}
                className="mt-4 flex w-full items-start gap-3 rounded-md border
                           border-line px-3 py-3 text-left outline-none
                           transition-colors hover:bg-raised
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <SwitchTrack on={bare} />
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-sm font-medium text-fg">
                    The artwork already has the words on it
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-muted">
                    Show the picture as it is, with no title, subtitle or author
                    printed over it. The fields above are still used for the
                    shops and the exported book.
                  </span>
                </span>
              </button>
            )}
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

/**
 * The track and thumb behind the one switch on this dialog.
 *
 * Drawn here rather than pulled into `ui/`, which is deliberately two files
 * wide and takes a primitive on the third copy rather than the second: the
 * export wizard has the only other one. If a third screen wants a switch, that
 * is the moment to extract this and `SwitchTrack` in `export-page.tsx`
 * together — not before.
 *
 * `bg-accent` with an `accent-ink` thumb, because the fill is white at night
 * and near-black by day; a fixed `bg-white` thumb is invisible in exactly one
 * theme, which is the half nobody tests.
 */
function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5
                  transition-colors ${
                    on ? "bg-accent" : "bg-raised ring-1 ring-line ring-inset"
                  }`}
    >
      <span
        className={`h-4 w-4 rounded-full transition-transform ${
          on ? "translate-x-4 bg-accent-ink" : "bg-muted"
        }`}
      />
    </span>
  );
}
