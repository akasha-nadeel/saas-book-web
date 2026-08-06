-- OpenChapter collaboration — one owner, and the people they let in.
--
-- Two stored roles: 'editor' may write the manuscript, 'viewer' may read it.
-- The owner is not stored as a role at all; it is `books.owner`, and it stays
-- the one fact about a book that nothing else can change.
--
-- The line between editor and owner is drawn around the *manuscript* — chapters,
-- prose, notes — and nowhere else. The books row, the cover, the page setup, the
-- typography, the listing details, archive and trash stay the owner's alone.
-- That is not timidity about permissions: `last_opened_id`, `last_opened_at` and
-- `position` are per-writer state that happens to live on the shared books row,
-- so a collaborator writing that row would overwrite the owner's "where you left
-- off" every few minutes. Until those move to a per-user table of their own, the
-- books row cannot be shared for writing without lying to somebody.
--
-- ---------------------------------------------------------------------------
-- Three rules this file enforces that the client cannot
-- ---------------------------------------------------------------------------
--
-- 1. **`owner` on every child row is derived, never accepted.** A trigger sets it
--    to the *book's* owner. Every push in `sync.ts` sets it from the signed-in
--    writer, which under collaboration would stamp an editor's uuid on the
--    owner's chapters and prose — and every one of those columns is
--    `on delete cascade` to `auth.users`. An editor closing their account would
--    have taken the owner's manuscript with them, silently, through the one path
--    nobody tests.
--
-- 2. **Write permission is decided by the *book*, never by the row's own `owner`
--    field.** This replaces rather than extends the policies in
--    20260729000000_library.sql, and that is the point: `with check (auth.uid() =
--    owner)` is satisfied by any signed-in stranger simply by claiming the row.
--    Today that is *already true* of `chapters` — `book_id` is a foreign key,
--    which proves the book exists and nothing about who owns it — and it is
--    invisible only because the victim's select is also `owner = auth.uid()`.
--    Making select book-scoped, which sharing requires, would have turned a
--    latent hole into injected chapters appearing in a stranger's sidebar. So the
--    old policies are dropped. An extra permissive policy would have ORed itself
--    onto them and left this file as decoration.
--
-- 3. **A chapter cannot change books, and prose cannot change chapters.** RLS
--    compares USING against the old row and WITH CHECK against the new one, and
--    is satisfied by both being writable — which is exactly where an editor
--    stands when they move a chapter out of the owner's book and into their own.
--    Only a trigger can see that a key moved.
--
-- `book_members` is written by nothing but the server: there is no insert, update
-- or delete grant on it for `authenticated` at all, on the pattern
-- 20260730120000_billing.sql uses for `subscriptions`. The seat cap depends on
-- `isPro()` and `isBillingConfigured()`, which are TypeScript facts, so the
-- decision cannot live in a policy — and a grant that does not exist is the part
-- a browser with devtools cannot argue with.

