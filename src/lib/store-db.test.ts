/**
 * The library on IndexedDB.
 *
 * **`fake-indexeddb/auto` is imported here and nowhere else, deliberately.**
 * Vitest isolates modules per file, so every *other* suite runs with no
 * IndexedDB at all — which is not a gap, it is the second half of the coverage:
 * that configuration is Firefox in private browsing and any browser with the
 * database walled off, and it must go on behaving exactly as the app did before
 * this existed. Those 1600-odd tests are the proof that it does.
 *
 * What is proved here is the half they cannot see: that the move happens, that
 * it survives being interrupted, that a value written in this session is still
 * there in the next one, and that nothing reads an empty library while the disk
 * is still being read — which is the one failure in this change that could
 * overwrite a manuscript with a blank page.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/**
 * The store, freshly loaded — new mirrors, new phase, the same disk.
 *
 * **The transport comes back with it, out of the same module graph.**
 * `vi.resetModules()` gives `library-store` a *new* instance of `store-db`, so a
 * test that reached for the seam through a separate `import("./store-db")`
 * would be arming a copy nothing was using. That silently passed as a
 * successful write, which is the failure it was written to rule out.
 */
async function freshStore() {
  vi.resetModules();
  const db = await import("./store-db");
  const covers = await import("./cover-store");
  const store = await import("./library-store");
  return { store, db, covers };
}

/** A new tab, in the sense that matters: new module state, same disk. */
async function reopen() {
  const { store } = await freshStore();
  await store.loadFromDisk();
  return store;
}

beforeEach(() => {
  localStorage.clear();
  // A brand-new database each time. Deleting rather than clearing, so the
  // upgrade path — where the object stores are created — is exercised by every
  // one of these rather than only the first.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("is not readable until the disk has been read", async () => {
  const { store } = await freshStore();

  // The gate every screen sits behind. False here and the editor would mount
  // Tiptap over a null body, keep its empty document when the prose arrived —
  // the surface is keyed on the chapter id, not the text — and autosave that
  // empty document over the chapter.
  expect(store.getStoragePhase()).toBe("loading");

  await store.loadFromDisk();
  expect(store.getStoragePhase()).toBe("ready");
});

it("refuses to save while the disk is still being read", async () => {
  const { store } = await freshStore();
  const { bookId, chapterId } = store.createBook("A");

  // Rejects rather than answering false: false is the viewer refusal and means
  // *do not retry*, where this clears itself in a few hundred milliseconds and
  // the autosave's backoff should come back for it.
  await expect(
    store.saveBody(bookId, chapterId, { type: "doc" }, 5),
  ).rejects.toThrow(/still loading/);
});

it("keeps a chapter across a reload", async () => {
  const first = await reopen();
  const { bookId, chapterId } = first.createBook("The Salt Road");
  await first.saveBody(bookId, chapterId, { type: "doc", content: [1] }, 5);

  // New mirrors, so this can only come off the disk. That is the assertion the
  // localStorage suite cannot make: there, a write and a read are the same map.
  const next = await reopen();
  expect(next.getBody(chapterId)).toContain('"content":[1]');
});

it("moves what localStorage was already holding, and clears it out", async () => {
  localStorage.setItem("openchapter:chapter:c1", '{"type":"doc"}');
  localStorage.setItem("openchapter:notes:c1", "a note");
  localStorage.setItem("openchapter:history:c1", "[]");
  localStorage.setItem("openchapter:cover:b1", "data:image/jpeg;base64,AAA");

  const store = await reopen();

  expect(store.getBody("c1")).toBe('{"type":"doc"}');
  expect(store.getNotes("c1")).toBe("a note");
  expect(store.getHistoryRaw("c1")).toBe("[]");
  expect(store.getCover("b1")).toBe("data:image/jpeg;base64,AAA");

  // The point of the exercise: the five-megabyte budget is given back.
  expect(localStorage.getItem("openchapter:chapter:c1")).toBeNull();
  expect(localStorage.getItem("openchapter:cover:b1")).toBeNull();

  // And it survives the tab closing.
  expect((await reopen()).getBody("c1")).toBe('{"type":"doc"}');
});

/**
 * The shelf, prefs and owner stay where they are, and that is not an oversight.
 *
 * `layout.tsx` reads prefs in an inline `<script>` before React to set the theme
 * pre-paint and IndexedDB cannot serve that; the shelf is the index every screen
 * paints from and keeping it synchronous keeps first paint instant. Most of the
 * risk in this change is avoided by not moving them.
 */
