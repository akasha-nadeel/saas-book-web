# Supabase auth, the proxy, and syncing the library

Read before touching `src/proxy.ts`, `src/lib/supabase/`, `src/app/auth/`, `sync.ts`, or the migrations in `supabase/migrations/`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**Auth is Supabase, and optional.** Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the app grows accounts and a sign-in
wall; leave both unset and it runs exactly as it always did, local-only, with the
account menu saying why — the same shape as the missing API key. Every entry
point checks `isSupabaseConfigured()` first, because the clients throw on an
empty URL.

`src/proxy.ts` is the load-bearing file (Next 16 renamed Middleware to Proxy). A
Server Component cannot write cookies, so something ahead of the render must
refresh an expired token and store it — without that file, sessions die
mid-session and writers get logged out at random. Two details are easy to get
wrong: `setAll` must rebuild the response *after* putting the new cookies on the
request, and it must copy the `headers` argument onto the response, or a CDN
caches one writer's `Set-Cookie` and serves it to the next reader. A redirect out
of the proxy has to carry those cookies too. The gate reads `getClaims()`, which
verifies the JWT signature — never `getSession()`, which trusts the cookie.

`src/lib/supabase/` holds the three clients (browser, server, and the one the
proxy builds inline); sign-in/up/out are Server Actions in
`src/app/auth/actions.ts`, so the session cookie and the redirect land in the
same response and there is no sign-in flash. The proxy skips `/api` on purpose —
redirecting a `fetch` to an HTML page yields a parse error, not a 401 — so the
chat route checks for itself.

**Everything funnels through `/auth/confirm`.** Password reset, email
confirmation and Google all end there: `/forgot-password` mails a link pointed
at `/auth/confirm?next=/reset-password`, and `signInWithGoogle` (a Server
Action, so the PKCE verifier lands in an httpOnly cookie) sends Google → Supabase
→ the same route. One place creates sessions, whatever started them. So
`/reset-password` needs no token of its own and is *gated* rather than public —
by the time a writer arrives they are signed in, and `updateUser()` knows who
they are, which also makes it a plain change-password screen for anyone already
in. Google's redirect URI is registered as *Supabase's* callback, never ours;
our domains live in Supabase's Redirect URLs allowlist.

**Supabase reports auth failures in the URL fragment**, which browsers never
send to a server. `useFragmentError` in `auth-shell.tsx` reads it after
hydration — through `useSyncExternalStore`, like `useHydrated`, with the capture
cached at module scope so the snapshot stays stable and survives the effect that
wipes the hash. Without it every failure reads as "that link expired", including
a rejected OAuth secret, which is a genuinely misleading place to start
debugging. The four auth screens share `auth-shell.tsx` so the chrome cannot
drift between them.

**Persistence is Supabase behind localStorage, not instead of it.**
`library-store.ts` still reads and writes `localStorage` synchronously — that is
what lets `useSyncExternalStore` read a snapshot during render, and why none of
the sixty-odd files that read the store changed. `src/lib/sync.ts` is the async
half:
`commit()` diffs the shelf and pushes what moved, and `syncWithServer()`
reconciles once per load. Reading through Supabase directly would make
`getShelf()` async, which unpicks all of it — and would cost offline, which for a
drafting tool is not a nice-to-have. The price is last-write-wins per chapter
between two machines. See `docs/plans/2026-07-29-supabase-persistence-design.md`.

Two things in there are load-bearing. **Pushes are diffed in `commit()`**, not
added at each of the twenty-odd mutation sites: every shelf write funnels
through it and the writes are immutable, so reference inequality is an exact
test for "this book changed" — and a new mutation cannot forget to push.
Deletions are found by comparing chapter id sets before and after, because
`pushBook` upserts a book's chapters but cannot know one was removed.