-- ---------------------------------------------------------------------------
-- A drive-by, because it is one line and this file adds five more definers
--
-- set_updated_at() from the first migration has no `set search_path`. It is
-- security invoker so it is not an escalation, but Supabase's linter flags it
-- and every function below has to get this right anyway.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- book_members
--
-- One row per person per book, pending invitations included. Keyed on its own
-- uuid rather than on (book_id, email) because a revoked row is history worth
-- keeping and a re-invitation is a new row.
-- ---------------------------------------------------------------------------
create table if not exists public.book_members (
  id             uuid primary key default gen_random_uuid(),

  -- TEXT like every id in this schema — see the note at the top of
  -- 20260729000000_library.sql. Cascade, because a membership of a book that no
  -- longer exists is not a membership.
  book_id        text not null references public.books (id) on delete cascade,

  -- Who was asked. Stored lowercased and *checked* to be, rather than lowercased
  -- on read: a policy comparing lower(invited_email) cannot use an index on it,
  -- and the one comparison this column exists for happens inside a policy.
  invited_email  text not null
                   check (invited_email = lower(invited_email))
                   check (position('@' in invited_email) > 1)
                   check (char_length(invited_email) <= 320),

  -- Null until accepted. Cascade: a collaborator closing their account leaves
  -- the book, and their membership is the only thing that goes with them.
  user_id        uuid references auth.users (id) on delete cascade,

  role           text not null check (role in ('editor', 'viewer')),
  status         text not null check (status in ('pending', 'active', 'revoked')),

  -- What the invitation link carries, minted server-side and never granted to
  -- `authenticated` (see the column grant at the foot of this file). Acceptance
  -- goes by this, never by the email claim in a JWT: Supabase puts `email` in
  -- the token whether or not it has been confirmed, so matching on it would let
  -- somebody sign up as victim@company.com, never confirm, and accept their
  -- invitation.
  token          text not null unique,

  -- SET NULL, not cascade, and *not* the default. NO ACTION is what you get by
  -- omitting this, and a NO ACTION reference to auth.users from a table like
  -- this makes deleting the *inviter's* account fail with a foreign key
  -- violation. Account deletion is the last thing a sharing feature should be
  -- allowed to block.
  invited_by     uuid references auth.users (id) on delete set null,

  -- A pending invitation nobody answered has to stop being an open door.
  -- Nothing sweeps this table: expiry is a predicate, compared against now()
  -- everywhere it matters, so it is a fact about the row rather than a job that
  -- can fail to run.
  expires_at     timestamptz not null default now() + interval '14 days',

  created_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  updated_at     timestamptz not null default now(),

  -- An active membership with nobody attached would make book_role() answer for
  -- `auth.uid() is null`.
  constraint book_members_active_has_user
    check (status <> 'active' or user_id is not null)
);

-- The hot path: "which books am I in", asked by shared_book_ids() on every query
-- a collaborator runs.
create index if not exists book_members_mine_idx
  on public.book_members (user_id, book_id) where status = 'active';

-- The owner's own list, for the share dialog.
create index if not exists book_members_book_idx
  on public.book_members (book_id);

-- One live invitation per address per book. This is also half the seat cap:
-- without it, pressing Invite twice on a slow connection spends two seats on one
-- person.
create unique index if not exists book_members_one_live_invite
  on public.book_members (book_id, invited_email) where status <> 'revoked';

-- One active membership per person per book, so book_role() has one answer.
create unique index if not exists book_members_one_active_user
  on public.book_members (book_id, user_id) where status = 'active';

drop trigger if exists book_members_set_updated_at on public.book_members;
create trigger book_members_set_updated_at
  before update on public.book_members
  for each row execute function public.set_updated_at();

comment on table public.book_members is
  'Who may read or write a book besides its owner. Written only by the server — see invite_book_member().';

-- ---------------------------------------------------------------------------
-- book_id on the two child tables
--
-- chapter_bodies and chapter_notes are keyed on chapter_id alone, so a policy on
-- them has to reach through `chapters` to find the book. Reaching in through a
-- security definer helper bypasses chapters' own RLS, which would make a body
-- readable without its chapter being visible; reaching in inline makes this
-- table's security depend on another table's policy. Carrying the id makes all
-- five manuscript tables the same shape, and makes the member branch of every
-- policy an indexed `= ANY` rather than a per-row function call.
--
-- Filled by trigger from the chapter, never by the client, so a row cannot claim
-- to belong to a book it does not.
-- ---------------------------------------------------------------------------
alter table public.chapter_bodies
  add column if not exists book_id text references public.books (id) on delete cascade;
alter table public.chapter_notes
  add column if not exists book_id text references public.books (id) on delete cascade;

update public.chapter_bodies b
   set book_id = c.book_id
  from public.chapters c
 where c.id = b.chapter_id and b.book_id is null;

update public.chapter_notes n
   set book_id = c.book_id
  from public.chapters c
 where c.id = n.chapter_id and n.book_id is null;

-- Total, because chapter_id is already a foreign key: there is no body without a
-- chapter to take the book from.
alter table public.chapter_bodies alter column book_id set not null;
alter table public.chapter_notes  alter column book_id set not null;

create index if not exists chapter_bodies_book_idx on public.chapter_bodies (book_id);
create index if not exists chapter_notes_book_idx  on public.chapter_notes (book_id);

