-- A third plan, Pro Plus: everything in Pro, and Amazon's data.
--
-- Decided 2026-10-12 (docs/plans/2026-10-12-pro-plus-market-check-design.md).
-- Amazon's data is paid for by the request, and with no paying writers yet the
-- owner sells it on its own, at $9.99 a month or $99.48 a year, rather than
-- giving it to Pro. `AMAZON_DATA_TIER` in `src/lib/billing/tiers.ts` is the
-- switch that gives it to Pro later; nothing here changes when it moves.
--
-- **Apply this before deploying the code that ships with it.** The code can
-- sell 'plus', and a webhook writing it into a table whose CHECK still says
-- ('pro') fails with a 23514: Paddle's notification answers 500 and is
-- retried, PayHere's checkout refuses to start. Nothing is granted wrongly in
-- the gap, but a writer who paid waits for it. Check afterwards:
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('subscriptions_plan_check', 'payment_orders_plan_check',
--                     'plan_interest_tier_check');
--
-- What changes: the three plan CHECKs admit 'plus'. No row is rewritten — no
-- row can say 'plus' before this runs.
--
-- What does not: `openchapter_internal_plan_tier` returns the plan column as
-- written, and `enforce_launch_book_limit` asks only whether that is 'free',
-- so Pro Plus already holds unlimited books.

begin;

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('pro', 'plus'));

alter table public.payment_orders drop constraint if exists payment_orders_plan_check;
alter table public.payment_orders
  add constraint payment_orders_plan_check
  check (plan in ('pro', 'plus'));

-- The retired names stay allowed, so presses recorded against Draft, Writer,
-- Studio and the Starter Pass remain valid rows.
alter table public.plan_interest drop constraint if exists plan_interest_tier_check;
alter table public.plan_interest
  add constraint plan_interest_tier_check
  check (tier in ('pro', 'plus', 'draft', 'writer', 'studio', 'pass'));

commit;
