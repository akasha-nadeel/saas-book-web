-- OpenChapter billing — Paddle alongside PayHere.
--
-- The three billing tables were written for one gateway and named for it. This
-- adds a second without renaming anything, for the reason the app keeps both:
-- PayHere is sandbox-verified and becomes the cheaper answer at around eighteen
-- subscribers, so its columns have to keep meaning what they say. A row records
-- which gateway wrote it, and each gateway reads its own id column.
--
-- Additive and idempotent throughout: no drops, no renames, no backfill beyond
-- the default. A library already running against PayHere keeps working with
-- this applied and no code deployed.

-- ---------------------------------------------------------------------------
-- subscriptions — whose gateway, and Paddle's two ids
--
-- `provider` defaults to 'payhere' rather than being nullable, which is right
-- for exactly one reason: every row that exists when this runs *was* PayHere.
-- A nullable column would need every reader to decide what null meant.
--
-- Paddle carries two ids and both are worth keeping. The subscription id is
-- what cancelling addresses. The customer id is the fallback for matching a
-- notification to a writer when custom data is absent — Paddle sends it on
-- every subscription event, and a webhook that cannot work out whose row to
-- write is a payment taken and silently not granted.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists provider text not null default 'payhere';

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('payhere', 'paddle'));

alter table public.subscriptions
  add column if not exists paddle_subscription_id text;
alter table public.subscriptions
  add column if not exists paddle_customer_id text;

create index if not exists subscriptions_paddle_idx
  on public.subscriptions (paddle_subscription_id);
create index if not exists subscriptions_paddle_customer_idx
  on public.subscriptions (paddle_customer_id);

-- ---------------------------------------------------------------------------
-- payment_events — one row per charge, whoever took it
--
-- `status_code` was PayHere's own integer and was NOT NULL. Paddle has no such
-- code; it names its statuses. Rather than invent an integer for Paddle — which
-- would be a made-up number in a table of real ones — the column becomes
-- nullable and `event_type` carries Paddle's own words, stored raw for the same
-- reason PayHere's code is: a status this version does not know about should
-- still be on the record.
--
-- The primary key stays `payment_id` and Paddle's transaction id goes in it,
-- which keeps the idempotency exactly as it was. Paddle retries anything it did
-- not get a 200 for, like PayHere does.
-- ---------------------------------------------------------------------------
alter table public.payment_events
  alter column status_code drop not null;

alter table public.payment_events
  add column if not exists provider text not null default 'payhere';

alter table public.payment_events
  drop constraint if exists payment_events_provider_check;
alter table public.payment_events
  add constraint payment_events_provider_check
  check (provider in ('payhere', 'paddle'));

alter table public.payment_events
  add column if not exists event_type text;

-- ---------------------------------------------------------------------------
-- payment_orders — the checkout we started, Paddle included
--
-- Paddle's overlay could create its own transaction from a price id in the
-- browser, and this app does not let it: the transaction is created by our own
-- route so the price is chosen server-side and the custom data naming the buyer
-- cannot be edited by the person paying. That gives Paddle the same shape
-- PayHere already had — an order row written before the writer leaves, which
-- the notification is matched against — so the only change here is recording
-- which gateway it was.
--
-- `order_id` holds Paddle's transaction id (`txn_…`) for a Paddle order. It is
-- TEXT and was always somebody else's identifier.
-- ---------------------------------------------------------------------------
alter table public.payment_orders
  add column if not exists provider text not null default 'payhere';

alter table public.payment_orders
  drop constraint if exists payment_orders_provider_check;
alter table public.payment_orders
  add constraint payment_orders_provider_check
  check (provider in ('payhere', 'paddle'));

-- Paddle prices in more currencies than PayHere takes on a recurring payment,
-- and a CHECK that refuses one is a payment taken and not recorded. The column
-- keeps its NOT NULL; what it no longer does is name the two.
alter table public.payment_orders
  drop constraint if exists payment_orders_currency_check;

-- ---------------------------------------------------------------------------
-- Grants
--
-- Unchanged in shape and repeated here because a new column does not need one
-- but a reader of this file will wonder. `authenticated` still cannot write a
-- subscription; only the webhook does, with the secret key, which bypasses RLS
-- but *not* privileges — the lesson that cost a silently ungranted payment the
-- first time round.
-- ---------------------------------------------------------------------------
grant select, insert, update on
  public.payment_orders,
  public.payment_events,
  public.subscriptions
to service_role;
