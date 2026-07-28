-- OpenChapter library schema.
--
-- Mirrors the split in src/lib/library-store.ts, and for the same reason: by
-- write-cost, not by type. Opening a shelf must not fetch prose, so bodies,
-- notes and covers each get their own table rather than riding along on the
-- book row.
--
-- Ids are TEXT, not UUID, on purpose. The app mints its own with newId(), which
-- falls back to `${Date.now().toString(36)}-${random}` when crypto.randomUUID is
-- unavailable — it needs a secure context, and plain http://<lan-ip>:3000 is not
-- one. Those ids are not UUIDs and a uuid column would reject them.

-- ---------------------------------------------------------------------------
-- updated_at, set by the server
--
-- Last-write-wins across two machines has to compare a clock both of them
-- trust. A device clock can be wrong by hours; now() cannot.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id              text primary key,
  owner           uuid not null references auth.users (id) on delete cascade,

  title           text not null,
  subtitle        text,
  author          text,
  kind            text,
  genre           text,
  target_words    integer,

  -- Absent rather than false in the client type; null here means the same.
  bare_cover      boolean,

  -- Structured, optional, and versioned by their own modules (page-setup.ts,
  -- typography.ts). jsonb keeps a settings change from being a migration.
  page            jsonb,
  typography      jsonb,

  -- Soft delete, both kinds. trashed_at wins over archived_at, as in booksIn().
  archived_at     timestamptz,
  trashed_at      timestamptz,

  last_opened_id  text,
  last_opened_at  timestamptz not null default now(),

  -- Shelf order is by recency or title, computed on read — but position keeps
  -- an explicit order available if the shelf ever gains manual sorting.
  position        integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists books_owner_idx on public.books (owner);

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chapters — meta only, never prose
--
-- Trashed chapters stay in this table and gain trashed_at, mirroring the
-- client's soft delete: the body and notes stay at their own keys so a restore
-- is lossless.
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id           text primary key,
  book_id      text not null references public.books (id) on delete cascade,
  owner        uuid not null references auth.users (id) on delete cascade,

  title        text not null,
  -- Denormalised, summed on read by the client and never trusted as a total.
  words        integer not null default 0,
  position     integer not null default 0,

  -- null means a body chapter. See ChapterMatter / chapterMatterOf.
  matter       text check (matter in ('front', 'back')),
  -- Marks the single generated front/back page, so the sidebar reopens it
  -- rather than adding a second copy.
  matter_key   text check (matter_key in ('front', 'back')),

  bookmarked   boolean,
  trashed_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists chapters_book_idx on public.chapters (book_id, position);
create index if not exists chapters_owner_idx on public.chapters (owner);

drop trigger if exists chapters_set_updated_at on public.chapters;
create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chapter_bodies — the Tiptap document, one row per chapter
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_bodies (
  chapter_id  text primary key references public.chapters (id) on delete cascade,
  owner       uuid not null references auth.users (id) on delete cascade,
  doc         jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists chapter_bodies_owner_idx on public.chapter_bodies (owner);

drop trigger if exists chapter_bodies_set_updated_at on public.chapter_bodies;
create trigger chapter_bodies_set_updated_at
  before update on public.chapter_bodies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chapter_notes
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_notes (
  chapter_id  text primary key references public.chapters (id) on delete cascade,
  owner       uuid not null references auth.users (id) on delete cascade,
  text        text not null default '',
  updated_at  timestamptz not null default now()
);

create index if not exists chapter_notes_owner_idx on public.chapter_notes (owner);

drop trigger if exists chapter_notes_set_updated_at on public.chapter_notes;
create trigger chapter_notes_set_updated_at
  before update on public.chapter_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- book_covers
--
-- Data URLs, capped client-side at 250KB. Their own table so a shelf read never
-- drags cover art along with it. Supabase Storage is the better home; that is a
-- later move and does not change the client API.
-- ---------------------------------------------------------------------------
create table if not exists public.book_covers (
  book_id     text primary key references public.books (id) on delete cascade,
  owner       uuid not null references auth.users (id) on delete cascade,
  data_url    text not null,
  updated_at  timestamptz not null default now()
);

create index if not exists book_covers_owner_idx on public.book_covers (owner);

drop trigger if exists book_covers_set_updated_at on public.book_covers;
create trigger book_covers_set_updated_at
  before update on public.book_covers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prefs — one row per writer
--
-- jsonb rather than columns: Prefs grows whenever a new writer-facing toggle
-- ships, and none of it is ever queried by field.
-- ---------------------------------------------------------------------------
create table if not exists public.prefs (
  owner       uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists prefs_set_updated_at on public.prefs;
create trigger prefs_set_updated_at
  before update on public.prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- library_claims — has this writer's local library been uploaded yet?
--
-- The first sign-in on a browser holding books needs to push them up exactly
-- once. Without a record of having done it, deleting a book on another device
-- would let a stale local cache resurrect it on the next sync.
-- ---------------------------------------------------------------------------
create table if not exists public.library_claims (
  owner       uuid primary key references auth.users (id) on delete cascade,
  claimed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Every table, every command. A writer sees their own rows and nothing else.
-- The project has automatic RLS switched on, but stating it here means this
-- file is correct on any project it is applied to.
--
-- UPDATE needs a USING clause as well as WITH CHECK: Postgres has to SELECT the
-- row before it can update it, and without a readable row the update silently
-- affects zero rows rather than erroring.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'books', 'chapters', 'chapter_bodies', 'chapter_notes',
    'book_covers', 'prefs', 'library_claims'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = owner)',
      t || '_owner_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = owner)',
      t || '_owner_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = owner) with check (auth.uid() = owner)',
      t || '_owner_update', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = owner)',
      t || '_owner_delete', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Data API access
--
-- This project was created with "Automatically expose new tables" off, so the
-- API roles have no privileges on anything made here until granted. RLS above
-- decides which rows; this decides whether the table is reachable at all.
--
-- authenticated only. anon is never granted anything: there is nothing in this
-- schema a signed-out visitor should reach.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.books,
  public.chapters,
  public.chapter_bodies,
  public.chapter_notes,
  public.book_covers,
  public.prefs,
  public.library_claims
to authenticated;
