"use client";

import Link from "next/link";
import { findBook } from "@/lib/library-store";
import { trashedBookClosed } from "@/lib/launch";
import { usePlan } from "@/lib/use-plan";
import { useHydrated, useShelf } from "@/lib/use-library";
import { DialogClose, Divider, Shell } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The free plan's one closed door, in its two faces.
 *
 * A book in the trash is on its way out of the shelf, and on the free plan it
 * cannot be read where it lies: restoring it is what reading it is for. Pro
 * opens one where it sits.
 *
 * **Both faces are needed because a card is not a route.** `TrashedBookDialog`
 * is what the jacket's press opens on the shelf; `TrashedBookGate` is what a
 * pasted or bookmarked `/book/<id>/…` URL meets. Without the second the first
 * is decoration — the editor is one address away. Both ask
 * `trashedBookClosed()` rather than testing the plan themselves, so they cannot
 * come to two answers about one book.
 *
 * **It is a browser gate and is honest about it** — see the note on
 * `trashedBookClosed`. The manuscript is already on this machine, so this keeps
 * the trash from being a second shelf; it does not pretend to be a lock.
 */

export function TrashedBookDialog({
  title,
  onRestore,
  onClose,
}: {
  /** The book's own title, so the question names what it is about. */
  title: string;
  /**
   * Put it back and open it.
   *
   * The screen above owns this, not the dialog: a restore on the free plan can
   * itself be refused for want of room, and that refusal has its own dialog
   * (`UpgradeDialog reason="restore"`). One question at a time.
   */
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <Shell onClose={onClose}>
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        “{title}” is in the trash
      </h2>
      <p className="mt-2 font-sans text-sm leading-6 text-tremor-content">
        Free opens the books on your shelf. Put this one back to read it — Pro
        opens a book where it sits, trash and all.{" "}
        <Link
          href="/upgrade"
          className="font-medium text-tremor-brand underline
                     underline-offset-2 outline-none hover:opacity-80
                     focus-visible:ring-2 focus-visible:ring-tremor-brand/60"
        >
          See what Pro costs
        </Link>
        .
      </p>

      <Divider />

      {/* The documented order: cancel, then the action. Restore is not
          destructive — it is the way back to the book — so it is the primary
          fill rather than the red one. */}
      <div className="oc-dialog-actions flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          autoFocus
          onClick={() => {
            onRestore();
            onClose();
          }}
        >
          Restore it
        </Button>
      </div>
    </Shell>
  );
}

/**
 * The same rule at the door of every screen under `/book/[bookId]`.
 *
 * Mounted in that layout, so the editor, the export wizard and the consistency
 * check are all behind it with one mount — "the inside of the book" is every
 * one of them, and a gate on the redirect alone would leave the chapter URL
 * open.
 *
 * **Nothing is refused while the answer is still unknown.** Storage has to have
 * been read (`useHydrated`) and the plan has to have arrived (`onFreePlan`
 * inside `trashedBookClosed` tests `loading`) before this closes anything; a
 * book the shelf has not downloaded yet is simply not found, and the page
 * below handles that as it always did. The safe direction is *through*.
 */
export function TrashedBookGate({
  bookId,
  children,
}: {
  bookId: string;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = hydrated ? findBook(shelf, bookId) : null;

  /**
   * **The plan is only asked about when the answer could matter.**
   *
   * `usePlan()` fetches per mount, and this layout wraps every screen inside
   * every book — a hook called here unconditionally would put a billing
   * request on the front of opening any chapter, to decide something that is
   * false for all but a handful of books. So the trash question is answered
   * from the shelf, which is already in memory, and only a book that *is* in
   * the trash mounts the half that asks.
   *
   * Not found is not shut: a book still coming down from the server, or one
   * on a machine that has not read storage yet, goes through. The route below
   * draws its own wait, and the safe direction here is always *through*.
   */
  if (!book?.trashedAt) return <>{children}</>;

  return <ClosedIfFree book={book}>{children}</ClosedIfFree>;
}

function ClosedIfFree({
  book,
  children,
}: {
  book: { title: string; trashedAt?: number | null };
  children: React.ReactNode;
}) {
  const plan = usePlan();

  /* Through while the plan is still unknown — see `onFreePlan`. A Pro reader
     is shaped exactly like a free one for the width of one request, and
     refusing during it is the bug the shelf's restore gate already shipped. */
  if (!trashedBookClosed(book, plan)) return <>{children}</>;

  /* **It stands still and explains rather than bouncing.** A silent
     `router.replace` back to the shelf would drop the writer on a screen that
     says nothing about where the one they asked for went — and they typed this
     address on purpose. The two ways out are ordinary links. */
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
        <h1 className="font-serif text-xl text-fg">
          “{book.title}” is in the trash
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Free opens the books on your shelf. Put this one back from the trash
          to read it — Pro opens a book where it sits.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/?area=write"
            className="rounded-lg border border-line bg-surface px-4 py-2
                       text-sm font-semibold text-fg transition-colors
                       hover:bg-raised"
          >
            Back to the shelf
          </Link>
          <Link
            href="/upgrade"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold
                       text-accent-ink transition-opacity hover:opacity-90"
          >
            See what Pro costs
          </Link>
        </div>
      </div>
    </div>
  );
}
