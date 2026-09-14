-- OpenChapter goes AI-free, and the paid plans become one: Pro.
--
-- Decided 2026-09-14 (docs/plans/2026-09-14-ai-free-pro-plan-design.md). The
-- writing assistant and every model route were deleted from the app, which
-- left Draft, Writer and Studio differing only by assistant credits that no
-- longer exist. There were no real subscribers when this was written, so the
-- retired plans are folded into Pro rather than carried alongside it.
--
-- **Apply this before deploying the code that ships with it.** The app narrows
-- `subscriptions.plan` to `free | pro` and refuses anything else as "no
-- subscription" (see `asTier` in `src/lib/billing/tiers.ts`), so a row still
-- saying 'writer' after the new code is live would read as Free.
--
-- What changes:
--
--   1. Every subscription and payment order on a retired plan becomes 'pro',
--      and the CHECK constraints are narrowed to match.
--   2. The free book limit drops from five to one. `TIER_LIMITS.free.books` and
--      `LAUNCH_LIMITS.freeBooks` hold the same number; `launch.test.ts` and
--      `tiers.test.ts` pin the TypeScript half.
--   3. The AI metering is dropped: `ai_credits`, `ai_usage`, and the claim and
--      refund functions both of those were read through.
--   4. `plan_interest` accepts 'pro'. Its old values stay allowed, so the
--      presses already recorded against Draft, Writer, Studio and the Starter
--      Pass remain valid rows rather than blocking this migration.
--
-- `openchapter_internal_plan_tier` needs no change: it returns the plan column
-- as written, which is now 'pro', and the book trigger already asks only
-- whether that answer is 'free'.

begin;

-- ---------------------------------------------------------------------------
-- 1. The plans
-- ---------------------------------------------------------------------------

-- Update first, constraint second: adding the narrower CHECK while a 'writer'
-- row still stands would abort the whole migration.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

update public.subscriptions
set plan = 'pro'
where plan is null or plan <> 'pro';

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('pro'));

alter table public.payment_orders drop constraint if exists payment_orders_plan_check;

update public.payment_orders
set plan = 'pro'
where plan is null or plan <> 'pro';

alter table public.payment_orders
  add constraint payment_orders_plan_check
  check (plan in ('pro'));

-- ---------------------------------------------------------------------------
-- 2. One free book
-- ---------------------------------------------------------------------------

-- The same function as 20260902000100_plan_tier_entitlements.sql with the
-- count moved from five to one. Every rule it carried stays: only the trash is
-- free, an archived book counts, an edit to a book already counted is never
-- refused (so a writer over the limit keeps writing in every book they have),
-- and a book shared *with* this writer counts against its owner, not them.
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

  if v_count >= 1 then
    raise exception 'The free plan includes one book. Delete it, or upgrade to Pro for unlimited books.'
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

-- ---------------------------------------------------------------------------
-- 3. No AI metering
-- ---------------------------------------------------------------------------

drop function if exists public.claim_credits(integer);
drop function if exists public.refund_credits(integer, integer);
drop function if exists public.claim_assistant_reply(text);
drop function if exists public.refund_assistant_reply(text);
drop function if exists public.claim_assistant_reply();
drop function if exists public.refund_assistant_reply();

-- `ai_usage` was kept unread by 20260904000000_ai_credits.sql so a writer's
-- reply history would survive. With no assistant and no real users there is
-- no history worth the table.
drop table if exists public.ai_credits;
drop table if exists public.ai_usage;

-- ---------------------------------------------------------------------------
-- 4. Plan interest
-- ---------------------------------------------------------------------------

alter table public.plan_interest drop constraint if exists plan_interest_tier_check;
alter table public.plan_interest
  add constraint plan_interest_tier_check
  check (tier in ('pro', 'draft', 'writer', 'studio', 'pass'));

commit;