-- ---------------------------------------------------------------------------
-- The conflict guard on prose
--
-- Two people in one chapter is a merge this app is not going to do. What it can
-- do is refuse to lose anything silently: the writer sends the revision they
-- last saw, and a push matching nothing means somebody moved the text under
-- them. Zero rows affected, no error, and the local copy is kept.
--
-- `rev` is bumped by the trigger rather than sent by the client, for the same
-- reason `owner` is derived: a number the writer supplies is a number the writer
-- can supply wrongly, and this one is the whole guard.
--
-- An integer rather than a comparison against updated_at, because timestamptz
-- equality through PostgREST is a text-formatting problem waiting to happen.
-- ---------------------------------------------------------------------------
alter table public.chapter_bodies
  add column if not exists rev integer not null default 0;
alter table public.chapter_bodies
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Normalising triggers
--
-- security definer on all of them: a trigger function is invoker by default, so
-- reading public.books from inside one applies the *writer's* RLS to that read.
-- It would work today by accident — a collaborator can select the book — and
-- break the moment a policy narrows.
--
-- search_path is emptied, so every name is schema-qualified. pg_catalog is
-- always searched implicitly, which is why now() and lower() need no prefix.
-- ---------------------------------------------------------------------------

-- A chapter's owner is its book's owner, and its book never changes.
create or replace function public.chapters_derive_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  book_owner uuid;
begin
  if tg_op = 'UPDATE' then
    -- RLS cannot see this. USING checks the old row and WITH CHECK the new one,
    -- and an editor moving a chapter out of the owner's book into their own
    -- satisfies both — the theft is invisible to a policy and obvious here.
    if new.book_id <> old.book_id then
      raise exception 'a chapter cannot be moved between books'
        using errcode = 'check_violation';
    end if;
    if new.id <> old.id then
      raise exception 'a chapter id cannot change'
        using errcode = 'check_violation';
    end if;
  end if;

  select b.owner into book_owner from public.books b where b.id = new.book_id;
  if book_owner is null then
    raise exception 'no book % to attach this chapter to', new.book_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Not "if the client got it wrong" — always. What the client sent is never
  -- consulted.
  new.owner := book_owner;
  return new;
end
$$;

-- A body's or a note's book and owner both come from its chapter.
create or replace function public.chapter_child_derive_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bid text;
  book_owner uuid;
begin
  if tg_op = 'UPDATE' and new.chapter_id <> old.chapter_id then
    raise exception 'prose cannot be moved between chapters'
      using errcode = 'check_violation';
  end if;

  select c.book_id into bid from public.chapters c where c.id = new.chapter_id;
  if bid is null then
    raise exception 'no chapter % to attach this to', new.chapter_id
      using errcode = 'foreign_key_violation';
  end if;

  select b.owner into book_owner from public.books b where b.id = bid;

  new.book_id := bid;
  new.owner := book_owner;
  return new;
end
$$;

create or replace function public.book_covers_derive_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  book_owner uuid;
begin
  select b.owner into book_owner from public.books b where b.id = new.book_id;
  if book_owner is null then
    raise exception 'no book % to attach this cover to', new.book_id
      using errcode = 'foreign_key_violation';
  end if;
  new.owner := book_owner;
  return new;
end
$$;

-- rev and updated_by, on the one table with a conflict to guard.
create or replace function public.chapter_bodies_bump_rev()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.rev := old.rev + 1;
  else
    new.rev := 0;
  end if;
  -- Null when written by the secret key, which has no session. That is the
  -- honest answer rather than a missing one.
  new.updated_by := auth.uid();
  return new;
end
$$;

drop trigger if exists chapters_derive_owner on public.chapters;
create trigger chapters_derive_owner
  before insert or update on public.chapters
  for each row execute function public.chapters_derive_owner();

drop trigger if exists chapter_bodies_derive_owner on public.chapter_bodies;
create trigger chapter_bodies_derive_owner
  before insert or update on public.chapter_bodies
  for each row execute function public.chapter_child_derive_owner();

drop trigger if exists chapter_bodies_bump_rev on public.chapter_bodies;
create trigger chapter_bodies_bump_rev
  before insert or update on public.chapter_bodies
  for each row execute function public.chapter_bodies_bump_rev();

