-- OpenChapter — does the collaboration migration actually hold?
--
-- Safe to run on live data. Every write it attempts is one the database is
-- supposed to refuse or overwrite, and anything that could succeed if a guard
-- were missing is put back immediately. It never touches a chapter's prose.
--
-- Read the RESULT column. Anything that is not PASS or INFO wants looking at.
--
-- One caveat, and it is why the tests come in two kinds: the SQL editor
-- connects as `postgres`, which BYPASSES row-level security. So the trigger
-- tests (B) are honest as they stand, because triggers fire for everyone —
-- while the policy tests (C) have to *impersonate* an ordinary signed-in reader
-- to mean anything at all. Without that impersonation every query in C would
-- return everything and look like a catastrophic leak that is really just
-- superuser access.

drop table if exists _check;
create temp table _check(step text, result text, detail text);

-- ---------------------------------------------------------------------------
-- A. Is the migration even here?
-- ---------------------------------------------------------------------------

insert into _check
select 'A1. book_members table',
       case when count(*) = 1 then 'PASS' else 'FAIL - migration not applied' end,
       count(*) || ' table(s)'
  from information_schema.tables
 where table_schema = 'public' and table_name = 'book_members';

insert into _check
select 'A2. owner-deriving triggers',
       case when count(*) >= 4 then 'PASS' else 'FAIL - expected 4 or more' end,
       coalesce(string_agg(tgname, ', ' order by tgname), 'none')
  from pg_trigger
 where not tgisinternal
   and tgname in ('chapters_derive_owner', 'chapter_bodies_derive_owner',
                  'chapter_notes_derive_owner', 'book_covers_derive_owner');

insert into _check
select 'A3. the three RLS helpers',
       case when count(*) = 3 then 'PASS' else 'FAIL - expected 3' end,
       coalesce(string_agg(proname, ', ' order by proname), 'none')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('book_role', 'shared_book_ids', 'writable_book_ids');

-- The old owner-only policies must be GONE, not sitting alongside the new ones.
-- A leftover "with check (auth.uid() = owner)" on chapters is permissive, so it
-- ORs itself back in and re-opens the very hole this migration closed.
insert into _check
select 'A4. old owner-only policies dropped',
       case when count(*) = 0 then 'PASS' else 'FAIL - still present' end,
       coalesce(string_agg(policyname, ', '), 'none left')
  from pg_policies
 where schemaname = 'public'
   -- Scoped to the five tables the migration rebuilds, and that scope is the
   -- whole point: `prefs`, `library_claims` and the three billing tables keep
   -- their own `*_owner_*` policies on purpose — a collaborator's theme is not
   -- part of anybody's manuscript and a payment row is shared with nobody. A
   -- schema-wide scan reports those as a failure that is really the design.
   and tablename in ('books','chapters','chapter_bodies','chapter_notes','book_covers')
   and policyname like '%\_owner\_%';

insert into _check
select 'A5. chapter_bodies gained rev and book_id',
       case when count(*) = 2 then 'PASS' else 'FAIL - expected both' end,
       coalesce(string_agg(column_name, ', ' order by column_name), 'neither')
  from information_schema.columns
 where table_schema = 'public' and table_name = 'chapter_bodies'
   and column_name in ('rev', 'book_id');

-- ---------------------------------------------------------------------------
-- B. The triggers, tested for real.
-- ---------------------------------------------------------------------------

do $b$
declare
  cid text; bid text; other_book text; real_owner uuid; got uuid;
  outcome text; note text;
