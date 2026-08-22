-- OpenChapter launch-MVP entitlements.
--
-- The launch product is deliberately smaller than the existing codebase:
-- one free book, sampled assistant use, and Pro for more books plus higher AI
-- and export access. Anything that costs model time has to be counted on the
-- server rather than trusted to browser-local counters.

-- ---------------------------------------------------------------------------
-- AI usage, by UTC calendar month
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  owner        uuid not null references auth.users (id) on delete cascade,
  usage_key    text not null,
  period_start timestamptz not null,
  used         integer not null default 0 check (used >= 0),
  updated_at   timestamptz not null default now(),

  primary key (owner, usage_key, period_start),
  check (usage_key in ('assistant_reply'))
);

create index if not exists ai_usage_owner_idx
  on public.ai_usage (owner, usage_key, period_start desc);

drop trigger if exists ai_usage_set_updated_at on public.ai_usage;
create trigger ai_usage_set_updated_at
  before update on public.ai_usage
  for each row execute function public.set_updated_at();

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_owner_select on public.ai_usage;
create policy ai_usage_owner_select
  on public.ai_usage for select
  using (auth.uid() = owner);

drop policy if exists ai_usage_owner_insert on public.ai_usage;
drop policy if exists ai_usage_owner_update on public.ai_usage;

revoke insert, update on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;
grant select, insert, update on public.ai_usage to service_role;

-- A private helper for triggers. Do not expose this as an RPC: it accepts an
-- owner id explicitly, so exposing it would leak another writer's plan state.
create or replace function public.openchapter_internal_is_pro(p_owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
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
  );
$$;

revoke all on function public.openchapter_internal_is_pro(uuid) from public;
grant execute on function public.openchapter_internal_is_pro(uuid) to service_role;

create or replace function public.claim_assistant_reply()
returns table (
  allowed boolean,
  pro boolean,
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
  v_period_start timestamptz :=
    date_trunc('month', timezone('utc', now())) at time zone 'utc';
  v_limit integer;
  v_pro boolean;
  v_used integer;
begin
  if v_owner is null then
    raise exception 'Not signed in.';
  end if;

  v_pro := public.openchapter_internal_is_pro(v_owner);
  v_limit := case when v_pro then 60 else 5 end;

  insert into public.ai_usage (owner, usage_key, period_start, used)
  values (v_owner, 'assistant_reply', v_period_start, 0)
  on conflict (owner, usage_key, period_start) do nothing;

  select au.used
  into v_used
  from public.ai_usage au
  where au.owner = v_owner
    and au.usage_key = 'assistant_reply'
    and au.period_start = v_period_start
  for update;

  if v_used >= v_limit then
    allowed := false;
    pro := v_pro;
    used := v_used;
    limit_count := v_limit;
    remaining := 0;
    reset_at := v_period_start + interval '1 month';
    return next;
    return;
  end if;

  update public.ai_usage au
  set used = au.used + 1
  where au.owner = v_owner
    and au.usage_key = 'assistant_reply'
    and au.period_start = v_period_start
  returning au.used into v_used;

  allowed := true;
  pro := v_pro;
  used := v_used;
  limit_count := v_limit;
  remaining := greatest(v_limit - v_used, 0);
  reset_at := v_period_start + interval '1 month';
  return next;
end;
$$;

create or replace function public.refund_assistant_reply()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_period_start timestamptz :=
    date_trunc('month', timezone('utc', now())) at time zone 'utc';
begin
  if v_owner is null then
    return;
  end if;

  update public.ai_usage au
  set used = greatest(au.used - 1, 0)
  where au.owner = v_owner
    and au.usage_key = 'assistant_reply'
    and au.period_start = v_period_start
    and au.used > 0;
end;
$$;

revoke all on function public.claim_assistant_reply() from public;
revoke all on function public.refund_assistant_reply() from public;
grant execute on function public.claim_assistant_reply() to authenticated;
grant execute on function public.refund_assistant_reply() to authenticated;

-- ---------------------------------------------------------------------------
-- Free book limit, enforced where browser-state cannot bypass it
-- ---------------------------------------------------------------------------
create or replace function public.enforce_launch_book_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if public.openchapter_internal_is_pro(new.owner) then
    return new;
  end if;

  select count(*)
  into v_count
  from public.books b
  where b.owner = new.owner
    and b.id <> new.id;

  if v_count >= 1 then
    raise exception 'The free plan includes one book. Upgrade to Pro for unlimited books.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists books_launch_free_limit on public.books;
create trigger books_launch_free_limit
  before insert on public.books
  for each row execute function public.enforce_launch_book_limit();

revoke all on function public.enforce_launch_book_limit() from public;
grant execute on function public.enforce_launch_book_limit() to service_role;