drop trigger if exists chapter_notes_derive_owner on public.chapter_notes;
create trigger chapter_notes_derive_owner
  before insert or update on public.chapter_notes
  for each row execute function public.chapter_child_derive_owner();

drop trigger if exists book_covers_derive_owner on public.book_covers;
create trigger book_covers_derive_owner
  before insert or update on public.book_covers
  for each row execute function public.book_covers_derive_owner();

-- Rows written before the triggers existed. There should be none that differ;
-- any that do were injected through rule 2 above, because nothing in the client
-- has ever written a child row under a book it did not own.
update public.chapters c
   set owner = b.owner
  from public.books b
 where b.id = c.book_id and c.owner <> b.owner;

update public.chapter_bodies x
   set owner = b.owner
  from public.books b
 where b.id = x.book_id and x.owner <> b.owner;

update public.chapter_notes x
   set owner = b.owner
  from public.books b
 where b.id = x.book_id and x.owner <> b.owner;

update public.book_covers x
   set owner = b.owner
  from public.books b
 where b.id = x.book_id and x.owner <> b.owner;

-- ---------------------------------------------------------------------------
-- The helpers the policies are built from
--
-- security definer on all of them, and that is what keeps book_members' policies
-- and books' policies from eating each other. books' select asks "am I a
-- member", which reads book_members; book_members' select asks "do I own this
-- book", which reads books. Written inline, in either direction, that is
-- `42P17 infinite recursion detected in policy for relation`. A definer function
-- reads as the table owner, RLS does not apply to its reads, and the loop is cut
-- in one place rather than avoided by luck.
--
-- Two consequences, both load-bearing:
--
--   - Do **not** `alter table ... force row level security` on books or
--     book_members. FORCE applies policies to the table owner too, which puts
--     the recursion straight back.
--   - Do **not** "simplify" any of these to security invoker. It fails as a
--     runtime error on a query nobody tested, not as a migration error.
--
-- `stable`, not volatile, and it matters: `book_id in (select f())` with a stable
-- set-returning function becomes one hashed subplan evaluated once per statement.
-- Volatile would re-run it per row, which on a table holding every writer's
-- chapters is a sequential scan on every page load.
--
-- `rows 20` because the planner otherwise assumes 1000 and prefers a hash join
-- to the index. A person is in a handful of shared books, not a thousand.
--
-- **None of them take a user id.** A two-argument book_role(bid, uid) would hand
-- any signed-in reader the ability to probe anybody's role on anybody's book, and
-- a definer function is exactly the wrong place to accept one. They also answer
-- null for a book that does not exist as well as for one you are not in, so they
-- cannot be used to ask whether an id is real.
-- ---------------------------------------------------------------------------

-- Books shared *with* me. Owned books are deliberately absent: every policy keeps
-- `owner = (select auth.uid())` as its first branch so the common case stays an
-- index scan, and this set stays tiny.
create or replace function public.shared_book_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 20
as $$
  select m.book_id
    from public.book_members m
   where m.user_id = auth.uid()
     and m.status = 'active'
$$;

-- Books I may write the manuscript of: mine, plus the ones I am an editor on.
--
-- This is the *whole* test for a write. The row's own `owner` column is not
-- consulted, so it does not matter in which order Postgres evaluates a BEFORE
-- trigger and a WITH CHECK — and a permission model should not rest on knowing
-- that.
create or replace function public.writable_book_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
rows 20
as $$
  select b.id from public.books b where b.owner = auth.uid()
  union
  select m.book_id from public.book_members m
   where m.user_id = auth.uid() and m.status = 'active' and m.role = 'editor'
$$;

-- 'owner' | 'editor' | 'viewer' | null, for one book, for the caller.
create or replace function public.book_role(bid text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.books b where b.id = bid and b.owner = auth.uid()
    ) then 'owner'
    else (
      select m.role
        from public.book_members m
       where m.book_id = bid
         and m.user_id = auth.uid()
         and m.status = 'active'
       limit 1
    )
  end
$$;

