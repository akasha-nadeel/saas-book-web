-- The free plan holds three books, up from one.
--
-- Decided 2026-09-15. One book was stricter than every competitor checked
-- (WriteO and Novlr give two, Reedsy Studio unlimited), and the design note
-- for the Pro plan named it as the first thing to revisit.
--
-- **Apply this before deploying the code that ships with it.** The app offers
-- a second and third book as soon as `LAUNCH_LIMITS.freeBooks` reads 3; with
-- the old trigger still in place Postgres refuses those books and they never
-- reach the server. Applying the SQL first is safe in the other direction: the
-- old code simply offers fewer books than the database would accept.
--
-- `TIER_LIMITS.free.books` and `LAUNCH_LIMITS.freeBooks` hold the same number;
-- `launch.test.ts` reads this file and fails if they disagree.

begin;

-- The same function as 20260914000000_ai_free_pro_plan.sql with the count moved
-- from one to three. Every rule it carried stays: only the trash is free, an
-- archived book counts, an edit to a book already counted is never refused (so
-- a writer over the limit keeps writing in every book they have), and a book
-- shared *with* this writer counts against its owner, not them.
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
    raise exception 'The free plan includes three books. Delete one, or upgrade to Pro for unlimited books.'
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
