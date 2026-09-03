-- The plan a writer is actually on, the two assistant meters, and the book
-- limit that now exempts every paid tier rather than "pro".
--
-- Runs after 20260902000000_plan_tiers.sql, which is what makes `plan` a
-- constrained set of three values. Order matters inside this file too: the book
-- trigger is repointed at the new helper *before* the old one is dropped.

-- ---------------------------------------------------------------------------
-- Which plan, not merely whether paid
-- ---------------------------------------------------------------------------
--
-- Replaces `openchapter_internal_is_pro`. Identical date arithmetic — the same
-- three-day grace, and no grace at all once cancelled — so a subscription that
-- was Pro yesterday is Writer today and entitled for exactly as long.
--
-- Still private, and for the same reason as its predecessor: it takes an owner
-- id explicitly, so exposing it as an RPC would let anybody read anybody's plan.
create or replace function public.openchapter_internal_plan_tier(p_owner uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select s.plan
      from public.subscriptions s
      where s.owner = p_owner
        and s.current_period_end is not null
        and (
          (s.status = 'cancelled' and now() <= s.current_period_end)
          or (
            s.status in ('active', 'past_due')
            and now() <= s.current_period_end + interval '3 days'
          )
        )
      limit 1
    ),
    'free'
  );
$$;

revoke all on function public.openchapter_internal_plan_tier(uuid) from public;
grant execute on function public.openchapter_internal_plan_tier(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The two assistant meters
-- ---------------------------------------------------------------------------
--
-- Dropped rather than replaced: `create or replace` cannot change an argument
-- list, and leaving the old zero-argument version in place would let a stale
-- `rpc("claim_assistant_reply")` keep resolving to it and spending the wrong
-- meter.
drop function if exists public.claim_assistant_reply();
drop function if exists public.refund_assistant_reply();

-- The limits are stated here and in `TIER_LIMITS` in
-- `src/lib/billing/tiers.ts`. **Both must move together.** This one is the
-- enforcement; that one is what the cards print and what the browser gates on.
create or replace function public.claim_assistant_reply(p_kind text)
returns table (
  allowed boolean,
  tier text,
  used integer,
  limit_count integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_tier text;
  v_key text;
  v_period_start timestamptz;
  v_reset timestamptz;
  v_limit integer;
  v_used integer;
begin
  if v_owner is null then
    raise exception 'Not signed in.';
  end if;

  v_tier := public.openchapter_internal_plan_tier(v_owner);

  if p_kind = 'quick' then
    v_key := 'assistant_quick';
    v_period_start := date_trunc('day', timezone('utc', now())) at time zone 'utc';
    v_reset := v_period_start + interval '1 day';
    v_limit := case v_tier when 'studio' then 40 when 'writer' then 25 else 0 end;
  elsif p_kind = 'careful' then
    v_key := 'assistant_careful';
    v_period_start := date_trunc('month', timezone('utc', now())) at time zone 'utc';
    v_reset := v_period_start + interval '1 month';
    v_limit := case v_tier when 'studio' then 300 when 'writer' then 100 else 0 end;
  else
    raise exception 'Unknown assistant kind.';
  end if;

  -- A plan with no assistant has nothing to spend, and says so here as well as
  -- at the route. The route refuses first and this never fires for a real
  -- writer — it is the backstop for a request that did not come from the panel.
  if v_limit <= 0 then
    allowed := false;
    tier := v_tier;
    used := 0;
    limit_count := 0;
    remaining := 0;
    reset_at := v_reset;
    return next;
    return;
  end if;

  insert into public.ai_usage (owner, usage_key, period_start, used)
  values (v_owner, v_key, v_period_start, 0)
  on conflict (owner, usage_key, period_start) do nothing;

  -- The insert-then-select-for-update pair is what serialises two replies sent
  -- at once. Do not "simplify" it into an upsert: the lock is the point.
  select au.used
  into v_used
  from public.ai_usage au
  where au.owner = v_owner
    and au.usage_key = v_key
    and au.period_start = v_period_start
  for update;

  if v_used >= v_limit then
    allowed := false;
    tier := v_tier;
    used := v_used;
    limit_count := v_limit;
    remaining := 0;
    reset_at := v_reset;
    return next;
    return;
  end if;

  update public.ai_usage au
  set used = au.used + 1
  where au.owner = v_owner
    and au.usage_key = v_key
    and au.period_start = v_period_start
  returning au.used into v_used;

  allowed := true;
  tier := v_tier;
  used := v_used;
  limit_count := v_limit;
  remaining := greatest(v_limit - v_used, 0);
  reset_at := v_reset;
  return next;
end;
$$;

-- Mirrors the window selection above, so a reply that never arrived is given
-- back to the meter it was taken from.
create or replace function public.refund_assistant_reply(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_key text;
  v_period_start timestamptz;
begin
  if v_owner is null then
    return;
  end if;

  if p_kind = 'quick' then
    v_key := 'assistant_quick';
    v_period_start := date_trunc('day', timezone('utc', now())) at time zone 'utc';
  elsif p_kind = 'careful' then
    v_key := 'assistant_careful';
    v_period_start := date_trunc('month', timezone('utc', now())) at time zone 'utc';
  else
    return;
  end if;

  update public.ai_usage au
  set used = greatest(au.used - 1, 0)
  where au.owner = v_owner
    and au.usage_key = v_key
    and au.period_start = v_period_start
    and au.used > 0;
end;
$$;

revoke all on function public.claim_assistant_reply(text) from public;
revoke all on function public.refund_assistant_reply(text) from public;
grant execute on function public.claim_assistant_reply(text) to authenticated;
grant execute on function public.refund_assistant_reply(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The free book limit, now exempting every paid plan
-- ---------------------------------------------------------------------------
--
-- The body is 20260826000000's, unchanged but for two lines: the exemption asks
-- which plan rather than whether Pro, and the message no longer names a plan
-- that does not exist. Everything else holds — only the trash is free, an
-- update on a row already counted is not a crossing, `b.owner = new.owner` so a
-- shared book never spends the owner's slot, and the error code stays 23514.
--
-- `booksAgainstPlan` in `src/lib/library-store.ts` mirrors this in the browser
-- and `TIER_LIMITS` in `src/lib/billing/tiers.ts` states the number for every
-- screen that prints it. Three places, and they have to agree.
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
  -- an insert, and SQL promises no short-circuit, so a flat condition can
  -- reach `old.trashed_at` on a row that has no `old`.
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

  if v_count >= 5 then
    raise exception 'The free plan includes five books. Delete one, or upgrade for unlimited books.'
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

-- Last, now that nothing calls it.
drop function if exists public.openchapter_internal_is_pro(uuid);
