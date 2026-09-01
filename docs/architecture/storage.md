# Storage, the library store, and React binding

Read before touching `library-store.ts`, `store-db.ts`, `store-channel.ts`, `cover-store.ts`, `storage-space.ts`, `use-library.ts`, or anything that reads/writes persisted state.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**Persistence is one module.** `src/lib/library-store.ts` is the *only* file that
touches storage; everything else goes through it. (There are two *other*
storage modules, `store-db.ts` and `cover-store.ts`, and both are transport —
see the IndexedDB note below.) That boundary is what
let Supabase arrive *behind* the store (`sync.ts`) without any of the sixty-odd
files that read it changing a line, and it is what let the **manuscript move off
`localStorage` onto IndexedDB on 2026-08-17** with the same sixty-odd files
untouched again. Keep it intact: a screen reaching for `localStorage` directly
is a bug even when it works.

**The manuscript is on IndexedDB and the index is in `localStorage`, and which
is which is the whole design.** Five megabytes is what a browser gives one
origin for `localStorage`, and the library outgrew it: bodies run 20–40KB a
chapter, cover thumbnails are held to 250KB each, and a real library of 23
books and 298 chapters measured about nine megabytes. What fails first is an
autosave — on a chapter that had nothing to do with whatever filled the room.
No amount of sweeping fixes a ceiling, so the four unbounded stores (bodies,
notes, history, cover thumbnails) went to IndexedDB, which is ~60% of free disk
in Chrome.

Six things about it are load-bearing:

- **Three things stayed and must not follow.** `prefs`, because `layout.tsx`
  reads it in an inline `<script>` before React and IndexedDB is async; `owner`,
  which `reconcile` reads around the wipe; and the **shelf**, ~50KB and the index
  every screen paints from, so keeping it synchronous keeps first paint instant.
  Most of the risk in this change was avoided by not moving those.
- **Memory is the read path; IndexedDB is the disk.** Each moved store keeps a
  `Map` mirror, so `getBody` and friends stay synchronous and keep returning the
  same string reference until it is replaced — which is what
  `useSyncExternalStore` needs and the reason nothing downstream changed. A
  write sets the mirror at once and queues the disk write behind it.
- **`mirror.get(key) ?? readRaw(legacyKey)` is the line that makes it safe.** An
  interrupted migration is harmless, a failed one is a non-event, a browser
  without IndexedDB behaves exactly as before, and a test that seeds
  `openchapter:chapter:<id>` by hand still passes. `localStorage` stays a
  fallback **read** path for good — which is also why every delete must clear
  the legacy key, or an erased chapter comes back.
- **`useHydrated()` waits for the disk now**, which is what gates all ~20 screens
  without one of them changing. It matters because the editor keys its surface
  on `${chapterId}:${reload}` rather than on the text, deliberately, to protect
  the caret: mount it over a null body and the prose arriving later does not
  remount it, so the next autosave writes an empty document over the chapter.
  `saveBody` **rejects** while loading as the second guard — rejects rather than
  answering false, because false is the viewer refusal and means *do not retry*.
- **`loadFromDisk` has no timeout, and that is a decision.** One was written and
  it is a way to lose a manuscript: a migrated browser has nothing in
  `localStorage`, so giving up shows an empty book, and anything typed into it
  is correctly *newer* than the disk and would be flushed over the real chapter.
  A spinner is the safe failure. The hangs that actually happen are caught at
  `openDb` (`onerror`, `onblocked`, no `indexedDB` at all), all in milliseconds.
- **The migration is disk-first, flag-second, delete-last**, so there is no
  window in which a chapter exists in neither place. Two subtleties: writes that
  land *during* the load window go to `localStorage` and are recorded in
  `pending`, so hydration cannot clobber them and `flushPending` puts them on the
  disk; and while the flag is absent **`localStorage` always wins**, because the
  flag is what switches the app onto the disk — a session that half-migrated and
  failed goes on writing only to `localStorage`, so every edit in it is newer
  than whatever that attempt left behind.