-- Policies run with the privileges of whoever is querying, so a policy calling a
-- function the querying role cannot execute fails with "permission denied for
-- function" rather than with "no rows". EXECUTE defaults to PUBLIC on every new
-- function, which includes `anon`; these return nothing useful to a signed-out
-- caller, but a definer function reachable by anon is a habit worth not forming.
revoke execute on function public.shared_book_ids() from public;
revoke execute on function public.writable_book_ids() from public;
revoke execute on function public.book_role(text) from public;

grant execute on function public.shared_book_ids() to authenticated;
grant execute on function public.writable_book_ids() to authenticated;
grant execute on function public.book_role(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security, replaced
--
-- The owner-only policies from 20260729000000 are dropped and rebuilt rather
-- than added to — see rule 2 at the top of this file for why adding would have
-- left the hole open.
--
-- **Every auth.uid() is wrapped in (select ...)**, and this is about the index
-- rather than only the initplan. Bare, it is a stable function call in the qual
-- that the planner evaluates per row. Wrapped, it becomes an InitPlan evaluated
-- once and the predicate reads `owner = $0`, which books_owner_idx and
-- chapters_owner_idx can serve. On tables holding every writer's chapters that is
-- the difference between an index scan and a sequential one.
--
-- UPDATE gets both USING and WITH CHECK, for the reason the first migration
-- gives: without a readable row the update affects nothing and reports nothing.
--
-- `prefs` and `library_claims` are untouched and stay owner-only. Both are keyed
-- on owner with no book, so there is nothing for a member branch to be about —
-- a collaborator's theme is not part of anybody's manuscript.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'books', 'chapters', 'chapter_bodies', 'chapter_notes', 'book_covers'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);
  end loop;
end
$$;

-- books: read by anyone in the book, written by the owner alone.
drop policy if exists books_select on public.books;
create policy books_select on public.books
  for select to authenticated
  using (
    owner = (select auth.uid())
    or id in (select public.shared_book_ids())
  );

drop policy if exists books_insert on public.books;
create policy books_insert on public.books
  for insert to authenticated
  with check (owner = (select auth.uid()));

-- No member branch, and no clause letting `owner` move: an owner may not hand a
-- book to somebody else by updating this column. Transfer of ownership, if it is
-- ever wanted, is a server action that knows what it is doing.
drop policy if exists books_update on public.books;
create policy books_update on public.books
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists books_delete on public.books;
create policy books_delete on public.books
  for delete to authenticated
  using (owner = (select auth.uid()));

-- chapters, chapter_bodies, chapter_notes: the manuscript. Read by anyone in the
-- book, written by the owner and by editors.
--
-- Insert and update are decided *only* by which book the row is in. `owner`
-- appears nowhere in a write check, on purpose — it is derived by trigger, so a
-- check against it would be a check against ourselves.
do $$
declare
  t text;
begin
  foreach t in array array['chapters', 'chapter_bodies', 'chapter_notes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (owner = (select auth.uid())
                or book_id in (select public.shared_book_ids()))',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (book_id in (select public.writable_book_ids()))',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (book_id in (select public.writable_book_ids()))
         with check (book_id in (select public.writable_book_ids()))',
      t || '_update', t
    );
  end loop;
end
$$;

-- **Delete is the owner's, not the editor's, and the asymmetry is deliberate.**
--
-- An editor's "delete chapter" is already `trashed_at` — an update, which they
-- have, and which the app has always used so a restore is lossless. A DELETE on
-- `chapters` is a *hard* delete that cascades to the body and the notes, and
-- `pushShelfDiff` issues it from a **local** diff: any local shelf that has lost
-- a chapter, for any reason including a quota-truncated download, would become a
-- delete statement against somebody else's manuscript. An owner emptying their
-- own trash is a decision; a collaborator's browser running out of room is not.
do $$
declare
  t text;
begin
  foreach t in array array['chapters', 'chapter_bodies', 'chapter_notes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (owner = (select auth.uid()))',
      t || '_delete', t
    );
  end loop;
end
$$;

-- book_covers: read by anyone in the book, so a shared book keeps its jacket on
-- the collaborator's shelf. Written by the owner alone — a cover is part of how
-- the book is presented rather than part of the manuscript.
drop policy if exists book_covers_select on public.book_covers;
create policy book_covers_select on public.book_covers
  for select to authenticated
  using (
    owner = (select auth.uid())
    or book_id in (select public.shared_book_ids())
  );