it("leaves the shelf and the prefs in localStorage", async () => {
  const store = await reopen();
  store.createBook("A");
  store.setPref("focusMode", true);

  expect(localStorage.getItem("openchapter:shelf")).not.toBeNull();
  expect(localStorage.getItem("openchapter:prefs")).not.toBeNull();
});

/**
 * **Nothing is deleted until the copy that replaces it is confirmed written.**
 *
 * A browser closed at any point before the flag re-runs the whole move on the
 * next load; one closed after it has the copy that matters. There is no window
 * in which a manuscript exists in neither place — which is the only way this
 * change could have lost somebody's book.
 */
it("leaves localStorage alone when the move fails", async () => {
  localStorage.setItem("openchapter:chapter:c1", '{"type":"doc"}');

  const { store, db } = await freshStore();
  db.__failWritesAfter(0);
  await store.loadFromDisk();
  db.__failWritesAfter(-1);

  // Still readable — through the fallback that never goes away — and still
  // where it was, so the next load tries again.
  expect(store.getBody("c1")).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:chapter:c1")).toBe('{"type":"doc"}');

  const next = await reopen();
  expect(next.getBody("c1")).toBe('{"type":"doc"}');
  expect(localStorage.getItem("openchapter:chapter:c1")).toBeNull();
});

/**
 * **The afternoon after a failed move.**
 *
 * The flag is what switches the app onto the disk, so a session that wrote some
 * chapters and then failed to set it goes on writing *only* to `localStorage`
 * — and every edit made in it is newer than whatever that attempt left on the
 * disk. A retry that preferred the disk would take that afternoon's work and
 * replace it with the version from before the failure, on the next load, with
 * nothing on screen to explain it.
 */
it("keeps what was written after a move that failed", async () => {
  localStorage.setItem("openchapter:chapter:c1", '{"content":["before"]}');

  // The move gets as far as the bodies and then cannot set its flag.
  const { store, db } = await freshStore();
  db.__failWritesAfter(1);
  await store.loadFromDisk();
  db.__failWritesAfter(-1);
  expect(store.isOnDisk()).toBe(false);

  // So the writer's afternoon goes to localStorage, as it did all along.
  localStorage.setItem("openchapter:chapter:c1", '{"content":["after"]}');

  const next = await reopen();
  expect(next.getBody("c1")).toContain("after");
  expect(localStorage.getItem("openchapter:chapter:c1")).toBeNull();
  expect((await reopen()).getBody("c1")).toContain("after");
});

/**
 * **A book written while the disk is still being read.**
 *
 * `saveBody` is barred during that window; nothing else is. The landing page's
 * check writes a whole imported book the moment a visitor presses a fix, and a
 * cover or a matter page can land in the same few hundred milliseconds — all of
 * it into `localStorage`, because that is what a browser that has not migrated
 * yet does.
 *
 * It was lost twice over before `pending` existed: hydration overwrote the
 * mirror with the older copy it had read a moment before, and the migration
 * took the id's presence in the mirror for proof the disk already had it and
 * deleted the only copy. A book that worked all session and was gone on reload.
 */
it("keeps a book written while the disk was still being read", async () => {
  const { store } = await freshStore();
  const loading = store.loadFromDisk();

  expect(store.getStoragePhase()).toBe("loading");
  const made = store.createBookFromImport("Mid-flight", [
    { title: "One", doc: { type: "doc", content: ["window"] }, words: 3 },
  ])!;
  store.setCover(made.bookId, "data:image/jpeg;base64,AAA");

  await loading;

  expect(store.getBody(made.chapterId)).toContain("window");
  const next = await reopen();
  expect(next.getBody(made.chapterId)).toContain("window");
  expect(next.getCover(made.bookId)).toBe("data:image/jpeg;base64,AAA");
});

/**
 * The same window on a browser that migrated long ago, which runs no scan at
 * all — so the migration cannot be what rescues this one.
 *
 * The assertion that matters is the *old key being gone*: without it the test
 * passes on the fallback read, which is a book living in `localStorage`
 * forever, invisible to every other tab and back under the five-megabyte
 * ceiling this whole change exists to escape.
 */
it("keeps one written mid-load on an already-migrated browser", async () => {
  await reopen(); // sets the flag

  const { store } = await freshStore();
  const loading = store.loadFromDisk();
  const made = store.createBookFromImport("Mid-flight", [
    { title: "One", doc: { type: "doc", content: ["window"] }, words: 3 },
  ])!;
  await loading;

  expect(
    localStorage.getItem(`openchapter:chapter:${made.chapterId}`),
  ).toBeNull();
  expect((await reopen()).getBody(made.chapterId)).toContain("window");
});

