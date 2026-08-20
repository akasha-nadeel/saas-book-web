# Collaboration: roles, RLS, seats, and invitations

Read before touching `src/lib/collab.ts`, `src/app/collab/actions.ts`, `src/lib/email/`, the invite route, or the collaboration migration.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

**Some books have two writers, and `src/lib/collab.ts` is the pure half.**
Two roles — **editor** writes the manuscript, **viewer** reads and exports it —
and no third. The standard third rung is a *commenter*, absent because there are
no comments here: a role that cannot do the one thing its name promises is worse
than one that does not exist. Reedsy is the cautionary case, advertising three
permission levels while every invitee gets full edit rights.

**The line is drawn at the book, not at the prose**, which is where Atticus draws
it too. An editor writes chapters, bodies and notes; the `books` row, the cover,
the page setup and the listing details stay the owner's. That is not caution —
`last_opened_id`, `last_opened_at` and `position` live on that shared row and are
*per-writer*, so an editor allowed to write it would overwrite the owner's place
in the manuscript every few minutes. One sentence holds it: **an editor writes the
book, the owner owns the book.** `keepLocalOnly` therefore carries `archivedAt`
and `trashedAt` across a download for a shared book, and `rowsToBook` prefers the
*local* `lastOpened*` — without both, the owner's values arrive as the reader's on
every load.

**Three rules live in SQL because the client cannot be trusted with them**, and
`supabase/migrations/20260806000000_collaboration.sql` **drops and rebuilds** the
library's policies rather than adding to them:

- **`owner` on every child row is derived by trigger, never accepted.** Those
  columns cascade to `auth.users`, so a row stamped with an editor's uuid means
  that editor closing their account silently deletes the owner's chapters and
  prose — through the one path nobody tests.
- **Write permission is decided by the *book*, never by the row's own `owner`.**
  `with check (auth.uid() = owner)` is satisfied by any stranger claiming the row.
  That was already true of `chapters` before this feature and invisible only
  because reads were owner-filtered too; making reads book-scoped would have
  turned it into injected chapters in a stranger's sidebar.
- **A chapter cannot change books, and prose cannot change chapters.** RLS
  compares USING against the old row and WITH CHECK against the new, and an editor
  moving a chapter into their own book satisfies both. Only a trigger sees a key
  move.