drop policy if exists book_covers_insert on public.book_covers;
create policy book_covers_insert on public.book_covers
  for insert to authenticated
  with check (book_id in (
    select b.id from public.books b where b.owner = (select auth.uid())
  ));

drop policy if exists book_covers_update on public.book_covers;
create policy book_covers_update on public.book_covers
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists book_covers_delete on public.book_covers;
create policy book_covers_delete on public.book_covers
  for delete to authenticated
  using (owner = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- book_members' own policies
--
-- Select only. There is no insert, update or delete policy here, and that is not
-- an omission — with RLS on and no policy for a command, the command returns
-- nothing to `authenticated` whatever it asks, the way `feedback` has no select
-- policy. The grants below say the same thing again, so both halves have to be
-- wrong before anything gets through.
--
-- Three ways a row is visible, each somebody's own business:
--   - it is mine (user_id),
--   - it is on a book I own,
--   - it is a live invitation to my own address, so the app can say "you have
--     been invited" without the writer having to find the link again.
--
-- The third confers access to nothing. Both book_role() and shared_book_ids()
-- require `status = 'active'` **and** `user_id = auth.uid()`, so a pending row
-- grants exactly nothing however it is matched — and `token` is withheld from
-- `authenticated` by column grant, so it cannot be used to accept either.
-- ---------------------------------------------------------------------------
alter table public.book_members enable row level security;

drop policy if exists book_members_select on public.book_members;
create policy book_members_select on public.book_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.book_role(book_id) = 'owner'
    or (
      status = 'pending'
      and expires_at > now()
      -- coalesce to a value no address can equal: a null email claim must match
      -- nothing rather than every row whose invited_email is null (it cannot be,
      -- but the shape of the comparison should not depend on that).
      and invited_email = lower(coalesce((select auth.jwt() ->> 'email'), '~'))
    )
  );

-- ---------------------------------------------------------------------------
-- Inviting somebody, in one statement
--
-- The seat cap's *number* is TypeScript's decision — it needs isPro() and
-- isBillingConfigured() — so it arrives as an argument. **Counting against it is
-- Postgres' job**, because two invitations racing each other each see the
-- other's absence and both get in, and supabase-js has no transaction to wrap a
-- read and a write in. `select ... for update` on the book row is the lock that
-- turns the count into a decision.
--
-- Executable by service_role alone, and it has to be: `max_seats` is a
-- parameter, and a parameter `authenticated` can pass is not a cap. The caller's
-- identity is a parameter too, checked here against books.owner — the admin
-- client has no session of its own, which is the warning in
-- src/lib/supabase/admin.ts honoured rather than repeated.
-- ---------------------------------------------------------------------------
create or replace function public.invite_book_member(
  bid          text,
  email        text,
  member_role  text,
  max_seats    integer,
  invite_token text,
  caller       uuid,
  ttl          interval default interval '14 days'
)
returns public.book_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  book_owner uuid;
  owner_email text;
  seats integer;
  made public.book_members;
begin
  select b.owner into book_owner
    from public.books b where b.id = bid
     for update;                                  -- the lock; see above

  if book_owner is null then
    raise exception 'no such book' using errcode = 'no_data_found';
  end if;
  if book_owner <> caller then
    raise exception 'not the owner of this book' using errcode = 'insufficient_privilege';
  end if;
  if member_role not in ('editor', 'viewer') then
    raise exception 'unknown role %', member_role using errcode = 'check_violation';
  end if;

  -- Inviting yourself would spend a seat on somebody who already holds every
  -- permission there is, and book_role() would answer 'owner' regardless.
  select u.email into owner_email from auth.users u where u.id = book_owner;
  if lower(email) = lower(coalesce(owner_email, '')) then
    raise exception 'that is the owner' using errcode = 'check_violation';
  end if;

  -- **The cap counts the owner**, so free's two is the writer and one other —
  -- the number the pricing page prints. A pending invitation occupies a seat, and
  -- an expired one does not: see seatsUsed() in src/lib/collab.ts, which has to
  -- agree with this arithmetic or the screen and the database disagree about
  -- whether there is room.
  select 1 + count(*) into seats
    from public.book_members m
   where m.book_id = bid
     and (m.status = 'active' or (m.status = 'pending' and m.expires_at > now()));

  if seats >= max_seats then
    raise exception 'seat cap reached' using errcode = 'program_limit_exceeded';
  end if;

  -- **Retire a lapsed invitation to the same address before inserting.** The
  -- partial unique index below covers everything that is not 'revoked', so an
  -- expired-but-still-pending row would make re-inviting somebody a duplicate
  -- key error — and re-inviting the person who never got round to accepting is
  -- the commonest thing an owner will want to do. Retired rather than deleted,
  -- so the history of who was asked and when survives.
  update public.book_members
     set status = 'revoked'
   where book_id = bid
     and invited_email = lower(email)
     and status = 'pending'
     and expires_at <= now();

  insert into public.book_members
    (book_id, invited_email, role, status, token, invited_by, expires_at)
  values
    (bid, lower(email), member_role, 'pending', invite_token, caller, now() + ttl)
  returning * into made;

  return made;