`hasCover` is the one moved read that may not be null for a moment, so a tiny
`openchapter:covers` index of ids stays in `localStorage` and answers it
synchronously with no gate: `checkup()` turns it straight into "No cover" on the
dashboard, and a finding that appears on load and retracts itself is worse than
a slow one.

**The 250KB is met, never enforced against the writer** (2026-09-01).
`importImage` used to encode a cover once at a fixed quality and refuse anything
still over the budget — "too large to store in the browser. Try a smaller crop"
— which handed a writer an image editor's job over a picture that was usually
two quality points from fitting. It now walks `encodeAttempts`: every quality
down to 0.6 at the full size, then the size down in 0.85 steps with the quality
starting again from the top, stopping at the first encode that fits. The
refusal still exists at the bottom of both ladders and no real photograph
reaches it. Two consequences for anything reading this store: what lands here is
still never more than 250KB, and `ImportResult.stored` can now be smaller than
the caller's `maxEdge` — it has always meant "what was kept", so that is not a
new contract. The **jacket** a cover-less book wears on screen
(`src/lib/default-covers.ts`) touches none of this: it is a static file, nothing
is written, and `hasCover` goes on answering false so the finding above stays
correct.

`src/lib/store-db.ts` is the transport — one database, one `openDb`, every store
declared in its one `onupgradeneeded`, since two `indexedDB.open` calls on one
name at different versions block each other. `src/lib/store-channel.ts` is the
cross-tab note that replaces the `storage` event, which IndexedDB has none of:
**one module-level `BroadcastChannel`**, because a message reaches every
same-named channel object *except the sender* — a channel per subscription would
echo the writing tab's own saves back at its own body listeners and remount
Tiptap mid-keystroke. The note carries the **key, never the value**, and the
receiver re-reads from the disk before telling anyone.

`src/lib/store-db.test.ts` is the only suite that imports `fake-indexeddb`. That
is deliberate: every other suite runs with no IndexedDB at all, which is Firefox
in private browsing, and those 1,700-odd tests are the proof that configuration
still behaves exactly as the app did before any of this existed.

**Room can still run out, and it is said out loud.** `src/lib/storage-space.ts`
plus `StorageAlert` in the root layout are the other half of the move above, and
they are the part a screen must never re-implement. Everything a browser stores
is *best effort* until something asks otherwise: when the device runs short,
browsers evict **the whole origin at once** rather than the least useful part of
it, and Safari clears an origin nobody has visited in seven days — so a
signed-out writer whose only copy is here can lose all of it silently.
`askToPersist()`, called once per load by `LibrarySync`, is the one call that
changes that, and it is a *request*: Firefox asks the writer, Chrome and Safari
decide from how the site has been used, all three may say no, and the app has to
be correct either way. Every function in that module resolves rather than
throwing, the policy `cover-store.ts` already follows.

Four things about the alert are load-bearing:

- **The store raises it, never an effect on mount.** `StorageTrouble` is
  module-level state in `library-store.ts` (`reportStorage`,
  `getStorageTrouble`, `subscribeToStorageTrouble`), read through
  `useStorageTrouble`. An effect that opened this on load would meet a writer
  who filled their storage yesterday with a dialog about it today — the
  `LimitDialog` rule.
- **Two states, two volumes.** `history-dropped` is a save that hit the quota
  and then succeeded because the version history was given up, and it is a note
  in the corner; `full` is a save that could not be written at all, which is the
  words going nowhere, and it stops the screen. Nothing smaller is proportionate
  to that.
- **It is only ever raised louder** (`TROUBLE_RANK`), never quieter, until the
  writer dismisses it. A `full` must not be talked over by the next successful
  save, because the book is still not saving.
- **It sits in the root layout** because the editor's autosave is merely the
  likeliest place to hit a full origin — the bible, the ARC list and the ledger
  all write unguarded and would throw with nothing on screen to explain why.

There is **exactly one exception, and grepping will find it**: the
`THEME_BOOTSTRAP` string in `src/app/layout.tsx` reads `openchapter:prefs` by
hand. It has to — it is an inline `<script>` that runs before React, before any
module loads, because resolving the theme *after* hydration is the flash it
exists to prevent. Nothing else may follow it. (Other files mention
`localStorage` in prose comments; those are not accesses.)

