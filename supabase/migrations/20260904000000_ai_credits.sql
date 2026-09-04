-- One credit balance for the assistant, replacing the two reply meters.
--
-- `claim_assistant_reply(p_kind)` counted quick replies against a day and
-- careful ones against a month. That let a writer run out of the careful model
-- on the 3rd with twenty-five daily quick replies going unused, gave them no
-- way to buy more, and would have needed a third counter on a third window the
-- moment a third model arrived. A month's credits are now spent however the
-- writer likes, and bought credits sit beside the grant without expiring.
--
-- Runs after 20260902000100_plan_tier_entitlements.sql, which is what makes
-- `openchapter_internal_plan_tier` available to read a writer's plan.

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------
--
-- **One row a writer, not one a period.** `ai_usage` was keyed by period
-- because it only ever counted; this has to carry a purchased balance that
-- outlives every period, so the period is a stamp on the grant half rather than
-- part of the key. One row also means the claim below takes exactly one lock.
create table if not exists public.ai_credits (
  owner              uuid primary key references auth.users (id) on delete cascade,
  -- Spent out of *this* period's grant. Zeroed when the month rolls over.
  grant_spent        integer not null default 0 check (grant_spent >= 0),
  -- Which UTC month `grant_spent` belongs to.
  grant_period_start timestamptz not null,
  -- Bought credits. These do not expire and do not reset.
  purchased          integer not null default 0 check (purchased >= 0),
  updated_at         timestamptz not null default now()
);

drop trigger if exists ai_credits_set_updated_at on public.ai_credits;
create trigger ai_credits_set_updated_at
  before update on public.ai_credits
  for each row execute function public.set_updated_at();

alter table public.ai_credits enable row level security;

-- A writer may read their own balance and nothing else may be written from a
-- browser: every change goes through the security-definer functions below.
drop policy if exists ai_credits_owner_select on public.ai_credits;
create policy ai_credits_owner_select
  on public.ai_credits for select
  using (auth.uid() = owner);

revoke insert, update, delete on public.ai_credits from authenticated;
grant select on public.ai_credits to authenticated;
grant select, insert, update on public.ai_credits to service_role;

-- ---------------------------------------------------------------------------
-- Spending
-- ---------------------------------------------------------------------------
--
-- The grant figures are stated here and in `TIER_LIMITS` in
-- `src/lib/billing/tiers.ts`. **Both must move together.** This one is the
-- enforcement; that one is what the cards print and what the browser gates on.
-- Two is the floor, because SQL cannot import TypeScript.
create or replace function public.claim_credits(p_cost integer)
returns table (
  allowed        boolean,
  tier           text,
  grant_left     integer,
  purchased_left integer,
  reset_at       timestamptz,
  from_grant     integer,
  from_purchased integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner      uuid := auth.uid();
  v_tier       text;
  v_period     timestamptz;
  v_reset      timestamptz;
  v_limit      integer;
  v_spent      integer;
  v_start      timestamptz;
  v_purchased  integer;
  v_grant_left integer;
  v_take_grant integer;
  v_take_buy   integer;
begin
  if v_owner is null then
    raise exception 'Not signed in.';
  end if;

  -- A cost of zero would let a caller claim a reply for nothing; a negative one
  -- would hand out credits.
  if p_cost is null or p_cost <= 0 then
    raise exception 'A reply must cost something.';
  end if;

  v_tier   := public.openchapter_internal_plan_tier(v_owner);
  v_period := date_trunc('month', timezone('utc', now())) at time zone 'utc';
  v_reset  := v_period + interval '1 month';

  v_limit := case v_tier
    when 'studio' then 10000
    when 'writer' then 5000
    when 'draft'  then 2000
    else 0
  end;

  insert into public.ai_credits (owner, grant_spent, grant_period_start, purchased)
  values (v_owner, 0, v_period, 0)
  on conflict (owner) do nothing;

  -- The insert-then-select-for-update pair is what serialises two replies sent
  -- at once. Do not "simplify" it into an upsert: the lock is the point.
  select ac.grant_spent, ac.grant_period_start, ac.purchased
  into v_spent, v_start, v_purchased
  from public.ai_credits ac
  where ac.owner = v_owner
  for update;

  -- A new month. The unspent remainder of the old grant is not carried over —
  -- that is what makes the monthly figure a monthly figure.
  if v_start < v_period then
    v_spent := 0;
    update public.ai_credits ac
    set grant_spent = 0, grant_period_start = v_period
    where ac.owner = v_owner;
  end if;

  v_grant_left := greatest(v_limit - v_spent, 0);

  if v_grant_left + v_purchased < p_cost then
    allowed        := false;
    tier           := v_tier;
    grant_left     := v_grant_left;
    purchased_left := v_purchased;
    reset_at       := v_reset;
    from_grant     := 0;
    from_purchased := 0;
    return next;
    return;
  end if;

  -- **The grant goes first.** It expires at the end of the month and bought
  -- credits do not, so spending the purchased balance first would quietly throw
  -- away something the writer paid for.
  v_take_grant := least(v_grant_left, p_cost);
  v_take_buy   := p_cost - v_take_grant;

  update public.ai_credits ac
  set grant_spent = ac.grant_spent + v_take_grant,
      purchased   = ac.purchased - v_take_buy
  where ac.owner = v_owner;

  allowed        := true;
  tier           := v_tier;
  grant_left     := v_grant_left - v_take_grant;
  purchased_left := v_purchased - v_take_buy;
  reset_at       := v_reset;
  from_grant     := v_take_grant;
  from_purchased := v_take_buy;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Giving it back
-- ---------------------------------------------------------------------------
--
-- Takes the split the claim returned rather than working it out again, so a
-- reply that never landed goes back to the buckets it actually came from. A
-- refund that guessed would move credits from the grant into the purchased
-- balance, or the other way, on every failure.
--
-- `least(…)` on the grant side keeps a double refund from making `grant_spent`
-- negative; the column's check constraint would otherwise abort a request whose
-- only remaining job is to apologise.
create or replace function public.refund_credits(
  p_from_grant integer,
  p_from_purchased integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    return;
  end if;

  if coalesce(p_from_grant, 0) < 0 or coalesce(p_from_purchased, 0) < 0 then
    return;
  end if;

  update public.ai_credits ac
  set grant_spent = greatest(ac.grant_spent - coalesce(p_from_grant, 0), 0),
      purchased   = ac.purchased + coalesce(p_from_purchased, 0)
  where ac.owner = v_owner;
end;
$$;

revoke all on function public.claim_credits(integer) from public;
revoke all on function public.refund_credits(integer, integer) from public;
grant execute on function public.claim_credits(integer) to authenticated;
grant execute on function public.refund_credits(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The two meters, retired
-- ---------------------------------------------------------------------------
--
-- The functions go; **the `ai_usage` table stays**, unread. Dropping it would
-- throw away every writer's reply history to reclaim nothing, and a table
-- nobody selects from costs nothing to keep.
drop function if exists public.claim_assistant_reply(text);
drop function if exists public.refund_assistant_reply(text);
