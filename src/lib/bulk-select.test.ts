import { describe, expect, it } from "vitest";
import {
  actionsFor,
  chosen,
  favouriteIntent,
  needsConfirming,
  planRestore,
  rangeBetween,
  restoreCapacity,
  selectAll,
  toggle,
} from "@/lib/bulk-select";
import { LAUNCH_LIMITS } from "@/lib/launch";
import type { Book, Shelf } from "@/lib/library-store";

/** Just enough of a book for rules that only read ids and three flags. */
const book = (id: string, extra: Partial<Book> = {}) =>
  ({ id, title: id, chapters: [], ...extra }) as unknown as Book;

const list = [book("a"), book("b"), book("c"), book("d"), book("e")];

const shelfOf = (books: Book[]): Shelf =>
  ({ books, lastOpenedBookId: null }) as Shelf;

describe("actionsFor", () => {
  /**
   * The reason this is a function rather than one row of buttons. Restore means
   * nothing on the active shelf, and "delete for good" outside the trash would
   * skip the bin the trash exists to be.
   */
  it("offers each view only what makes sense there", () => {
    expect(actionsFor("active")).toEqual(["favourite", "archive", "trash"]);
    expect(actionsFor("favourite")).toEqual([
      "unfavourite",
      "archive",
      "trash",
    ]);
    expect(actionsFor("archived")).toEqual(["restore", "trash"]);
    expect(actionsFor("trashed")).toEqual(["restore", "erase"]);
  });

  it("never offers restore where there is nothing to restore from", () => {
    expect(actionsFor("active")).not.toContain("restore");
    expect(actionsFor("favourite")).not.toContain("restore");
  });

  it("keeps erase to the trash alone", () => {
    for (const view of ["active", "favourite", "archived"] as const) {
      expect(actionsFor(view)).not.toContain("erase");
    }
  });
});

describe("needsConfirming", () => {
  it("asks before the two that cannot be walked back here", () => {
    expect(needsConfirming("trash")).toBe(true);
    expect(needsConfirming("erase")).toBe(true);
  });

  it("does not interrupt the reversible ones", () => {
    expect(needsConfirming("archive")).toBe(false);
    expect(needsConfirming("restore")).toBe(false);
    expect(needsConfirming("favourite")).toBe(false);
  });
});

describe("toggle", () => {
  it("adds what is not there and removes what is", () => {
    expect([...toggle(new Set(), "a")]).toEqual(["a"]);
    expect([...toggle(new Set(["a"]), "a")]).toEqual([]);
  });

  it("does not mutate the set it was given", () => {
    const before = new Set(["a"]);
    toggle(before, "b");
    expect([...before]).toEqual(["a"]);
  });
});

describe("rangeBetween", () => {
  it("takes everything between the two, inclusive", () => {
    const got = rangeBetween(list, new Set(), "b", "d");
    expect([...got].sort()).toEqual(["b", "c", "d"]);
  });

  /* Dragging upwards must give the same books as dragging downwards — the
     order is the list's, not the order the two were clicked in. */
  it("reads the same in both directions", () => {
    const down = rangeBetween(list, new Set(), "b", "d");
    const up = rangeBetween(list, new Set(), "d", "b");
    expect([...down].sort()).toEqual([...up].sort());
  });

  it("extends a selection rather than replacing it", () => {
    const got = rangeBetween(list, new Set(["e"]), "a", "b");
    expect([...got].sort()).toEqual(["a", "b", "e"]);
  });

  // A book deleted in another tab between the two clicks.
  it("falls back to the one clicked when the anchor has gone", () => {
    const got = rangeBetween(list, new Set(), "missing", "c");
    expect([...got]).toEqual(["c"]);
  });
});

describe("selectAll and chosen", () => {
  it("takes every book in the list", () => {
    expect(selectAll(list).size).toBe(5);
  });

  it("returns the chosen books in the list's own order", () => {
    const got = chosen(list, new Set(["d", "a"]));
    expect(got.map((b) => b.id)).toEqual(["a", "d"]);
  });
});

describe("favouriteIntent", () => {
  /**
   * Must not become "flip each book". A mixed selection has to do one
   * predictable thing, and adding is the one that is never destructive.
   */
  it("adds unless every book is already a favourite", () => {
    expect(favouriteIntent([book("a"), book("b")])).toBe("add");
    expect(
      favouriteIntent([book("a", { favourite: true }), book("b")]),
    ).toBe("add");
  });

  it("removes only when they all are", () => {
    expect(
      favouriteIntent([
        book("a", { favourite: true }),
        book("b", { favourite: true }),
      ]),
    ).toBe("remove");
  });

  it("adds for an empty selection, there being nothing to take away", () => {
    expect(favouriteIntent([])).toBe("add");
  });
});

describe("restoreCapacity", () => {
  it("holds nothing back when the plan does not apply", () => {
    expect(restoreCapacity(shelfOf([]), false)).toBe(Infinity);
  });

  it("counts the free allowance down as the shelf fills", () => {
    const shelf = shelfOf([book("a"), book("b")]);
    expect(restoreCapacity(shelf, true)).toBe(LAUNCH_LIMITS.freeBooks - 2);
  });

  /**
   * An archived book already spends its slot, so it is counted here and
   * unarchiving is never refused — the same rule the single-book restore
   * makes. Trashed books are not counted, which is what leaves room to take
   * one back out.
   */
  it("counts the archive against the plan and the trash not at all", () => {
    const shelf = shelfOf([
      book("a"),
      book("b", { archivedAt: 1 }),
      book("c", { trashedAt: 1 }),
      book("d", { trashedAt: 1 }),
    ]);
    expect(restoreCapacity(shelf, true)).toBe(LAUNCH_LIMITS.freeBooks - 2);
  });

  it("never goes below zero on an over-full shelf", () => {
    const many = Array.from({ length: LAUNCH_LIMITS.freeBooks + 3 }, (_, i) =>
      book(`b${i}`),
    );
    expect(restoreCapacity(shelfOf(many), true)).toBe(0);
  });
});

describe("planRestore", () => {
  it("only asks for room for the books coming out of the trash", () => {
    const picked = [book("a", { trashedAt: 1 }), book("b", { archivedAt: 1 })];
    const plan = planRestore(picked, shelfOf([]), true);
    expect(plan.needRoom.map((b) => b.id)).toEqual(["a"]);
  });

  it("fits when the plan does not apply at all", () => {
    const picked = Array.from({ length: 50 }, (_, i) =>
      book(`t${i}`, { trashedAt: 1 }),
    );
    expect(planRestore(picked, shelfOf([]), false).fits).toBe(true);
  });

  /* All or nothing: the writer chose five books, not "whichever two fit". */
  it("refuses the whole batch when it does not fit", () => {
    const shelf = shelfOf(
      Array.from({ length: LAUNCH_LIMITS.freeBooks - 1 }, (_, i) =>
        book(`b${i}`),
      ),
    );
    const picked = [
      book("x", { trashedAt: 1 }),
      book("y", { trashedAt: 1 }),
      book("z", { trashedAt: 1 }),
    ];
    const plan = planRestore(picked, shelf, true);
    expect(plan.room).toBe(1);
    expect(plan.fits).toBe(false);
  });

  it("allows a batch that exactly fills the last slots", () => {
    const shelf = shelfOf(
      Array.from({ length: LAUNCH_LIMITS.freeBooks - 2 }, (_, i) =>
        book(`b${i}`),
      ),
    );
    const picked = [book("x", { trashedAt: 1 }), book("y", { trashedAt: 1 })];
    expect(planRestore(picked, shelf, true).fits).toBe(true);
  });
});
