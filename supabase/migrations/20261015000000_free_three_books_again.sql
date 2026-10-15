-- The free plan holds three books again.
--
-- `20261013000000_free_unlimited_books.sql` dropped the book-limit trigger on
-- 2026-10-13, ahead of code that made Free unlimited. On 2026-10-15, before
-- that code went live, the owner decided Free stays at three. This puts the
-- trigger back exactly as `20260915000000_free_three_books.sql` wrote it, with
-- one difference: the sentence it raises is new, so the error in a console
-- names the migration the database is actually running.
--
-- **Apply as soon as possible.** Between the two migrations the live site
-- still stopped free writers at three in the browser, but the database had no
-- backstop. Safe to apply at any time: the live code and the new code both
-- count three books, the same way this trigger does.
--
-- Check afterwards (should be 1, and the sentence should say "upgrade for"):
--
--   select count(*) from pg_trigger where tgname = 'books_launch_free_limit';
--   select prosrc like '%upgrade for unlimited%' from pg_proc
--     where proname = 'enforce_launch_book_limit';
--
-- Every rule it carried stays: only the trash is free, an archived book
-- counts, an edit to a book already counted is never refused (so a writer over
-- the limit keeps writing in every book they have), a book shared *with* this
-- writer counts against its owner, and any paid plan — Pro or Pro Plus — is
-- not counted at all (`openchapter_internal_plan_tier` answers its name).

begin;

create or replace function public.enforce_launch_book_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.trashed_at is not null then
    return new;
  end if;

  -- Nested rather than one `and` chain on purpose: `old` is unassigned during
  -- an insert, and SQL promises no short-circuit.
  if tg_op = 'UPDATE' then
    if old.trashed_at is null then
      return new;
    end if;
  end if;

  if public.openchapter_internal_plan_tier(new.owner) <> 'free' then
    return new;
  end if;

  select count(*)
  into v_count
  from public.books b
  where b.owner = new.owner
    and b.id <> new.id
    and b.trashed_at is null;

  if v_count >= 3 then
    raise exception 'The free plan includes three books. Delete one, or upgrade for unlimited books.'
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

commit;
