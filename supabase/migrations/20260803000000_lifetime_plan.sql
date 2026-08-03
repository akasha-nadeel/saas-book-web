-- ---------------------------------------------------------------------------
-- The lifetime plan.
--
-- `period` was written as a two-value CHECK when the only ways to buy were a
-- month and a year. A one-off purchase is a third, and without this migration
-- it fails at the *worst possible moment*: the checkout inserts its order row
-- fine or not at all, but the webhook's grant is refused by the constraint
-- after PayHere has already taken the money — a paid writer with no plan, and
-- no way to notice except a support email.
--
-- Both tables carry the same list and both are widened here. `payment_orders`
-- records what a checkout was for; `subscriptions` records what the writer
-- ended up with.
--
-- Written as drop-then-add rather than a new constraint name, so re-running it
-- is safe and so there is only ever one rule about this column.
-- ---------------------------------------------------------------------------

alter table public.payment_orders
  drop constraint if exists payment_orders_period_check;

alter table public.payment_orders
  add constraint payment_orders_period_check
  check (period in ('monthly', 'annual', 'lifetime'));

alter table public.subscriptions
  drop constraint if exists subscriptions_period_check;

alter table public.subscriptions
  add constraint subscriptions_period_check
  check (period in ('monthly', 'annual', 'lifetime'));

-- ---------------------------------------------------------------------------
-- `current_period_end` is already nullable, and a lifetime row relies on that.
--
-- It is null there on purpose rather than for want of a value: `periodEnd()`
-- refuses to invent a date for a purchase that has none, because every screen
-- rendering that column would otherwise tell somebody their outright purchase
-- renews centuries from now. `isPro()` reads `period = 'lifetime'` and never
-- looks at the date.
--
-- Nothing to alter — this note is here so the next person to add a NOT NULL to
-- that column knows what it would break.
-- ---------------------------------------------------------------------------
