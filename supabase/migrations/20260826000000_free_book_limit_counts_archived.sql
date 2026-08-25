-- Archived books start counting against the free five.
--
-- `20260824000000_free_book_limit_five.sql` set the count at five and made
-- only the *active* shelf spend a slot, on the Trello/Figma convention:
-- archiving opens a slot, and coming back out is gated instead. That migration
-- has been applied, so this one replaces the body rather than editing it.
--
-- **Why the convention was the wrong one here.** Those tools archive finished
-- things — a board nobody is on, a file that shipped. A writer archives a book
-- they mean to come back to, and gating the way back means refusing somebody
-- their own manuscript at the door. Counting it up front costs the same slot
-- and never does that. It also removes a whole class of confusion: a writer
-- who can see six books in their library is no longer told they have five.
--
-- **The trash still does not count**, which is not an inconsistency but the
-- bug the previous migration was written for: counting deleted books made a
-- shelf of three refuse a fourth because two sat in a trash nobody remembered.
-- A trashed book is on its way out; an archived one is not. So restoring
-- *from the trash* is still a crossing and still checked, and unarchiving is
-- not a crossing at all any more.
--
-- `booksAgainstPlan` in `src/lib/library-store.ts` mirrors this in the browser
-- and `LAUNCH_LIMITS.freeBooks` in `src/lib/launch.ts` states the number for
-- every screen that prints it. Three places now, and they have to agree.

create or replace function public.enforce_launch_book_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Only the trash is free. An insert straight into it — which is what a sync
  -- of an already-deleted book is — costs nothing, and neither does trashing
  -- an active one. Archiving no longer buys a slot back, so an archived row is
  -- checked and counted exactly like an active one.
  if new.trashed_at is not null then
    return new;
  end if;

  -- An update on a row that was already being counted is not a crossing: it is
  -- a rename, a cover, a page-setup change, or an archive/unarchive — none of
  -- which changes the total. Only a book climbing back out of the trash is
  -- checked, or every edit to a fifth book would be refused.
  --
  -- Nested rather than one `and` chain on purpose: `old` is unassigned during
  -- an insert, and SQL promises no short-circuit, so a flat condition can
  -- reach `old.trashed_at` on a row that has no `old`.
  if tg_op = 'UPDATE' then
    if old.trashed_at is null then
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
    and b.trashed_at is null;

  -- "Archive one" was the advice here and this migration makes it false.
  if v_count >= 5 then
    raise exception 'The free plan includes five books. Delete one, or upgrade to Pro for unlimited books.'
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
