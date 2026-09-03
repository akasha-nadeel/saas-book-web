-- Four plans instead of one, and `plan` finally means something.
--
-- The column has existed since the first billing migration, has been written on
-- every purchase, and has never once been read back — every gate in the tree
-- asked `isPro()`, which is a date comparison returning a boolean. This
-- migration makes the name load-bearing: Free, Draft, Writer, Studio, in that
-- order, with the assistant behind the top two.
--
-- `src/lib/billing/tiers.ts` is the browser's copy of the same list. The two are
-- two statements of one rule and must move together — SQL cannot import
-- TypeScript, which is the whole of why it is said twice.
--
-- **There was one live subscription when this ran**, an active Paddle monthly
-- paid through 2026-09-23, carrying the retired plan name. It is brought
-- forward rather than left to fail the constraint — see the update below for
-- why 'pro' maps to 'writer' and why the audit table is treated differently.
--
-- A pending `payment_orders` row still naming 'pro' will now send its checkout
-- page back to /upgrade, because `asPaidTier` refuses the retired value. That
-- is the right answer: the plan those orders were started for no longer exists
-- to be bought.

-- The one live subscription carries plan = 'pro'. It becomes 'writer', which is
-- the tier holding what Pro actually sold: unlimited books plus the assistant.
-- This row describes a *current entitlement*, so it has to move or the writer
-- paying for it would read as `free` the moment the CHECK lands.
update public.subscriptions
set plan = 'writer'
where plan is null or plan not in ('draft', 'writer', 'studio');

-- **The default is dropped rather than repointed.** There is no sensible
-- default when the plan is the thing being bought: a route that forgets to
-- write it should fail at the insert, loudly, rather than quietly sell the
-- cheapest plan — or the dearest — forever.
alter table public.subscriptions alter column plan drop default;
alter table public.payment_orders alter column plan drop default;

-- **'free' is deliberately not a value.** A writer on the free plan has no
-- subscriptions row at all; allowing the string would invent a second way to be
-- free that `openchapter_internal_plan_tier`'s date arithmetic would then have
-- to agree with. One representation, one answer.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('draft', 'writer', 'studio'));

-- **`payment_orders` keeps 'pro', and its rows are left exactly as they are.**
--
-- It is an audit trail. Eight orders on it were sold as "pro" at $5.98, and
-- rewriting them to say "writer" would make the record disagree with what the
-- customer was actually charged for — a tidier column bought with a false one.
-- So the legacy value stays legal here and nothing back-fills it; only the
-- entitlement table above is brought forward, because that one describes now
-- rather than then.
alter table public.payment_orders drop constraint if exists payment_orders_plan_check;
alter table public.payment_orders
  add constraint payment_orders_plan_check
  check (plan in ('pro', 'draft', 'writer', 'studio'));

-- Two meters now, on two windows: Quick refills daily and Careful monthly. The
-- window follows the cost rather than the calendar — a monthly cap on the cheap
-- model teaches a writer to hoard something that costs almost nothing, and a
-- daily cap on the dear one is either uselessly small or ruinous in a busy week.
--
-- **'assistant_reply' stays in the list** even though nothing will write it
-- again. The historical rows exist, and an UPDATE re-checks the row it touches:
-- drop the value and those rows become un-updatable.
alter table public.ai_usage drop constraint if exists ai_usage_usage_key_check;
alter table public.ai_usage
  add constraint ai_usage_usage_key_check
  check (usage_key in ('assistant_reply', 'assistant_quick', 'assistant_careful'));
