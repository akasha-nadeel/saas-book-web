# Supabase persistence — design

Written 2026-07-29, after auth shipped. Auth identifies a writer; this is what
makes the account carry their books.

## The problem

`src/lib/library-store.ts` is the only module that touches `localStorage`, and
37 files read through it. Its whole API is **synchronous** — `getShelf()`,
`getBody(id)`, `getPrefs()` all return a value, not a promise — because React
binds to it with `useSyncExternalStore`, which requires a snapshot it can read
during render.

Supabase is asynchronous. That is the entire difficulty. Everything else is
schema.

Two places make it sharper than it looks:

- `book-reader.tsx` and `page-preview.tsx` call `getBody()` in a loop over
  *every chapter of a book* to lay out the read-through. That is one sync loop
  today and N round trips if bodies are fetched individually.
- The editor keys its surface on `${chapterId}:${storedText}`. A body that
  arrives late changes the key and remounts the surface. If the writer has
  started typing, that eats their work.

## The decision: localStorage stays

**Supabase becomes the durable copy behind localStorage, not a replacement for
it.**

The alternative — read and write Supabase directly, drop localStorage — is
simpler and wrong for this product:

- A writing app that currently works on a train would stop working on a train.
  Offline is not a nice-to-have here; the manuscript is the user's own work and
  the app's one promise is that it stays reachable.
- Every read becomes a network round trip, so `getShelf()` cannot stay
  synchronous, so `useSyncExternalStore` cannot be used, so all 37 consumers
  change. The stated intent was that the migration touches one module.
- First paint would go from instant to a spinner.

Keeping localStorage as the read path means the synchronous API survives intact,
the component tree does not change at all, and the app degrades to exactly
today's behaviour when the network is gone.

The cost is real and worth naming: **two devices editing the same chapter can
conflict.** The policy is last-write-wins per chapter body, decided by
`updated_at`. For a single-author drafting tool that is honest and sufficient;
it is not a collaborative editor and should not pretend to be.

## Shape

```
component ── use-library.ts ── library-store.ts ── localStorage   (sync, unchanged)
                                       │
                                       └────────── sync.ts ── Supabase  (async, new)
```

- **Reads** stay exactly as they are: localStorage, synchronous, cached.
- **Writes** commit to localStorage and emit as they do now, then enqueue a push
  to Supabase. The writer never waits on the network to see their own change.
- **Pull** happens on sign-in and on focus: fetch rows changed since the last
  sync, merge into localStorage, emit. A book edited on another machine appears
  the way a cross-tab write appears today.

`sync.ts` is new and is the only file that talks to Supabase about library data.
`library-store.ts` gains calls into it and keeps everything else.

## Schema

Mirrors the store's split by write-cost, because the reasoning was the same:

| table | why separate |
|---|---|
| `books` | shelf-level metadata, page setup, typography, archive/trash stamps |
| `chapters` | id, title, position, matter, bookmark, word count — no prose |
| `chapter_bodies` | the Tiptap doc. Opening a shelf must not fetch prose |
| `chapter_notes` | unbounded, rarely read |
| `book_covers` | up to 250KB each; own table so a shelf read stays small |
| `prefs` | one row per user |

Every table carries `owner uuid references auth.users`, RLS enabled, policies
keyed on `auth.uid() = owner`. New tables are not auto-exposed to the Data API
in this project and automatic RLS is on, so both have to be granted deliberately
— which is the posture we chose when the project was created.

Soft deletes stay soft: a trashed chapter keeps its row and gains `trashed_at`,
so restore is lossless exactly as it is now.

## Migrating what is already there

A writer signing in for the first time has books in localStorage and nothing in
Supabase. On first successful pull, if the remote library is empty and the local
one is not, push the local library up wholesale and record that it has been
claimed.

This must be idempotent and must never run in the other direction. Deleting the
server copy of a book must not resurrect it from a stale local cache, so the
claim is recorded per user and the pull is authoritative afterwards.

## Order of work

1. Schema + RLS, applied to the project. Nothing in the app changes.
2. `sync.ts`: pull and push, with the claim-on-first-sign-in path.
3. Wire `library-store.ts` writes to enqueue pushes.
4. Pull on sign-in and on focus; merge and emit.
5. Sign-out clears the local cache, or one writer's books sit in the next
   writer's browser.

Stage 1 is inert and safe to land on its own. Nothing observable changes until
stage 3.

## Open, deliberately

- **Covers in Storage rather than a table.** Data URLs in `text` work and keep
  stage 1 simple. Supabase Storage is the right home eventually.
- **Realtime.** Pull-on-focus is enough for one writer on two machines. Live
  subscriptions are a later question, and a different product.
