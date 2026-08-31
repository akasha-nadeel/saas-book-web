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
const DELETED_KEY = "openchapter:deleted";
const OWNER_KEY = "openchapter:owner";

const pushBookDeleted = vi.fn();
/**
 * Hoisted, unlike the rest, because the tombstone tests have to answer with a
 * library and a session where the older tests need neither. A `vi.fn()` created
 * inside the factory cannot be reconfigured from a test — there is no handle on
 * it — and `vi.resetModules()` between tests would hand back a fresh one anyway.
 */
const fetchLibrary = vi.fn(async (): Promise<unknown> => null);
const currentOwner = vi.fn(async (): Promise<string | null> => null);

vi.mock("@/lib/sync", () => ({
  pushBookDeleted: (id: string) => pushBookDeleted(id),
  pushChapterDeleted: vi.fn(),
  // `fetchLibrary` resolving to null is the failed download the older tests are
  // about; the tombstone ones hand back a library. The shelf it is handed is
  // dropped rather than declared — the real one reads it only to keep per-writer
  // fields, and nothing here asserts on that.
  fetchLibrary: () => fetchLibrary(),
  hasClaimed: vi.fn(async () => true),
  currentOwner: () => currentOwner(),
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
  fetchLibrary.mockClear();
  fetchLibrary.mockResolvedValue(null);
  currentOwner.mockClear();
  currentOwner.mockResolvedValue(null);
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

/**
 * That a delete nobody could deliver is delivered later.
 *
 * **The queue forgets; the tombstone does not.** `flush()` clears every pending
 * job the moment it finds no session — right, and documented there, because
 * pushing one writer's rows under nobody's session is how they land in somebody
 * else's account. But a `book:<id>` delete cleared that way is gone: nothing
 * re-queues it, so the row stays on the server, and `applyRemote` writes the
 * server's list over the local one on the next load and hands the writer back
 * the book they deleted. Deleting it again does the same thing again.
 *
 * So the intent is written to `openchapter:deleted` and settled against each
 * download. These four cover the whole cycle: written, re-pushed while the
 * server still has it, forgotten when the server agrees, and abandoned after
 * ninety days.
 */
describe("a deletion that could not be delivered", () => {
  /** What `fetchLibrary` hands back, with only the fields the store reads. */
  const library = (books: ReturnType<typeof stored>[]) => ({
    shelf: { books, lastOpenedBookId: null },
    bodies: new Map(),
    notes: new Map(),
    covers: new Map(),
    revs: new Map(),
    prefs: null,
  });

  /** The tombstones in storage, oldest first. */
  const standing = () =>
    JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]") as {
      id: string;
      at: number;
    }[];

  /**
   * A signed-in session for the *download*, with the owner already recorded.
   *
   * `reconcile` wipes the local library when the recorded owner differs from
   * the one signing in — which would take the tombstones with it, since they
   * are `openchapter:` keys like everything else. Recording the owner up front
   * is what the second load of a real session looks like.
   */
  const signedIn = (owner = "writer-1") => {
    localStorage.setItem(OWNER_KEY, owner);
    currentOwner.mockResolvedValue(owner);
  };

  it("writes a tombstone when the book is deleted", async () => {
    const store = await sessionWith([stored("a", "The Salt Road")]);

    store.deleteBook("a");

    expect(standing().map((t) => t.id)).toEqual(["a"]);
  });

  it("deletes it again, and keeps it off the shelf, while the server still has it", async () => {
    const store = await sessionWith([stored("a", "The Salt Road")]);
    store.deleteBook("a");
    pushBookDeleted.mockClear();

    // The download this browser could not reach when it deleted: the book is
    // still there, because the push was cleared with the queue.
    signedIn();
    fetchLibrary.mockResolvedValue(library([stored("a", "The Salt Road")]));
    await store.syncWithServer();

    expect(pushBookDeleted).toHaveBeenCalledWith("a");
    // And the merge must not hand it back in the meantime.
    expect(store.getShelf().books).toEqual([]);
    expect(standing().map((t) => t.id)).toEqual(["a"]);
  });

  it("forgets the tombstone once the server no longer has the book", async () => {
    const store = await sessionWith([stored("a", "The Salt Road")]);
    store.deleteBook("a");

    signedIn();
    fetchLibrary.mockResolvedValue(library([]));
    await store.syncWithServer();

    expect(standing()).toEqual([]);

    // Nothing left to re-push on the load after that.
    pushBookDeleted.mockClear();
    await store.syncWithServer();
    expect(pushBookDeleted).not.toHaveBeenCalled();
  });

  it("gives up on a tombstone after ninety days rather than haunting the library", async () => {
    const store = await sessionWith([stored("keep", "Keep")]);
    const ancient = Date.now() - 91 * 86_400_000;
    localStorage.setItem(
      DELETED_KEY,
      JSON.stringify([{ id: "old", at: ancient }]),
    );

    signedIn();
    // The server still lists it — and it is still let through, because a delete
    // nobody could deliver in three months is not going to be delivered.
    fetchLibrary.mockResolvedValue(
      library([stored("keep", "Keep"), stored("old", "Long gone")]),
    );
    await store.syncWithServer();

    expect(pushBookDeleted).not.toHaveBeenCalled();
    expect(standing()).toEqual([]);
    expect(store.getShelf().books.map((b) => b.id).sort()).toEqual([
      "keep",
      "old",
    ]);
  });
});