end
$$;

revoke execute on function
  public.invite_book_member(text, text, text, integer, text, uuid, interval)
  from public;
grant execute on function
  public.invite_book_member(text, text, text, integer, text, uuid, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- Accepting one, also in one statement
--
-- The seat cap is re-checked here and not only at invitation, because an owner
-- can drop off Pro with nine invitations outstanding. Same lock, same reason.
--
-- The caller's email is a parameter rather than read from a claim: the Server
-- Action fetches it with auth.admin.getUserById and refuses unless
-- email_confirmed_at is set, which is the check a JWT cannot give us.
-- ---------------------------------------------------------------------------
create or replace function public.accept_book_invite(
  invite_token  text,
  caller        uuid,
  caller_email  text,
  max_seats     integer
)
returns public.book_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.book_members;
  seats integer;
begin
  select * into invite
    from public.book_members
   where token = invite_token;

  if invite.id is null then
    raise exception 'no such invitation' using errcode = 'no_data_found';
  end if;
  if invite.status <> 'pending' then
    raise exception 'that invitation has already been answered'
      using errcode = 'check_violation';
  end if;
  if invite.expires_at <= now() then
    raise exception 'that invitation has expired' using errcode = 'check_violation';
  end if;
  if lower(coalesce(caller_email, '')) <> invite.invited_email then
    raise exception 'that invitation is for somebody else'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the book, then count, so two people accepting at once cannot both take
  -- the last seat.
  perform 1 from public.books b where b.id = invite.book_id for update;

  select 1 + count(*) into seats
    from public.book_members m
   where m.book_id = invite.book_id
     and m.id <> invite.id
     and (m.status = 'active' or (m.status = 'pending' and m.expires_at > now()));

  if seats >= max_seats then
    raise exception 'seat cap reached' using errcode = 'program_limit_exceeded';
  end if;

  update public.book_members
     set status = 'active', user_id = caller, accepted_at = now()
   where id = invite.id
  returning * into invite;

  return invite;
end
$$;

revoke execute on function
  public.accept_book_invite(text, uuid, text, integer) from public;
grant execute on function
  public.accept_book_invite(text, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Data API access
--
-- Same discipline as billing: the browser's privileges and the server's differ
-- in kind and not only in policy.
--
-- **Column-level select, so the invitation token never leaves the server** —
-- anybody who can read a token can accept an invitation addressed to somebody
-- else. `invited_by` is withheld with it: a collaborator has no business learning
-- another account's uuid.
--
-- The consequence is in the client, and it will bite on the first read: PostgREST
-- refuses the whole query if any requested column is ungranted, so **every read
-- of book_members must name its columns**. No `select("*")`.
-- ---------------------------------------------------------------------------
grant select (id, book_id, invited_email, user_id, role, status,
              expires_at, created_at, accepted_at)
  on public.book_members to authenticated;

-- And the server's role. Easy to miss, and it fails misleadingly: the secret key
-- bypasses row-level *security*, not privileges — the same note as in
-- 20260730120000_billing.sql. Without these, inviting somebody reads back
-- nothing, concludes the book does not exist, and says so.
grant select, insert, update, delete on public.book_members to service_role;
grant select on public.books to service_role;
