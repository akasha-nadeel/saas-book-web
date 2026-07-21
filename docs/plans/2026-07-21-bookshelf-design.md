# Bookshelf — design

**Date:** 2026-07-21
**Status:** approved, not yet implemented

Support more than one book. Today OpenChapter holds a single implicit book: one
manifest, one chapter list, one editable book title in the sidebar. This phase
gives the writer a shelf.

Supabase persistence and auth remain deferred. Storage stays in localStorage,
behind the same module boundary.

## Storage

Three layouts were considered.

**A — a shelf manifest plus one manifest per book.** Mirrors the eventual
database tables most literally. Rejected: the shelf view needs each book's
chapter and word totals, so those are denormalised a second time. Saving a
chapter would write the body, the book's manifest, and the shelf — three
writes, no atomicity, and two places for counts to drift.

**B — one metadata document, bodies separate.** Chosen.

**C — fully normalised, a key per book and per chapter.** Correct for a
database, wrong for localStorage: many reads to paint one screen, and no way to
commit a reorder atomically.

The chosen layout:

```
openchapter:shelf         { books: [{ id, title, chapters: [{ id, title, words }],
                                      lastOpenedId }],
                            lastOpenedBookId }

openchapter:chapter:<id>  the Tiptap document — unchanged
```

Bodies stay at their own keys. That is the property that keeps the sidebar
cheap: opening a forty-chapter book still parses no documents.

Book totals — chapter count, total words — are summed on read rather than
stored, so they cannot drift from the chapters they describe.

The existing snapshot cache carries over unchanged: the parsed shelf is cached
on the raw string it came from, so repeat reads return an identical reference
and a write from another tab invalidates it for free. `getBook(id)` returns a
reference *into* that cached object, so it inherits the same stability without
a cache of its own.

## Routing

```
/                                    the shelf
/book/[bookId]                       redirect to that book's last-opened chapter
/book/[bookId]/chapter/[chapterId]   the editor
```

`/chapter/[id]` is removed.

The sidebar moves out of the root layout into `app/book/[bookId]/layout.tsx`,
so the shelf renders full-width with no chapter list beside it. The root layout
returns to being only the shell. The status bar's `left-(--sidebar-width)`
offset keeps working, because it now only ever renders inside the book layout.

## The shelf

Books are ordered most-recently-opened first. Each shows its title, chapter
count and total words. The first gets a "Continue writing" affordance.

The writer lands on the shelf every time rather than being dropped into a book.
This costs one click on the common path, which the affordance keeps short, and
buys a deliberate start instead of an app that decides for you.

Creating a book also creates its first chapter and navigates straight into it —
a book with no chapters is a dead end.

## Migration

An existing `openchapter:manifest` becomes the first book on the shelf, keeping
its title, chapter order and word counts. Chapter ids are already UUIDs, so
bodies keep their current keys and are never rewritten.

This runs from an effect, so it carries the same idempotence guard as
`ensureChapter` — React runs effects twice in development, and a version that
blindly migrated would leave every developer with the book duplicated.

## Deletion

Deleting a book confirms first, then removes every chapter body it owns. This
is the one operation in this phase that can destroy a lot of work at once, so
it is also the one that must not be silent.

## Errors

An unknown book id and an unknown chapter id both reach the existing "this
chapter isn't here" screen, behind the same hydration gate — an empty shelf
means both "no books yet" and "storage not read yet", and telling them apart is
what stops every valid page flashing a not-found screen on load.

A corrupt shelf degrades to empty rather than crashing every route.

## Testing

The store test grows to cover:

- migration from a single-book manifest, including idempotence
- book creation and deletion, with deletion cascading to chapter bodies
- derived totals matching the chapters they summarise
- snapshot identity through the new nesting
- corrupt-shelf fallback

The React and DOM layers stay unverified by automated tests, as they are today.
