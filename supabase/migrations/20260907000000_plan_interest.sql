-- Who wanted which plan, while the plans are not on sale.
--
-- `PLANS_ON_SALE` in src/lib/launch.ts is false: Paddle is configured and
-- correct, but no stranger has ever completed a checkout against the six live
-- price ids, so every paid button opens the "Available Soon" dialog instead of
-- taking money down a path nobody has walked. That would throw away the one
-- useful thing a pricing page does in the meantime — telling you what people
-- came to buy — so the press is recorded here.
--
-- **This is the first table in the schema a signed-out visitor causes a write
-- to, and it does not break the rule that says they cannot.** `anon` is still
-- granted nothing. The row is written by /api/plan-interest holding
-- `createAdminClient()`, exactly the way `book_members` is written by nothing
-- but the server. A browser cannot reach this table at all.

create table if not exists public.plan_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Narrowed here as well as in the route. The route is the only writer today,
  -- but a CHECK is what stops tomorrow's second writer inventing a tier.
  --
  -- **`pass` is the Starter Pass and `once` is its cycle.** It is a one-time
  -- $0.99 charge rather than a subscription, and the alternative was making
  -- `period` nullable — which would have meant a column that is null for one
  -- product and meaningful for the others, read by anybody counting demand as
  -- "cycle unknown" rather than "there isn't one". `once` says the true thing,
  -- and it is the word the card itself uses: *charged once, never renews*.
  tier text not null check (tier in ('draft', 'writer', 'studio', 'pass')),
  period text not null check (period in ('monthly', 'annual', 'once')),

  -- Where the press happened: the pricing cards on the landing page, or the
  -- plan cards on /upgrade. Worth separating — the first is curiosity and the
  -- second is intent, and a page that converts one into the other is the thing
  -- being measured.
  source text not null check (source in ('upgrade', 'landing')),

  -- **Both nullable on purpose.** The whole point is catching people who have
  -- not signed up; a schema that demanded an account would record only the
  -- writers already counted elsewhere. `on delete set null` keeps the demand
  -- signal after somebody deletes their account, without keeping them.
  owner uuid references auth.users(id) on delete set null,
  email text,

  -- **When an alert actually went out for this press, or null.**
  --
  -- The hourly cap needs to know how recently the owner was *told*, and the
  -- first version answered that by counting presses instead — which is a
  -- different fact wearing the same shape. Five Starter Pass presses were
  -- recorded during an hour when every send was being refused by the mail
  -- provider, and the cap then read those five as "already reported" and went
  -- on suppressing the one plan nobody had ever heard about. A row means
  -- somebody pressed; only this column means somebody was told.
  alerted_at timestamptz
);

-- Same column, for a table created before it existed.
alter table public.plan_interest add column if not exists alerted_at timestamptz;

-- Reading this is "what should I switch on first", which is a question asked
-- across weeks rather than per row.
create index if not exists plan_interest_created_at_idx
  on public.plan_interest (created_at desc);

-- **Restated rather than left to the CREATE**, because `create table if not
-- exists` silently skips a table that already stands — so a copy of this file
-- applied before the Starter Pass was added would keep the narrower checks and
-- refuse every `pass` row with a constraint violation nobody would think to
-- look for. Naming them makes the file correct whether it has run before or
-- not, which is the same reason `20260902000000_plan_tiers.sql` drops before it
-- adds.
alter table public.plan_interest drop constraint if exists plan_interest_tier_check;
alter table public.plan_interest
  add constraint plan_interest_tier_check
  check (tier in ('draft', 'writer', 'studio', 'pass'));

alter table public.plan_interest drop constraint if exists plan_interest_period_check;
alter table public.plan_interest
  add constraint plan_interest_period_check
  check (period in ('monthly', 'annual', 'once'));

alter table public.plan_interest enable row level security;

-- **No grants to anon, and none to authenticated.** RLS with no policy and no
-- grant is a closed door rather than a locked one: there is no client path to
-- this table in either direction, so nothing can read what other people wanted
-- and nothing can fill it from a script with a session.
--
-- Deliberately no select policy either. This is a private ledger of demand,
-- not something a writer has any business seeing.

-- **`service_role` still needs saying, and leaving it out cost twelve presses.**
-- The first version of this file granted nothing at all, on the reading that
-- "written by nothing but the server" meant no grants anywhere. It does not:
-- this schema never relies on Supabase's default privileges, and every
-- server-written table names the role explicitly — `book_members` at
-- `20260806000000_collaboration.sql:880`, `ai_usage` at
-- `20260822071735_launch_mvp_entitlements.sql:42`. Without this line the route
-- holding the secret key gets `42501 permission denied for table
-- plan_interest`, which is a *grant* refusal and reads nothing like an RLS one.
--
-- `select` as well as `insert`, so the ledger can be read back with the same
-- key rather than only from the dashboard — the hourly cap is a count against
-- this table. `update` for `alerted_at`, which is written after the mail has
-- actually been accepted rather than alongside the row.
grant select, insert, update on public.plan_interest to service_role;

-- Every read this app makes is "was anything alerted for this plan lately",
-- which is the three columns below and nothing else.
create index if not exists plan_interest_alerted_idx
  on public.plan_interest (tier, period, alerted_at desc);
