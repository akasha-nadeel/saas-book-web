import { LAUNCH_LIMITS } from "./launch";
import { booksAgainstPlan, type Book, type Shelf } from "./library-store";

/**
 * Acting on several books at once.
 *
 * The shelf could only ever do one book at a time, through its ⋯ menu — so a
 * trash holding thirty-four books was thirty-four menus and thirty-four
 * confirmations, and nobody empties it.
 *
 * The rules live here rather than in the component for the usual reason: the
 * component is not tested and these are the parts that can be quietly wrong —
 * which actions a view may offer, which way a favourite toggle points, and
 * whether a restore fits inside the plan.
 */

/** The four lists the shelf shows. Mirrors `ShelfView` in `bookshelf.tsx`. */
export type SelectView = "active" | "favourite" | "archived" | "trashed";

/**
 * What may be done to a selection, per view.
 *
 * **They genuinely differ**, which is the whole reason this is a function and
 * not one row of buttons: Restore means nothing on the active shelf, and
 * "Delete for good" outside the trash would skip the bin entirely.
 */
export type BulkAction =
  | "favourite"
  | "unfavourite"
  | "archive"
  | "trash"
  | "restore"
  | "erase";

export function actionsFor(view: SelectView): BulkAction[] {
  switch (view) {
    case "active":
      return ["favourite", "archive", "trash"];
    case "favourite":
      // No Archive-then-Favourite muddle: from the favourites list the useful
      // verbs are to stop favouriting, to put away, or to bin.
      return ["unfavourite", "archive", "trash"];
    case "archived":
      return ["restore", "trash"];
    case "trashed":
      return ["restore", "erase"];
  }
}

/** The two that cannot be walked back from this screen, so they are confirmed. */
export function needsConfirming(action: BulkAction): boolean {
  return action === "trash" || action === "erase";
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

export function selectAll(books: readonly Book[]): Set<string> {
  return new Set(books.map((b) => b.id));
}

/**
 * Every book between two, inclusive — shift-click.
 *
 * **Order is the list's, not the click's**, so dragging a selection upwards
 * gives the same books as downwards. Anything the caller had selected already
 * is kept: shift-click extends a selection, it does not replace one.
 *
 * An id that is not in the list (a book deleted in another tab between the two
 * clicks) falls back to the single book clicked, rather than selecting nothing
 * or throwing.
 */
export function rangeBetween(
  books: readonly Book[],
  selected: ReadonlySet<string>,
  anchorId: string,
  id: string,
): Set<string> {
  const from = books.findIndex((b) => b.id === anchorId);
  const to = books.findIndex((b) => b.id === id);
  if (from === -1 || to === -1) return toggle(selected, id);

  const next = new Set(selected);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  for (let i = lo; i <= hi; i++) next.add(books[i].id);
  return next;
}

/** The selected books, in the list's own order. */
export function chosen(
  books: readonly Book[],
  selected: ReadonlySet<string>,
): Book[] {
  return books.filter((b) => selected.has(b.id));
}

/**
 * Which way the one favourite button points.
 *
 * Remove only when **every** selected book is already a favourite — otherwise
 * the press adds, which is what makes a mixed selection do something
 * predictable rather than flipping each book to its opposite. The convention
 * Gmail and Drive both use.
 *
 * An empty selection adds; there is nothing to un-favourite.
 */
export function favouriteIntent(books: readonly Book[]): "add" | "remove" {
  if (books.length === 0) return "add";
  return books.every((b) => b.favourite) ? "remove" : "add";
}

// ---------------------------------------------------------------------------
// Room on the plan
// ---------------------------------------------------------------------------

/**
 * How many books may still come **out of the trash**.
 *
 * `Infinity` on Pro, and whenever no gateway is configured — a self-hosted copy
 * holds nothing back.
 *
 * **Only a trashed book is counted against the plan.** An archived book already
 * spends its slot (`booksAgainstPlan` counts both active and archived), so
 * unarchiving hands back something the plan was already counting and must never
 * be refused — that is the rule `handleRestore` makes one book at a time, and
 * this is the same test so the two cannot drift.
 */
export function restoreCapacity(shelf: Shelf, gated: boolean): number {
  if (!gated) return Infinity;
  return Math.max(0, LAUNCH_LIMITS.freeBooks - booksAgainstPlan(shelf).length);
}

export interface RestorePlan {
  /** The ones that need a slot — everything else is free to go back. */
  needRoom: Book[];
  room: number;
  /** Whether the whole selection fits. Nothing is restored unless it does. */
  fits: boolean;
}

/**
 * Whether a bulk restore may go ahead.
 *
 * **All or nothing.** Filling the free slots and leaving the rest behind is a
 * partly-completed action the writer did not choose the shape of — they picked
 * five books, not "whichever two happen to fit". So this reports, the screen
 * says how many would fit, and the writer decides.
 */
export function planRestore(
  books: readonly Book[],
  shelf: Shelf,
  gated: boolean,
): RestorePlan {
  const needRoom = books.filter((b) => b.trashedAt);
  const room = restoreCapacity(shelf, gated);
  return { needRoom, room, fits: needRoom.length <= room };
}