/**
 * **A write during the window must not be undone by the read it raced.**
 *
 * Hydration arrives with what the disk held a moment ago. Applied flatly it
 * puts that over the top of anything written since — so a cover changed in the
 * first half-second of a session reverted to the old one, on screen, with
 * nothing to explain it.
 */
it("does not let the disk overwrite a change made while it was loading", async () => {
  const first = await reopen();
  const { bookId } = first.createBook("A");
  first.setCover(bookId, "data:image/jpeg;base64,OLD");

  const { store } = await freshStore();
  const loading = store.loadFromDisk();
  store.setCover(bookId, "data:image/jpeg;base64,NEW");
  await loading;

  expect(store.getCover(bookId)).toBe("data:image/jpeg;base64,NEW");
  expect((await reopen()).getCover(bookId)).toBe("data:image/jpeg;base64,NEW");
});

it("forgets a deleted chapter on the disk and at its old key", async () => {
  localStorage.setItem("openchapter:chapter:c1", '{"type":"doc"}');
  const store = await reopen();

  const { bookId } = store.createBook("A");
  const chapterId = store.createChapter(bookId);
  await store.saveBody(bookId, chapterId, { type: "doc" }, 5);

  store.deleteBook(bookId);
  expect(store.getBody(chapterId)).toBeNull();
  expect((await reopen()).getBody(chapterId)).toBeNull();
});

/**
 * **A delete has to clear the old key too, and this is the one way the fallback
 * could hurt rather than help.** Reads fall through to `localStorage` when the
 * mirror has no answer, so a delete that cleared only the disk would resurrect
 * a chapter the writer had erased — on the next load, with no explanation.
 *
 * The state below is real rather than contrived: a browser that hit the failing
 * move above is holding the library on its old keys with the app running off
 * the fallback, and everything still has to work there.
 */
it("does not resurrect a deleted chapter from its old key", async () => {
  const { store, db } = await freshStore();
  db.__failWritesAfter(0); // the move cannot land, so the old keys stay
  await store.loadFromDisk();
  db.__failWritesAfter(-1);

  const { bookId } = store.createBook("A");
  const chapterId = store.createChapter(bookId);
  await store.saveBody(bookId, chapterId, { type: "doc" }, 5);
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).not.toBeNull();

  store.deleteBook(bookId);
  expect(localStorage.getItem(`openchapter:chapter:${chapterId}`)).toBeNull();
  expect((await reopen()).getBody(chapterId)).toBeNull();
});

/**
 * **`hasCover` is the one moved read that may not be null for a moment.**
 *
 * Everything else can come right a heartbeat later; this one is turned straight
 * into "No cover" on the dashboard by `checkup()`, and a finding that appears on
 * load and retracts itself is worse than a slow one — the writer has already
 * started reading it. So the artwork is on the disk and the list of ids stays in
 * localStorage, a few hundred bytes, answered synchronously with no gate.
 */
it("knows which books have covers before the disk has been read", async () => {
  const first = await reopen();
  const { bookId } = first.createBook("A");
  first.setCover(bookId, "data:image/jpeg;base64,AAA");

  const { store: next } = await freshStore();
  expect(next.getStoragePhase()).toBe("loading");
  expect(next.hasCover(bookId)).toBe(true);

  await next.loadFromDisk();
  expect(next.hasCover(bookId)).toBe(true);
  next.setCover(bookId, null);
  expect(next.hasCover(bookId)).toBe(false);
});

it("takes the covers with it when a different writer signs in", async () => {
  const store = await reopen();
  const { bookId, chapterId } = store.createBook("A");
  await store.saveBody(bookId, chapterId, { type: "doc" }, 5);
  store.setCover(bookId, "data:image/jpeg;base64,AAA");

  await store.clearLocalLibrary();

  expect(store.getBody(chapterId)).toBeNull();
  expect(store.hasCover(bookId)).toBe(false);
  // Awaited, so nothing of the first writer's is still in flight when the
  // second one's books start arriving. An un-awaited clear() landing late would
  // delete them.
  expect((await reopen()).getBody(chapterId)).toBeNull();
});

/**
 * A disk that refuses a write is reported rather than worked around.
 *
 * The history-for-prose trade `saveBody` makes on `localStorage` is a trade only
 * a *shared* budget makes sense of: on a disk measured in gigabytes, giving up a
 * megabyte and a half of snapshots would not rescue the save and would spend the
 * writer's safety net finding that out.
 */