begin
  select c.id, c.book_id, c.owner into cid, bid, real_owner
    from public.chapters c limit 1;

  if cid is null then
    insert into _check values ('B1. owner is derived, never accepted', 'SKIP', 'no chapters yet');
    insert into _check values ('B2. a chapter cannot change books', 'SKIP', 'no chapters yet');
    return;
  end if;

  -- B1: send a deliberately wrong owner and see whether it sticks.
  --
  -- Without this trigger a co-writer's uuid lands on the owner's rows, and
  -- every one of those columns cascades to auth.users — so that co-writer
  -- closing their account would silently delete the owner's chapters and prose.
  begin
    update public.chapters
       set owner = '00000000-0000-0000-0000-000000000000'
     where id = cid;
    select owner into got from public.chapters where id = cid;
    if got = real_owner then
      outcome := 'PASS'; note := 'database overwrote the value sent';
    else
      outcome := 'FAIL'; note := 'client value was accepted';
      update public.chapters set owner = real_owner where id = cid;
    end if;
  exception when others then
    -- A foreign-key refusal also means the bogus owner never landed.
    outcome := 'PASS'; note := 'refused: ' || sqlerrm;
  end;
  insert into _check values ('B1. owner is derived, never accepted', outcome, note);

  -- B2: the one thing row-level security structurally cannot catch, because it
  -- checks the old row and the new row separately — and an editor moving a
  -- chapter into their own book satisfies both halves.
  select id into other_book from public.books where id <> bid limit 1;
  if other_book is null then
    insert into _check values ('B2. a chapter cannot change books', 'SKIP', 'only one book on this project');
  else
    begin
      update public.chapters set book_id = other_book where id = cid;
      update public.chapters set book_id = bid where id = cid;
      insert into _check values ('B2. a chapter cannot change books', 'FAIL', 'the move was allowed');
    exception when others then
      if sqlerrm like '%cannot be moved between books%' then
        insert into _check values ('B2. a chapter cannot change books', 'PASS', sqlerrm);
      else
        insert into _check values ('B2. a chapter cannot change books', 'CHECK', 'refused, but by: ' || sqlerrm);
      end if;
    end;
  end if;
end
$b$;

-- ---------------------------------------------------------------------------
-- C. The policies, tested as a stranger rather than as postgres.
-- ---------------------------------------------------------------------------

do $c$
declare
  stranger constant uuid := '11111111-1111-1111-1111-111111111111';
  a_book text; n_books int; n_chapters int; n_bodies int;
  injected boolean := false;
begin
  select id into a_book from public.books limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n_books from public.books;
  select count(*) into n_chapters from public.chapters;
  select count(*) into n_bodies from public.chapter_bodies;

  -- The pre-existing hole: "with check (auth.uid() = owner)" let any signed-in
  -- account insert a chapter into any book whose id it knew, because book_id is
  -- only a foreign key — it proves the book exists, nothing about who owns it.
  if a_book is not null then
    begin
      insert into public.chapters (id, book_id, owner, title, words, position)
      values ('rls-probe-once', a_book, stranger, 'probe', 0, 0);
      injected := true;
    exception when others then
      injected := false;
    end;
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Belt and braces: if the probe did land, it does not stay.
  delete from public.chapters where id = 'rls-probe-once';

  insert into _check values ('C1. a stranger sees no books',
    case when n_books = 0 then 'PASS' else 'FAIL' end, n_books || ' visible');
  insert into _check values ('C2. a stranger sees no chapters',
    case when n_chapters = 0 then 'PASS' else 'FAIL' end, n_chapters || ' visible');
  insert into _check values ('C3. a stranger sees no prose',
    case when n_bodies = 0 then 'PASS' else 'FAIL' end, n_bodies || ' visible');
  insert into _check values ('C4. a stranger cannot inject a chapter',
    case when injected then 'FAIL - THE OLD HOLE IS OPEN' else 'PASS' end,
    case when injected then 'insert succeeded' else 'insert refused' end);
end
$c$;

-- ---------------------------------------------------------------------------
-- D. What is actually there, for context rather than judgement.
-- ---------------------------------------------------------------------------

insert into _check
select 'D1. this project holds', 'INFO',
       (select count(*) from public.books) || ' books, ' ||
       (select count(*) from public.chapters) || ' chapters';

insert into _check
select 'D2. collaboration rows', 'INFO',
       (select count(*)::text from public.book_members) || ' member row(s)';

select step, result, detail from _check order by step;