`chapter_bodies` and `chapter_notes` gained a **`book_id`** so a policy on them
need not reach through `chapters` — through a definer helper that bypasses
`chapters`' own RLS, inline it makes one table's security depend on another's.
`book_role()`, `shared_book_ids()` and `writable_book_ids()` are `security
definer` with `search_path = ''`, which is also what stops `books`' policies and
`book_members`' policies recursing into each other; do not `force row level
security` on either, and do not write either ownership test inline.

**`book_members` is written by nothing but the server.** `select` is granted to
`authenticated` **by column** — `token` and `invited_by` are withheld, so every
read must name its columns or PostgREST refuses the whole query — and there is no
insert, update or delete grant at all. Mutations go through Server Actions in
`src/app/collab/actions.ts` holding `createAdminClient()`, the posture billing
already takes with `subscriptions`, because the seat cap needs `isPro()` and
`isBillingConfigured()`. The *counting* is done in SQL under `select … for update`
(`invite_book_member`, `accept_book_invite`): two invitations racing each other
each see the other's absence and both get in.

**Seats are per book and count the owner** — `SEATS_PER_BOOK` in `free-limits.ts`,
2 free and 10 on Pro. Deliberately **not** the same kind of number as the
tooled-book list: a seat is current *occupancy* and comes back when
somebody is removed or an invitation lapses. It is the one limit Pro *raises*
rather than lifts, so `spentLine` drops the word "free" for a paying owner and
`LimitBanner` says what Pro actually does — printing "Unlimited" there would be
the one false cell on the pricing page. A lapsed plan **evicts nobody**; it only
refuses new invitations.

**An invitation is emailed *and* a link is offered, and nothing may claim a
send that did not happen.** For most of this feature's life no mail existed:
the owner copied a link and the invitation also appeared in the invitee's own
Collaborators area. That second half never worked for the person it was aimed
at — somebody without an account has no dashboard to find it in — so the owner
was the delivery mechanism. Mail arrived on **2026-08-14** (`src/lib/email/`),
and the honesty rule survived the change intact rather than being dropped with
it.

Five things hold it:

- **The mail is best-effort; the row is the feature.** `inviteMember` sends
  *after* the `invite_book_member` RPC and nothing the send does can change its
  outcome. A provider having a bad minute must not turn a successful invitation
  into a reported failure — the co-writer would be on the book, the seat spent,
  and the owner told it had not worked.
- **`emailed` comes back from the server**, and `InviteSentDialog` says "sent"
  only when it is true. All three failures — no key, refused, unreachable —
  read the same to the writer, because the only useful next step is the same
  one. It is `note`'s amber rather than `stop`'s red: nothing failed that costs
  anybody access.
- **The link is offered either way.** Every product this is measured against
  does both, because the two fail in different places: mail is filtered and
  delayed, a link needs a channel to travel down.
- **`send.ts` never throws and `invite.ts` never sends.** The composing half is
  pure and tested — 17 tests, including that every interpolation is escaped,
  since the book title, the owner's `user_metadata` display name and the
  owner's note are all free text arriving in a stranger's inbox under our own
  DKIM signature.
- **We send from our verified domain, never as the owner.** Their name rides in
  the display name (`Ada Vance (via OpenChapter)`) and their address in
  `Reply-To`; a `From:` of somebody's gmail fails DKIM and DMARC and is how a
  sending domain gets flagged for spoofing. `RESEND_API_KEY` and `RESEND_FROM`
  are optional like every other key here — unset, the feature degrades exactly
  to what it was before mail existed.

Resend is the provider because Vercel's marketplace lists exactly one messaging
integration; it is reached over its REST API rather than its SDK, for the reason
`ai.ts` writes Gemini out by hand.

Emailing the link is only safe because the link is a *pointer, not a credential*
— `/invite/[token]` sits behind the sign-in wall, and `acceptInvite` refuses
anyone whose **confirmed** address is not the invited one, checked with
`auth.admin.getUserById` because Supabase puts `email` in the access token
whether or not it has been confirmed. Were it a bearer token this feature could
not exist in an inbox at all. Invitations expire after `INVITE_DAYS` (14),
derived from the stamp rather than stored — nothing sweeps the table — and
cancelling is silent.

**Every push in `sync.ts` is owner-aware, and two filters are load-bearing.**
`pushBook` skips the `books` upsert for a book somebody else owns and sends only
the **changed** chapter rows (`changedChapterIds`) — it used to upsert the whole
list on any change to the book, including a word count bumped by autosave
elsewhere, which silently reverted a co-writer's renames. `uploadLibrary` and the
strays filter in `syncWithServer` both exclude books with a foreign `ownerId`:
without that, revoking access makes the book local-but-not-remote, so the
ex-collaborator's next load takes it for unsaved work and re-uploads somebody
else's manuscript under their own account. A book that stops arriving is marked
`access: "lost"` rather than deleted, because a half-failed fetch and a revocation
look identical.

**A new column `fetchLibrary` selects must degrade when its migration is absent.**
`chapter_bodies.rev` is asked for, and a 42703 falls back to the shape that worked
before (`hasRevColumn`, `missingColumn`) — PostgREST refuses the *whole* select
for one unknown column, so without that the entire library download fails for
everybody, over a feature they may not use. Same lesson as `pushBook`'s
`publishing` retry. Errors here are printed field by field via `describe()`: a
PostgrestError is a plain object and `console.error` renders one as `{}`.

**Read-only has to be true, not merely claimed.** `canWriteBook` gates the
editor's `editable`, the title input, the chapter sidebar's and book panel's
controls, and — through `useToolSave` returning `dirty: false` — every tool
screen's Save bar at once. `saveBody` refuses to write localStorage for a book
this writer may not write, so a viewer's copy cannot silently diverge from the one
everybody else sees.

**`docs/checks/collaboration-rls-check.sql` is how this was verified**, and it is
kept because reading a migration back proves nothing. Two things about running it
are the trap: the SQL editor connects as `postgres`, which **bypasses RLS** — so a
policy test means nothing there unless it first does `set local role
authenticated` and sets `request.jwt.claims`, while trigger tests need no such
thing because triggers fire for everyone. And a check for surviving old policies
must be **scoped to the five manuscript tables**: `prefs`, `library_claims` and
the billing tables keep their `*_owner_*` policies on purpose, so a schema-wide
scan reports the design as a failure. All of it passed against the live project on
2026-08-07, injection probe included.

**A collaborator may take themselves off a book**, and until the invite links
started auto-accepting they could not: only the owner could remove anybody, so a
stray link was a book on your shelf permanently and a message to the owner to
get it off again. `leaveBook` in `src/app/collab/actions.ts` is the invitee's
side of `removeMember`, and the two are kept apart rather than sharing one
function precisely because they authorise differently: **`leaveBook` takes a
book id and never a member id**, finding the row by the caller's own user id, so
there is no argument anybody can pass that reaches somebody else's membership.
`removeMember` may take a member id because it checks book ownership first; this
one has no such check to make, so it must not accept the id at all. The row is
revoked rather than deleted, like a removal — the seat comes back either way,
and a deleted row would lose the record that this address was ever on the book,
which the invitation's unique index needs to let them be invited again cleanly.
The client follows with `deleteBook`, which is safe on a shared book because it
refuses to push a deletion for a book somebody else owns: without it the shelf
would keep the book until the next sync marked it "No longer shared", which is
the wording for *being removed* and reads as a fault rather than as the thing
just done.

*Not built:* presence, the resolve-a-conflict control, and ownership transfer. The
conflict guard's *data* half is done (`rev`, a conditional update, and a conflict
set that stops `applyRemote` overwriting the text it preserved) but nothing yet
asks the writer which version to keep. See TODO.md, which also records the
account-deletion hazard: `books.owner` cascades, so deleting an owner deletes the
book out from under its collaborators.


