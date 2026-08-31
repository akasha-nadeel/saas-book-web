"use client";

import { useEffect, useRef, useState } from "react";
import { BookCover } from "@/components/shelf/book-cover";
import { GENRES, suggestTarget } from "@/lib/book-kinds";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
} from "@/lib/image-import";
import {
  bookWordCount,
  setBareCover,
  setBookDetails,
  setTargetWords,
  type Book,
} from "@/lib/library-store";
import { useCover } from "@/lib/use-library";
import { clearCover, saveCover } from "@/lib/cover-save";
import { SwitchTrack } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

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
  /**
   * The length the book is aiming at, as typed.
   *
   * A string rather than a number, because a half-typed "1" and an emptied
   * field are different intentions and `Number("")` flattens both to zero —
   * which `setTargetWords` reads as *remove the target*. Empty means remove;
   * anything that is not a number is ignored on save.
   */
  const [target, setTarget] = useState(
    /* Grouped, like the placeholder beside it and every other five-figure
       number in the app. The save strips the separators again. */
    book.targetWords ? book.targetWords.toLocaleString() : "",
  );
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

    /* Same rule for the target, and the same reason. A blank field is `0`,
       which `setTargetWords` already means by "no target at all".

       Digits only, rather than stripping the separators by name: the value
       arrives grouped by `toLocaleString()`, and which character that groups
       with is the reader's locale's business — a comma here, a full stop in
       Berlin, a non-breaking space in Paris. Stripping everything that is not
       a digit is right in all three, where `replace(/,/g, "")` turns 110.000
       into a target of 110. */
    const wanted = Number(target.replace(/[^0-9]/g, "") || "0");
    if (Number.isFinite(wanted) && wanted !== (book.targetWords ?? 0)) {
      setTargetWords(book.id, wanted);
    }

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
    /* **On the house pattern, which this dialog predates.**
​
       It used to roll its own: no `data-dialog-presentation`, so on a phone it
       fell into the catch-all in globals.css that makes an unmarked dialog a
       full-screen page with `overflow-y: auto` on the element itself — a second
       scroller wrapping the form's own. And the form carried `h-full
       overflow-y-auto`, which *guarantees* a scroll container whatever the
       content, against a height capped only by the browser's own
       `viewport − 38px`. Four labelled fields stacked in a 34rem column landed
       past 800px, so it scrolled on any ordinary laptop.

       `sheet` gives the phone a proper bottom sheet and the sticky footer for
       free; `oc-dialog-scroll` caps at `min(78dvh, …)` and contains the
       overscroll; `oc-dialog-actions` is the footer row every other dialog
       uses. The hand-rolled sticky bar that used to be down there is gone. */
    <dialog
      ref={dialogRef}
      data-dialog-presentation="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="oc-dialog m-auto w-[44rem] max-w-[calc(100vw-2rem)] rounded-lg
                 bg-tremor-background p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <form onSubmit={save} className="oc-dialog-scroll p-6">
        <h2 className="font-serif text-xl">Edit book details</h2>
        <p className="mt-1 font-sans text-sm text-tremor-content">
          What this book is, and how it appears on your shelf.
        </p>

        {/* **Two columns, because width buys height back.** The picture and
            the two controls that set it go down one side and the four fields
            down the other, which is about 180px of height moved sideways — the
            difference between a dialog that fits an ordinary window and one
            that scrolls. The same argument `upgrade-dialog.tsx` makes for its
            own width, and the same shape `matter-setup-dialog.tsx` uses.

            One column below `sm`, where there is no width to spend. */}
        <div className="mt-5 grid gap-6 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <div className="mx-auto w-36 sm:mx-0 sm:w-full">
            <BookCover
              title={title.trim() || "Untitled Book"}
              subtitle={subtitle.trim() || undefined}
              author={author.trim() || undefined}
              words={bookWordCount(book)}
              image={preview}
              bare={bare}
              seed={book.id}
            />

            <div className="mt-3 flex flex-col gap-2">
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
                  className="rounded-md px-3 py-2 font-sans text-sm text-tremor-content
                             outline-none transition-colors hover:bg-stop-bg
                             hover:text-danger focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>

          {/* **Title alone, then the two short ones paired.** Four labelled
              fields stacked is 330px of column against a picture that is only
              210 — the height the dialog could not afford. Subtitle and Author
              are both a few words and read perfectly well side by side, which
              takes a row out of the stack; the title keeps the full measure
              because it is the longest thing here and the one being read
              back. One column below `sm`, as everything else is. */}
          <div className="min-w-0">
            <label className="block font-sans text-sm">
              <span className="font-medium text-tremor-content-strong">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Book"
                autoFocus
                className="mt-1.5 w-full rounded-md border border-tremor-border bg-tremor-background-muted
                           px-3 py-2 text-tremor-content-strong placeholder:text-tremor-content
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block font-sans text-sm">
              <span className="font-medium text-tremor-content-strong">Subtitle</span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="A novel"
                className="mt-1.5 w-full rounded-md border border-tremor-border bg-tremor-background-muted
                           px-3 py-2 text-tremor-content-strong placeholder:text-tremor-content
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <label className="block font-sans text-sm">
              <span className="font-medium text-tremor-content-strong">Author</span>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="mt-1.5 w-full rounded-md border border-tremor-border bg-tremor-background-muted
                           px-3 py-2 text-tremor-content-strong placeholder:text-tremor-content
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>
            </div>

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
              <span className="font-medium text-tremor-content-strong">Genre</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-tremor-border bg-tremor-background-muted
                           px-3 py-2 text-tremor-content-strong focus-visible:border-accent
                           focus-visible:outline-none"
              >
                <option value="">Not sure yet</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-tremor-content">
                Comp titles, categories, blurb examples and structure all read
                this.
              </span>
            </label>

            {/* **How long the book is meant to be, editable at last.**

                It could only ever be set when a book was *made*. The two
                screens that can change one — the comp-title search and the
                structure report — are both hidden by the launch flag, so an
                imported book, or one made without a figure, had no way to gain
                a target and the dial on its card had nothing to draw.

                The placeholder is `suggestTarget(genre)`, the same figure
                `/book/new` offers for the genre chosen right above, so the two
                screens cannot suggest different lengths for one kind of book.
                It is a *placeholder*: nothing is stored until the writer types
                a number, because a suggested length silently saved as a goal is
                the invented figure this app refuses everywhere else.

                Empty clears the target, which is what `setTargetWords` already
                means by zero, and the hint says so — a field that quietly
                deletes a goal when blanked is a trap. */}
            <label className="mt-4 block font-sans text-sm">
              <span className="font-medium text-tremor-content-strong">
                Target length
              </span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="numeric"
                placeholder={
                  genre
                    ? suggestTarget(genre).toLocaleString()
                    : "No length to aim at"
                }
                className="mt-1.5 w-full rounded-md border border-tremor-border bg-tremor-background-muted
                           px-3 py-2 text-tremor-content-strong placeholder:text-tremor-content
                           focus-visible:border-accent focus-visible:outline-none"
              />
              <span className="mt-1 block text-xs text-tremor-content">
                Words. {bookWordCount(book).toLocaleString()} written so far.
                Leave it empty for no target.
              </span>
            </label>
          </div>
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
            className="mt-3 flex w-full items-start gap-3 rounded-md border
                       border-tremor-border px-3 py-2.5 text-left outline-none
                       transition-colors hover:bg-tremor-background-subtle
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <SwitchTrack on={bare} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block font-sans text-sm font-medium text-tremor-content-strong">
                The artwork already has the words on it
              </span>
              <span className="mt-0.5 block font-sans text-xs text-tremor-content">
                Show the picture as it is, with no title, subtitle or author
                printed over it. The fields above are still used for the
                shops and the exported book.
              </span>
            </span>
          </button>
        )}

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
                       px-3 py-2.5 font-sans text-sm text-tremor-content-strong"
          >
            {error}
          </p>
        )}

        {/* `oc-dialog-actions` rather than the sticky bar that used to be
            hand-written here: the sheet presentation gives a phone the same
            thing in CSS, and every other dialog in the app already reads from
            that one rule. */}
        <div className="oc-dialog-actions mt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </dialog>
  );
}