**The store is split by write-cost, not by type:**
- **shelf** (`openchapter:shelf`) — one document holding every book with its
  chapter list (ids, titles, order, denormalised word counts) plus each book's
  per-book settings: page setup, body typography, the front/back-matter tag and
  bookmark flag per chapter, and the trash list. One doc so a reorder commits
  atomically. Parsed on every read by every screen.
- **bodies** — one Tiptap JSON document per chapter, each at its own key, so
  opening a 40-chapter book parses no prose. On IndexedDB since 2026-08-17,
  under the `bodies` store; `openchapter:chapter:<id>` is still read as a
  fallback.
- **covers**, **notes** — likewise at their own keys, for the same reason:
  unbounded data that must not ride along in every shelf write. Both moved with
  the bodies. **prefs** stayed, for the bootstrap script.
- **the tool stores** — `bible:<bookId>`, `arc:<bookId>`, `history:<chapterId>`
  (the last of these moved to the disk with the bodies),
  and the library-wide `ledger`, `activity` (one net word count per day) and
  `ideas` — same reasoning, plus one shared caveat: **none of them sync.**
  `sync.ts` maps a book's *columns* by name and these are not columns, so a
  writer on two machines keeps two ledgers. Every screen with one says so on the
  page; don't quietly drop that line. The two features that read *across* these
  keys make it worse rather than better and say so for themselves: a series
  bible is a merge of whichever books this machine holds, and the book-three
  curve is drawn from whichever sales reports were imported here.

Book/chapter totals are summed on read, never stored, so they can't drift.
Deleting a chapter is a soft delete: its meta moves to the book's `trash` list in
the shelf, but its body and notes stay at their own keys until the trash is
emptied, so a restore is lossless. A *book* is soft-deleted differently — it
stays in `shelf.books` and gains an `archivedAt` or `trashedAt` stamp, and
`booksIn(shelf, view)` filters the three shelf views out of the one list.

**Two subscription audiences, opposite needs.** Shelf listeners want every write
including our own (renaming a chapter must repaint the sidebar now), so local
fan-out is manual and shelf-only. Body listeners want *only* other tabs — echoing
our own save back would remount the surface the writer is typing into. The
`storage` event covers cross-tab for both, since browsers fire it only in other
tabs. Get this backwards and you eat the caret.

**React binds via `src/lib/use-library.ts`** — kept apart from the store so the
store stays React-free. It uses `useSyncExternalStore` with empty server
snapshots (SSR renders nothing, the client swaps in real data after hydration).
`useHydrated()` distinguishes "no books yet" from "storage not read yet"; guard
on it before rendering not-found states. Server snapshots must be referentially
stable (see the frozen `EMPTY_SHELF`) or the store loops. There is one hook per
store and they are all the same shape — `useShelf`, `useChapterBody`,
`useBodyReload`, `useCover`, `useNotes`, `usePrefs`, and one each for the tool
stores (`useBible`, `useArc`, `useLedger`, `useActivity`, `useHistory`,
`useIdeas`); a new store gets a new hook here rather than an effect in a screen.

**There are two gates, not one, and `useHydrated` is only the first.**
`useLibrarySettled()` (over `getSyncPhase`) is false until the first reconcile
with the server has finished, and it exists for the state `useHydrated` cannot
see: storage read, genuinely empty, **books still arriving**. A screen that
treats that as "no books" tells a writer their library is gone and then takes it
back. The rule is **guard the empty states on `useLibrarySettled` and never the
loaded ones** — a shelf with books on it is worth showing the instant it is
readable, whether or not the download has caught up. Both phases are decided
*synchronously* by whether there is anything to wait for at all (no IndexedDB,
no Supabase → start ready), because starting ready and flipping to loading
inside an effect is a first paint with the loaded state on it, which is the bug
these exist to prevent. Two hooks here are not per-store and are named for what
they answer rather than for a key: `useStorageTrouble` (below) and
`useCoverEpoch`.


