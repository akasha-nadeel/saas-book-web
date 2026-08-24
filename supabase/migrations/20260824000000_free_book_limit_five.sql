-- The free plan goes from one book to five, and starts counting the way the
-- rest of the trade counts.
--
-- `20260822071735_launch_mvp_entitlements.sql` wrote this trigger with the
-- number baked in, and that migration may already have been applied, so the
-- change is made here rather than edited into it.
--
-- Two things change.
--
-- **One is now five**, matching `LAUNCH_LIMITS.freeBooks` in
-- `src/lib/launch.ts`. That constant is the other half of this number and the
-- one every screen prints from; change one and change both.
--
-- **Only the active shelf counts.** The old body counted every row a writer
-- owned, trash included, so a shelf showing three books refused a fourth
-- because two more sat in the trash. For a limit counted in *things* rather
-- than in bytes this is the settled convention — Trello's ten boards and
-- Figma's three files both leave archived and deleted items out, and archiving
-- opens a slot. (A limit counted in bytes goes the other way: Google Drive's
-- trash holds your storage until it is emptied. This one is a count of books.)
--
-- Which is only honest if coming *back* is gated too, or archiving five books
-- and restoring them all walks straight past the limit. So the trigger now
-- fires on **update** as well as insert, and a row becoming active again is
-- checked exactly like a new one. `booksAgainstPlan` in `library-store.ts`
-- mirrors both rules in the browser; this is the half that enforces them.

create or replace function public.enforce_launch_book_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Only a row that is (or is becoming) active spends a slot. An insert
  -- straight into the trash — which is what a sync of an already-deleted book
  -- is — costs nothing, and neither does archiving or trashing an active one.
  if new.trashed_at is not null or new.archived_at is not null then
    return new;
  end if;

  -- An update that leaves the book active is not a restore: it is a rename, a
  -- cover, a page-setup change. Only the crossing back is checked, or every
  -- edit to a fifth book would be refused.
  --
  -- Nested rather than one `and` chain on purpose: `old` is unassigned during
  -- an insert, and SQL promises no short-circuit, so a flat condition can
  -- reach `old.trashed_at` on a row that has no `old`.
  if tg_op = 'UPDATE' then
    if old.trashed_at is null and old.archived_at is null then
      return new;
    end if;
  end if;

  if public.openchapter_internal_is_pro(new.owner) then
    return new;
  end if;

  select count(*)
  into v_count
  from public.books b
  where b.owner = new.owner
    and b.id <> new.id
    and b.trashed_at is null
    and b.archived_at is null;

  if v_count >= 5 then
    raise exception 'The free plan includes five books. Archive or delete one, or upgrade to Pro for unlimited books.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists books_launch_free_limit on public.books;
create trigger books_launch_free_limit
  before insert or update on public.books
  for each row execute function public.enforce_launch_book_limit();

revoke all on function public.enforce_launch_book_limit() from public;
grant execute on function public.enforce_launch_book_limit() to service_role;
