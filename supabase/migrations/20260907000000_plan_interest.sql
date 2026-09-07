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
  email text
);

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

-- **No grants. Not to anon, not to authenticated.** RLS with no policy and no
-- grant is a closed door rather than a locked one: there is no client path to
-- this table in either direction, so nothing can read what other people wanted
-- and nothing can fill it from a script with a session. The service key writes
-- it; the dashboard reads it.
--
-- Deliberately no select policy either. This is a private ledger of demand,
-- not something a writer has any business seeing.
