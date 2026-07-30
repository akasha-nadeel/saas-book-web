-- OpenChapter billing — PayHere.
--
-- Three tables and a hard rule: the writer's browser may *start* a checkout and
-- may *read* what came of it, but nothing a browser sends decides whether
-- somebody is paid up. Only the notification webhook writes a subscription, and
-- it does so with the secret key, which bypasses RLS. The grants below are what
-- enforce that — `authenticated` has no insert or update on subscriptions at
-- all, so a forged request from a signed-in writer has nothing to aim at.
--
-- Ids are TEXT for the same reason as everywhere else in this schema: they are
-- ours or PayHere's, and neither mints UUIDs.

-- ---------------------------------------------------------------------------
-- payment_orders — a checkout we started
--
-- Written before the writer is sent to PayHere, so the notification that comes
-- back has something to be matched against. The order id is the only thing that
-- travels the whole way there and back, which is what makes it the key.
--
-- These are not proof of anything on their own. A row here says "somebody
-- pressed Upgrade", nothing more; `status` stays 'pending' until the webhook
-- says otherwise, and the webhook is the only thing that may say otherwise.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_orders (
  order_id    text primary key,
  owner       uuid not null references auth.users (id) on delete cascade,

  plan        text not null default 'pro',
  period      text not null check (period in ('monthly', 'annual')),

  -- What we asked PayHere to charge. Kept so a notification whose amount does
  -- not match the order can be spotted rather than trusted.
  amount      numeric(12, 2) not null,
  currency    text not null check (currency in ('LKR', 'USD')),

  status      text not null default 'pending'
                check (status in ('pending', 'paid', 'cancelled', 'failed', 'chargedback')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists payment_orders_owner_idx
  on public.payment_orders (owner, created_at desc);

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_events — what PayHere told us, once per charge
--
-- Separate from the order because a subscription charges again every cycle
-- against the *same* order id. One row per PayHere payment id, which is also
-- what makes the webhook idempotent: PayHere retries a notification it did not
-- get a 200 for, and a retry must not extend the period twice.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  payment_id       text primary key,
  order_id         text not null,
  owner            uuid not null references auth.users (id) on delete cascade,

  amount           numeric(12, 2),
  currency         text,
  -- PayHere's own code, kept raw: 2 success, 0 pending, -1 canceled,
  -- -2 failed, -3 chargedback. Stored as sent so a future code we do not know
  -- about is still on the record.
  status_code      integer not null,
  method           text,
  status_message   text,
  subscription_id  text,

  created_at       timestamptz not null default now()
);

create index if not exists payment_events_owner_idx
  on public.payment_events (owner, created_at desc);
create index if not exists payment_events_order_idx
  on public.payment_events (order_id);

-- ---------------------------------------------------------------------------
-- subscriptions — one per writer
--
-- One row, not a history: the app asks one question ("is this writer on Pro
-- right now"), and the history lives in payment_events. Switching monthly to
-- annual replaces this row, which is why the checkout refuses to start while an
-- active subscription exists — two live PayHere authorisations against one
-- writer is two charges a month, and this table could only remember one.
--
-- 'cancelled' does not mean gone. PayHere stops charging; the writer keeps what
-- they paid for until current_period_end. See isPro() in lib/billing.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  owner                    uuid primary key references auth.users (id) on delete cascade,

  plan                     text not null default 'pro',
  period                   text not null check (period in ('monthly', 'annual')),
  status                   text not null
                             check (status in ('active', 'past_due', 'cancelled')),

  -- PayHere's id for the recurring authorisation. Null until the first
  -- notification arrives — a subscription is not real until it has charged.
  payhere_subscription_id  text,
  -- The checkout this began as. The tie back to payment_orders.
  payhere_order_id         text,

  current_period_end       timestamptz,
  cancelled_at             timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_payhere_idx
  on public.subscriptions (payhere_subscription_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- A writer reads their own billing and nothing else. The asymmetry is the
-- point: select everywhere, insert only on payment_orders (pressing Upgrade),
-- and no update or delete anywhere. Everything that decides money is written by
-- the webhook with the secret key, which RLS does not apply to.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['payment_orders', 'payment_events', 'subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = owner)',
      t || '_owner_select', t
    );
  end loop;

  -- The one write a browser gets: starting its own checkout.
  drop policy if exists payment_orders_owner_insert on public.payment_orders;
  create policy payment_orders_owner_insert on public.payment_orders
    for insert with check (auth.uid() = owner);
end
$$;

-- ---------------------------------------------------------------------------
-- Data API access
--
-- This project was created with "Automatically expose new tables" off, so a
-- table is unreachable until granted regardless of its policies. Granting
-- only select (plus the one insert) means the webhook's privileges and the
-- browser's are different in kind, not just in policy.
-- ---------------------------------------------------------------------------
grant select on
  public.payment_orders,
  public.payment_events,
  public.subscriptions
to authenticated;

grant insert on public.payment_orders to authenticated;

-- And the webhook's role.
--
-- Easy to miss, and it fails in the most misleading way available: the secret
-- key bypasses row-level *security*, so it is tempting to assume it bypasses
-- privileges too. It does not. Without this, PayHere's notification verifies,
-- reads back nothing, concludes the order does not exist, and answers 200 —
-- a payment taken and silently not granted, with no error anywhere except a
-- log line about an order that plainly does exist.
--
-- No delete: nothing in the app removes a payment or a subscription, and a
-- privilege that is never used is one that cannot be used by mistake.
grant select, insert, update on
  public.payment_orders,
  public.payment_events,
  public.subscriptions
to service_role;