**Nothing is pushed while nobody is signed in**, checked once in `flush()`
rather than per job, and the queue is dropped rather than held — signing in
ends in a redirect, so an in-memory queue never survives to see it, and
`syncWithServer()` uploads whatever the browser holds on the next load anyway.
The reason it needs stating: a book keeps the `ownerId` of the session that
made it, so after a sign-out that field is still there and still looks like an
answer. `book.ownerId ?? currentOwner()` handed it over, and the resulting push
was well-formed, attributed to a real person and sent with no credentials — so
only Postgres could tell it was wrong, with **42501 and a hint recommending
`GRANT ... ON public.books TO anon`**. Do not take that advice: it would let any
stranger write to any writer's shelf. The decision is now the pure, tested
`pushOwner(book, me)`, whose whole content is that the *session* decides
whether to push and the book only decides who to attribute it to.

**A delete outlives the queue that carries it.** The rule above — drop the
queue when there is no session — is right about edits and lossy about deletions:
an edit is re-sent by the next save or by `syncWithServer`'s repair pass, and a
`book:<id>` delete is re-sent by nothing at all. So the row stayed on the
server, `applyRemote` wrote the server's list over the local one on the next
load, and the writer's deleted book was back; deleting it again, in the same
sessionless window, did the same thing again. What is written down now is the
*intent*: `pushShelfDiff` records the id and the moment at
**`openchapter:deleted`** — local-only, never synced, own books only, since a
shared book leaving the shelf means access ended rather than that the book did
— and `reconcile` settles the list against each download. A book the server
still lists is deleted again, now that there is a session; one it no longer
lists is forgotten, because the server agreeing is the only confirmation worth
having; and either way a tombstone older than **ninety days** is dropped, so an
origin that never reaches a server cannot fill up with them. `keepLocalOnly`
filters the download while a tombstone stands — the half that keeps the book off
the shelf in between. The trade-off, stated in the code: a delete made here
while signed out is carried out when *this* browser next reaches the server,
even if a second machine has been writing that book since. That is what a delete
whose push merely succeeded late would do, the writer did press the button and
answer the confirmation, and the ninety days is what stops it being unbounded.
`push-deletes.test.ts` covers the cycle, and three of its four tombstone cases
fail with the readers removed.

**The mapping narrows values on the way out** (`matterOrNull`, `count`, `text`,
the guard in `toIso`). The types describe today's code; `localStorage` holds
whatever older versions left there, unchecked by any compiler, and the database
has CHECK constraints and NOT NULLs that will refuse the difference — one stale
field in one chapter is otherwise enough to abort a whole library upload.
`uploadLibrary` also drops bodies and covers whose chapter or book is not going
up: after enough versions some keys belong to nothing, and a dangling foreign
key takes the batch with it.

**A browser is shared, so the cache is owned.** `openchapter:owner` records
whose library is sitting in this browser, and `clearLocalLibrary()` wipes every
`openchapter:` key when a different account signs in. Without it the second
writer on a machine inherits the first one's shelf — and now, with a server
behind it, pushes those books up under their own account.

The SQL behind all that is checked in: `supabase/migrations/` (library,
book publishing, billing, feedback, collaboration, Paddle). Schema changes
belong there, not only in the dashboard. **All seven are applied to the live
project as of 2026-08-20**, `20260820000000_chapter_unnumbered.sql` included.
`20260801000000_feedback.sql` was the long-outstanding one and is now in; what
follows is why it mattered, kept because the failure mode is worth
recognising. It was verified in the
browser on 2026-08-15, when pressing Send in the feedback dialog came back
`404 PGRST205, "Could not find the table 'public.feedback' in the schema
cache"`. That is the whole of the feedback feature failing silently for every
writer, and it went unnoticed because the dialog's own "the migration has not
been applied" branch tested for `42P01`, which PostgREST never returns for a
table it cannot find at all. The branch is fixed, and the migration has since
been applied. Read the rest of this paragraph as a description of the other
five — the first four as of 2026-08-07 and `20260808000000_paddle.sql` on
2026-08-09, proved by the sandbox checkout writing `provider`,
`paddle_subscription_id` and a period end into real rows rather than by the SQL
editor saying "Success". `20260730000000_book_publishing.sql` had been outstanding for a
week, which meant every book push silently dropped its listing details, and
`pushBook` carries the self-healing retry that made that survivable rather than
fatal. Keep that retry: it is the pattern any future column should follow.


