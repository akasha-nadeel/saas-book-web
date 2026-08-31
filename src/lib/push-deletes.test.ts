import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * That deleting a book actually tells the server.
 *
 * **The regression test for books coming back from the dead.** The shelf works
 * out what to remove remotely by diffing against `pushedBooks`, its record of
 * what the server holds — and that record began life as `[]`, which is not
 * "unknown" but a claim that the server is empty. The deletion loop iterates
 * what has *left* the baseline, so an empty one finds nothing to delete however
 * many books were removed.
 *
 * It was seeded only by a successful download, and `applyRemote` returns early
 * when the fetch failed. One dropped request left it empty for the whole
 * session: the next book deleted was never deleted on the server, and the
 * following load downloaded it straight back.
 *
 * **The shape of the bug is the shape of these tests.** It only bites on the
 * *first* commit of a session, over books that were already in storage — so
 * each test writes the shelf into `localStorage` by hand and re-imports the
 * store with `resetModules`, because a `createBook()` first would seed the
 * baseline itself and hide the whole thing. An earlier version of this file did
 * exactly that and passed against the unfixed code.
 */

const SHELF_KEY = "openchapter:shelf";

const pushBookDeleted = vi.fn();

vi.mock("@/lib/sync", () => ({
  pushBookDeleted: (id: string) => pushBookDeleted(id),
  pushChapterDeleted: vi.fn(),
  // `fetchLibrary` resolving to null is the failed download this is about.
  fetchLibrary: vi.fn(async () => null),
  hasClaimed: vi.fn(async () => true),
  currentOwner: vi.fn(async () => null),
  pushBody: vi.fn(),
  pushBook: vi.fn(),
  pushCover: vi.fn(),
  pushNotes: vi.fn(),
  pushPrefs: vi.fn(),
  seedBodyRevs: vi.fn(),
  setConflictHandler: vi.fn(),
  uploadLibrary: vi.fn(async () => false),
}));

/** A book as the shelf stores one, with only the fields the diff reads. */
const stored = (id: string, title: string) => ({
  id,
  title,
  chapters: [],
  lastOpenedId: null,
  lastOpenedAt: 1,
});

/**
 * A shelf already in storage, and a store that has never committed.
 *
 * `resetModules` is the point: `pushedBooks` is module-level, so without it the
 * previous test's commit would have seeded the baseline and the case under test
 * could not happen.
 */
async function sessionWith(books: ReturnType<typeof stored>[]) {
  localStorage.clear();
  localStorage.setItem(
    SHELF_KEY,
    JSON.stringify({ books, lastOpenedBookId: null }),
  );
  vi.resetModules();
  return import("@/lib/library-store");
}

beforeEach(() => {
  pushBookDeleted.mockClear();
});

describe("deleting a book tells the server", () => {
  it("pushes the deletion on the first write of a session", async () => {
    const store = await sessionWith([stored("a", "The Salt Road")]);

    store.deleteBook("a");

    expect(pushBookDeleted).toHaveBeenCalledWith("a");
  });

  /**
   * The shape of a bulk delete. The original bug lost exactly the first, which
   * is the one nobody notices until it reappears.
   */
  it("pushes every deletion in a batch, the first included", async () => {
    const store = await sessionWith([
      stored("a", "One"),
      stored("b", "Two"),
      stored("c", "Three"),
    ]);

    for (const id of ["a", "b", "c"]) store.deleteBook(id);

    expect(pushBookDeleted).toHaveBeenCalledTimes(3);
    for (const id of ["a", "b", "c"]) {
      expect(pushBookDeleted).toHaveBeenCalledWith(id);
    }
  });

  it("leaves the other books alone", async () => {
    const store = await sessionWith([
      stored("keep", "Keep"),
      stored("drop", "Drop"),
    ]);

    store.deleteBook("drop");

    expect(pushBookDeleted).toHaveBeenCalledTimes(1);
    expect(pushBookDeleted).toHaveBeenCalledWith("drop");
    expect(store.findBook(store.getShelf(), "keep")).toBeTruthy();
  });

  it("says nothing for a book that is only trashed", async () => {
    // Trashing is a flag, not a removal: the row stays so it can be restored.
    const store = await sessionWith([stored("a", "Northlight")]);

    store.trashBook("a");

    expect(pushBookDeleted).not.toHaveBeenCalled();
  });
});