it("says so when the disk will not take the chapter", async () => {
  const { store, db } = await freshStore();
  await store.loadFromDisk();
  const { bookId, chapterId } = store.createBook("A");

  db.__failWritesAfter(0);
  await expect(
    store.saveBody(bookId, chapterId, { type: "doc" }, 5),
  ).rejects.toThrow(/would not store/);
  db.__failWritesAfter(-1);

  expect(store.getStorageTrouble()).toBe("full");
  store.clearStorageTrouble();
});

/**
 * **Two tabs, which is the whole reason `store-channel.ts` exists.**
 *
 * The `storage` event used to do this for free — it fires only in tabs *other*
 * than the one that wrote, which is exactly what a body listener wants — and
 * IndexedDB has no such event. Without the channel a writer with the same
 * chapter open twice would type in one and the other would go on showing the
 * old text until it was reloaded.
 *
 * Two module instances in one document is a fair model of it: each opens its
 * own `BroadcastChannel`, and a message reaches every same-named channel object
 * except the one that posted.
 */
it("tells the other tab, and never itself", async () => {
  const a = await reopen();
  const { bookId, chapterId } = a.createBook("A");
  await a.saveBody(bookId, chapterId, { type: "doc", content: ["one"] }, 5);

  const b = await reopen();
  let told = 0;
  b.subscribeToBody(chapterId, () => {
    told += 1;
  });

  // The writing tab must not hear its own save: the editor keys its surface on
  // this counter, so an echo remounts Tiptap in the middle of a keystroke.
  let echoed = 0;
  a.subscribeToBody(chapterId, () => {
    echoed += 1;
  });

  await a.saveBody(bookId, chapterId, { type: "doc", content: ["two"] }, 6);
  await new Promise((r) => setTimeout(r, 20));

  expect(told).toBeGreaterThan(0);
  expect(echoed).toBe(0);
  // The note carries the key and the value is re-read from the disk, so this
  // cannot be showing a value that has since been written over.
  expect(b.getBody(chapterId)).toContain("two");
  expect(b.getBodyReload(chapterId)).toBeGreaterThan(0);
});

/**
 * **Cleaning up after a leak that ran for months.** `deletePrintCover` was
 * reachable only from `clearCover`, so every book deleted before 2026-08-17
 * left its full-size artwork behind — sixteen megabytes on one real library,
 * under keys nothing would ever ask for again.
 */
it("clears cover artwork left by books that no longer exist", async () => {
  const one = await freshStore();
  await one.store.loadFromDisk();
  const { bookId } = one.store.createBook("A");
  await one.covers.putPrintCover(bookId, { dataUrl: "x", width: 1, height: 1 });
  await one.covers.putPrintCover("gone", { dataUrl: "x", width: 1, height: 1 });

  // A new session, and the same graph the assertions read through — the sweep
  // is fired by the load rather than awaited by it.
  const two = await freshStore();
  await two.store.loadFromDisk();
  await new Promise((r) => setTimeout(r, 50));

  expect(await two.covers.getPrintCover("gone")).toBeNull();
  expect(await two.covers.getPrintCover(bookId)).not.toBeNull();
});

/**
 * An empty shelf is also what a corrupt or half-downloaded one looks like, and
 * deleting every writer's artwork on the strength of that is not a guess worth
 * making.
 */
it("sweeps nothing when the shelf is empty", async () => {
  const one = await freshStore();
  await one.covers.putPrintCover("b1", { dataUrl: "x", width: 1, height: 1 });

  const two = await freshStore();
  await two.store.loadFromDisk();
  await new Promise((r) => setTimeout(r, 50));

  expect(await two.covers.getPrintCover("b1")).not.toBeNull();
});

it("keeps the library within its history budget on the disk too", async () => {
  const { MAX_LIBRARY_HISTORY_BYTES } = await import("./history");
  const { db } = await freshStore();

  const half = Math.round(MAX_LIBRARY_HISTORY_BYTES / 2);
  const body = (n: number) => "x".repeat(Math.max(1, n - 60));
  await db.writeAll(db.HISTORY, [
    ["ancient", JSON.stringify([{ at: 1000, body: body(half), words: 1 }])],
    ["old", JSON.stringify([{ at: 2000, body: body(half), words: 1 }])],
    ["recent", JSON.stringify([{ at: 3000, body: body(half), words: 1 }])],
  ]);

  const next = await reopen();
  const { bookId, chapterId } = next.createBook("A");
  await next.saveBody(bookId, chapterId, { type: "doc" }, 5);

  // Whole chapters, oldest first — "before lunch" is the promise, and it is the
  // recent versions of a chapter that deliver it.
  expect(next.getHistoryRaw("ancient")).toBeNull();
  expect(next.getHistoryRaw("recent")).not.toBeNull();
  expect(next.getHistoryRaw(chapterId)).not.toBeNull();
});
