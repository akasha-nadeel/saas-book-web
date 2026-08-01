-- OpenChapter feedback — a private channel to whoever runs the app.
--
-- One table and one rule: a writer may *write* a note and may never read one,
-- including their own. That is what makes this a suggestion box rather than a
-- forum, and it is enforced here rather than in the client, because a grant is
-- the only thing a reader with devtools cannot argue with.
--
-- Read it from the Supabase dashboard, or with the service key. There is
-- deliberately no screen in the app that lists these: the moment one exists,
-- somebody has to decide what happens when a writer reads another writer's
-- complaint about them.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),

  -- Who sent it. Set from the session by the default below rather than by the
  -- client, so a forged owner is not something the insert policy has to catch.
  -- Nullable and ON DELETE SET NULL: a writer closing their account should not
  -- take a bug report with them, and the note is still worth acting on.
  owner       uuid references auth.users (id) on delete set null
                default auth.uid(),

  -- Matches TOPICS in src/lib/feedback.ts. Constrained rather than free text so
  -- a typo in one release does not quietly create a seventh topic nobody reads.
  topic       text not null
                check (topic in ('editor', 'export', 'tools',
                                 'dashboard', 'account', 'other')),

  -- Null is a real answer: the faces are optional, and "did not say" must stay
  -- distinguishable from "said it was fine". See toRow().
  sentiment   text check (sentiment in ('bad', 'poor', 'fine', 'good')),

  -- The cap is checked in the client too. It is here as well because the client
  -- is a suggestion and this is the thing that holds — 4000 characters is room
  -- to describe a bug properly and far too little to paste a chapter into,
  -- which is the one thing that must never reach this table.
  message     text not null
                check (char_length(message) between 10 and 4000),

  created_at  timestamptz not null default now()
);

-- Reading is by created_at, newest first, and that is the only query there is.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Insert only, and only signed in. No select policy exists at all, which is not
-- an omission: with RLS on, a table with no select policy returns nothing to
-- `authenticated` no matter what it asks for.
--
-- `anon` gets nothing either. Feedback needs an account, so a note always has
-- somebody attached to it and the table cannot be filled by a script.
create policy "writers may leave feedback"
  on public.feedback for insert
  to authenticated
  with check (owner = auth.uid());

grant insert on public.feedback to authenticated;
