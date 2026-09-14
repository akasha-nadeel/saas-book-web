# Payments, plans, free limits, and the legal pages

Read before touching `src/lib/billing/`, `src/lib/free-limits.ts`, `src/components/upgrade/`, `/api/billing/*`, or `src/lib/legal.ts`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

> ## Two plans, Free and Pro, and no AI (2026-09-14)
>
> **`src/lib/billing/tiers.ts` is the current statement** of what a plan is, and
> `docs/plans/2026-09-14-ai-free-pro-plan-design.md` is the decision behind it.
>
> - **`PlanTier` is `free | pro`.** From 2026-09-03 to 2026-09-14 there were
>   four — Free, Draft, Writer and Studio — and the three paid ones differed only
>   by how many assistant credits a month they granted. The assistant and every
>   model route were deleted, which left three identical products, so they are
>   one. `20260914000000_ai_free_pro_plan.sql` rewrites every retired row to
>   `pro` and narrows the CHECKs; `asTier` refuses the old names.
> - **Pro buys two things**: unlimited books (Free holds one) and unlimited
>   title checks (Free runs two a day). **$5.99 a month or $49.99 a year.**
> - **The credit economy is gone** — `credits.ts`, `starter-pass.ts`,
>   `aiChatClosed()`, `claimCredits`, `ai_credits`, `ai_usage`, `requirePro()`
>   and `requireTier()`. The one server-side limit left is the book trigger.
> - **Two Paddle price ids**, `PADDLE_PRICE_PRO_MONTHLY` and `_ANNUAL`, and
>   `paddlePlanFrom()` maps them back on the way in.
> - **`/api/billing/paddle/change-plan`** now switches the cycle — it was
>   written to move between plans, and the two 409 guards on the *checkout*
>   routes still protect one authorisation per writer.
> - **USD only.**
>
> Where the text below says "Pro", it means exactly that again. Where it
> describes a metered model route, that route no longer exists.

**Payments are Paddle *or* PayHere, one at a time, and optional in the same way
everything else is.** Configure either gateway and the app grows plans; leave
both unset and there are no plans *and nothing is held back* — every paid
screen works, and the Upgrade button says why there is nothing to buy. That
falls out of the subscription route answering `pro: true` when there is no
gateway, which `ProGate` reads. `billingConfigured()` is checked first
everywhere, so a self-hosted copy behaves exactly as it did before billing
existed.

**`provider.ts` is the whole of which gateway sells, and there will not be a
third.** PayHere came first and is verified against its sandbox end to end;
Paddle arrived on 2026-08-09 because **PayHere cannot sell a subscription to an
unregistered business** — its free Lite tier is one-time payments only and pays
out no USD, and recurring starts at Plus, which wants LKR 3,990 a month and a
business registration. Paddle costs nothing until it is paid and is the
**merchant of record**, so worldwide sales tax is its problem rather than ours.
Three things follow, and they are the reason PayHere is kept whole beside it
rather than deleted:

- **Paddle wins when both are configured.** Two live gateways would mean two
  ways to be on Pro, two webhooks writing one `subscriptions` row and two
  answers to "cancel this".
- **The row records which provider sold it** (`asProvider`, and a row written
  before the Paddle migration reads as PayHere, which is what it is). So a
  switch leaves the writers already paying exactly where they are: their cancel
  button keeps calling PayHere, and only new checkouts go the new way. A writer
  told they are cancelled while their card goes on being charged is the one
  outcome here that costs somebody real money.
- **Merchant-of-record fees stop winning at scale.** PayHere's 2.99% beats
  Paddle's 5% plus the fixed fee at around **eighteen subscribers**, which is
  why `payhere.ts` is not to be tidied away — deleting it means building it
  again.

`src/lib/billing/` is the pure half — `plans.ts` (the price table, the cycle
arithmetic), `signature.ts` (PayHere's two MD5s), `paddle.ts` (`paddleStatus()`,
below), `provider.ts` (`activeProvider()`, `billingConfigured()`),
`subscription.ts` (`isPro()`, the status codes) — all tested. `payhere.ts` and
`paddle.ts` hold the credentials and are server-only by naming: none of it
carries a `NEXT_PUBLIC_` prefix **except Paddle's client token**, which is
designed to be public — Paddle.js authenticates with it in the browser and it
can do nothing but open a checkout. An accidental client import of the rest
reads empty strings, so `isPaddleConfigured()` answers false rather than leaking
a secret. `server.ts` reads a writer's subscription (`subscriptionFor`,
`currentSubscription`) and holds `requireSignedIn`. It used to hold
`requirePro()` too, the gate in front of ten model routes; those routes were
deleted on 2026-09-14 and the gate with them.

**Two cycles, and both renew.** Pro is $5.99 a month or $49.99 a year, which
displays as about $4.17 a month and rounds to 30% off twelve monthly payments.
The exact total is stored in `plans.ts`; the displayed monthly equivalent is
derived from that total so rounding happens once. `uniformAnnualSaving()` still
guards the one "Save" badge, so a second paid plan whose saving differed would
make the badge disappear rather than lie.

**How the price was reached** (2026-09-14): backwards from a floor of $5 kept on
every monthly sale after Paddle's 5% + 50¢ — $5.99 keeps $5.19 — and sideways
from the AI-free writing apps that give more for more (WriteO $9.49 a month,
Novlr Starter $8 a month billed yearly, Plottr $9.99 a month). Pro adds two
things, so it sits under all of them. The design note has the full table. After
there are paying subscribers, a price change is an announcement rather than an
edit, and Paddle leaves an existing subscription on the price it was bought at
regardless. **A price change is three edits, not one:** this table, two *new*
prices in Paddle's catalog (never an edit of the live ones), and the resulting
`PADDLE_PRICE_PRO_MONTHLY` / `_ANNUAL` ids in the environment — and Paddle
checks that the site's prices match the live catalog, so the two must not sit
out of step across a review.

The LKR table came out on 2026-09-03. Putting a second currency back means
restoring the record shape in `plans.ts` and its `FORMAT` entry; nothing else
reads it. A lifetime tier was built on 2026-08-03 and removed the same day, and
the owner chose monthly and yearly only again on 2026-09-14 — worth knowing
because the absence is a decision rather than an omission: selling outright is
what this market mostly does, and it trades recurring revenue for a support
obligation with no end date. If it ever returns, the expensive parts in code
are that PayHere must be sent **no `recurrence` and no `duration`** or it bills
the one-off price every month, that there is no period end to store, and that
`isPro` has to answer without a date.

**What is free is enough to understand the product.** Free includes **one
book**, unlimited chapters and words, autosave/sync where accounts are
configured, **every export format**, the consistency check, voice typing and two
title checks a day. Pro adds unlimited books and unlimited title checks, and
nothing else. **One free book is stricter than every AI-free competitor
checked** (WriteO and Novlr give two, Reedsy Studio unlimited) — that is the
owner's deliberate push towards paying, and the first thing to revisit if
sign-ups stall. EPUB and PDF were Pro until 2026-08-27; see the note in
`launch.ts` for why that was the wrong thing to charge for, and
`launch.test.ts` for what now stops it drifting back. The backend enforces the
book limit in the database trigger (which counts everything but the trash, and
fires on the restore as well as the insert so trash-and-restore cannot walk past
it); `launch.test.ts` reads the migration so the SQL number and
`LAUNCH_LIMITS.freeBooks` cannot drift apart. PDF export checks for a session
before rendering.

**There is no blurb critique and no blurb workshop.** Both were model routes
(`/api/blurb/critique`, `/api/blurb/workshop`) and went on 2026-09-14. The
blurb screen is still built and still hidden; what is left on it counts what the
writer wrote against the shops' limits and writes nothing.

**Everything else is metered in the unit its own work comes in, and
`src/lib/free-limits.ts` is the whole of the policy.** There is no single global
number, and there was: a version of this gave the free plan "every tool,
unlimited, on five books". A *container* limit cannot hold a container whose
contents are arbitrary — the comps box and the title-check box take any words a
writer types, so one book slot was a general-purpose research desk for any number
of manuscripts. Three shapes replaced it:

| Shape | Tools | Free |
|---|---|---|
| **Per day** | comps, covers, title check | 3 / 3 / 2 a day |
| **Per book** | blurb, prose report, track | 5 / 6 / 2 books |
| **By occupancy** | ARC readers, seats | 10 a book / 2 a book |

**The title check is the live row, and its number is a pricing decision rather
than a cost one** (2026-09-14): unlimited title checks are one of the two things
Pro sells, so Free runs two a day while comps and covers, still hidden, stay at
three.

**There was a fourth shape, "in total, for good"**, for work that cost a
model call every press — keyword suggestions, the blurb conversation and the
keyword conversation, five, three and three for the life of the account. It
went with the AI on 2026-09-14, and with it `totalAllowance`, `spendTotalUse`
and the `usedTotal` counter in prefs. If a limit that never comes back is ever
needed again, the lesson it left is that its sentences may not borrow the daily
vocabulary.

Which shape a tool takes follows from what it does. The three that send a query
to a catalogue are counted **per day**, which is what every serious research tool
does (Semrush's free plan is ten queries a day) and for the same reason: a search
box takes arbitrary input, so the honest unit is the query. **They come back
tomorrow**, and that half is what makes them humane — a writer stopped
mid-session returns rather than churning, and nobody is permanently walled out of
a book they own. The ones that read one manuscript are counted in **books**,
which charges for scale rather than effort. Occupancy counts what is *currently*
there, so removing an advance reader gives the place back.

Six things in there are load-bearing.

- **`onThisBook` is the whole of "unlimited within a book".** `bookAllowance`
  takes it as a second argument, and a book already counted is never blocked
  whatever is left — so the wall lands on the *next* book and never in the middle
  of the one being written. A test asserts it, and it is the one not to "fix".
- **The daily reset lives in `dailyAllowance`, not in the parser.** A stored
  record carrying yesterday's date reads as nought without anybody having to
  clear it. In `parsePrefs` it would have been wrong twice: `getPrefs` caches on
  the raw string, so a value derived from the clock there goes stale the moment
  midnight passes with nothing to invalidate it, and a reset that only happened
  on a read would depend on somebody having opened the app.
- **Every limit is spent on a press, never on arrival** — the standing rule that
  a search the app ran is never counted. Two screens had no press and were given
  one rather than an exception: the prose report gained a **Run the report**
  button, and `track` marks its book on the first figure recorded. Marking on
  arrival would have made these limits on *visiting*, and would have had to open
  `LimitDialog` from an effect, which that component forbids for the reason an
  effect fires again on every remount.
- **The counters live in `prefs`** — `usedToday` (a day plus per-tool counts) and
  `usedOn` (a set of books per tool) — not on a book, because they are facts
  about the account and prefs sync as one blob so a second machine does not hand
  out a second allowance. `spendDailyUse` and `markToolBook` are the only
  writers; the latter is **idempotent**, so any screen may call it on any action
  without working out whether this press is the first.
- **Nothing migrates, and that is deliberate.** The old `toolBooks` said only
  "some tool ran here" — it cannot be split into blurb-versus-prose after the
  fact, and there was no daily history at all. Every writer starts clean. Erring
  generous is the only defensible direction when the alternative is charging for
  work there is no evidence of.
- **`warnAt(limit)` caps `WARN_WHEN_LEFT` at `limit - 1`.** Three of these limits
  are 2 or 3, and at a flat two a writer who had used *nothing* would be told
  they had two left — a meter in front of somebody who has not started, which is
  the exact failure the constant exists to prevent. A test walks every limit.

**The words match the shape, and tests enforce it.** A daily sentence must say
"today" and its spent line must promise **tomorrow** — these are the only limits
here that come back, and a line stopping at "today's are used" reads as the end
of the road on a screen the writer could simply revisit. A book sentence must
**name its tool**, or blurb (5) and the prose report (6) both say "1 more book"
and mean different things. And the lines that do *not* come back may not say
"today" or "tomorrow" at all.

**These are browser gates and cannot be otherwise**, which the file header says
outright: the daily ones are resettable by anybody willing to move their
machine's clock. That is accepted rather than papered over, because nothing
they guard costs money to run; the one limit that binds, the book count, is a
Postgres trigger.

`src/components/upgrade/free-limit.tsx` is every limited screen's shared voice,
for the reason `ProGate` is one component — and it **escalates in three steps**,
which is the shape the rest of the trade uses and the part worth keeping:

- **Silence** while there is room. `WARN_WHEN_LEFT` is the rule: a limit nobody
  has approached is not news, and "0 of 5 used" on a first visit teaches a
  writer that this is a metered product before they have had a thing out of it.
  Nothing is hidden by it — the numbers are on the pricing page and in the Help
  dialog. `WARN_WHEN_LEFT` is **2**, capped by `warnAt` at `limit - 1` so the
  three small limits cannot announce themselves to somebody who has used
  nothing; a test walks every limit and fails if a line speaks early.
- **`LeftPill`** in the last two, stating **what is left** rather than what was
  spent, because the remainder is the number they would otherwise have to work
  out.
- **`LimitBanner` and `LimitDialog` on the press that is *refused*** — never on
  the last one that worked. `useLimitGate(ask)` is the whole of that rule and
  every screen goes through it, `ask` being a **discriminated union** so the
  compiler refuses a book limit with no book: the version before this took a
  bare `bookId` and four screens were quietly passing the literal `"imports"`.
  Work inside a limit looks exactly as it always did, and only a press the plan
  has no room for puts anything on screen. Telling somebody at the moment they
  are refused is information; telling them at the moment they stop needing it is
  an advertisement — and the research is unambiguous, prompts shown at the
  blocked action converting far better than ambient ones. **It follows that the
  controls stay live**: a disabled button cannot be pressed, so there would be no
  moment to answer. A refused press costs nothing, and on ARC it does not even
  clear the typed fields.
- The banner is **filled**: purple-into-indigo gradient, white type, one white
  button. It
  was a grey pill first (muted ink at footnote size, so the sentence explaining
  why the button beside it had gone dark *read* as a footnote), then an
  accent-tinted card (legible, but at the same volume as the panel it sat on,
  on a screen made of panels). `LimitNote` is the same fill stacked for the two
  ~300px editor rails — which is what the blurb uses when the roadmap's panel
  mounts it, since the wide banner does not fit a narrow column.

  **That gradient is a documented exception to the palette's hue rule, and it
  is three tokens wide.** (The pricing table's badges are the palette's other
  hue exception, and they work the opposite way — see the styling section.) `--color-upgrade-from` / `-to` / `-ink`, stated
  **identically in both theme blocks** — unlike everything else in the file,
  because a saturated mid-tone fill carries white type on either ground and a
  value that need not change should not. It does *not* follow `--color-accent`,
  for the reason `lp-accent` does not: the accent is #ffffff at night, and this
  is a fill, so it would put a white slab across a black screen. The text on it
  is literal `text-white` rather than `accent-ink` for the same reason — ink
  that inverted on a ground that does not is the one way to get this wrong. The
  dialog's figure panel and its CTA take the same fill, so the two surfaces
  read as one thing; nothing else in the chrome may.

**`LimitDialog` fires once, on the press that spends the last one**, and never
from an effect — an effect watching `blocked` would also fire on arrival for
somebody who ran out yesterday, which is a paywall shown to a writer who
pressed nothing. The screens test `allowance.left === 1` at the moment they
count, which is true only of that press. Inside it: what was reached without
blaming anybody, four lines of what Pro lifts rather than a table, the price
read from `plans.ts` so nobody has to leave to find it, a real way out ("Not
now", Escape, the backdrop, the ×), and a closing line saying what is *not*
affected — the fear at that moment is that work has been taken away. Its figure
is a wall of book covers **drawn in markup**, twelve of them so the grid is
cropped by the panel rather than being a countable nine; spines were tried
twice and read as a bar chart.

These are browser gates and are honest about it: `/api/comps` stays free and
keyless, which is the thing that must not change to enforce this server-side.

**The gates are of two kinds and the pricing page's own comment says which.**
The book count is a Postgres trigger, which is the only check a reader with
devtools cannot edit. Everything else is computed in the browser: the
per-tool allowances through `useLimitGate`, and the two remaining all-or-nothing
Pro pieces through `ProGate` / `useEntitled` (`src/components/upgrade/pro-gate.tsx`)
— one component so the gated screens cannot drift into six tones of upsell, and it
renders children untouched while the plan is still loading, because half a
second of a paywall shown to a paying writer is the screenshot nobody wants.
Do not add a Pro row whose value depends on a browser gate being unbreakable;
the honest lever for those is syncing their data, which is server-side.

Four more things in there are load-bearing.

**Only the webhook grants Pro.** `/api/billing/notify` (PayHere) and
`/api/billing/paddle/notify` are POSTs from the gateway's *servers*, with no
session and no cookies, and they are the only callers that write
`subscriptions` — which is why `authenticated` has no insert or update grant on
that table at all and both routes use the secret key
(`src/lib/supabase/admin.ts`). A return_url is not proof of anything: a writer
can type it, and an overlay closing proves only that it closed. `/upgrade/done`
therefore polls rather than assumes, and Paddle's button has **no success
handler**, because the browser's redirect and the gateway's notification race
and are not ordered.

**The notification is verified before it is believed.** The URL is public and
the body is entirely attacker-shaped; PayHere's `verifyNotification()` against
the merchant secret, and Paddle's `unmarshal` against the endpoint secret
(`pdl_ntfset_…`, which also refuses a replayed timestamp), are the only things
standing between that and a stranger writing "paid" into the table. A bad
signature is refused with 403 and never retried. Paddle's check reads the **raw
text, not the parsed body** — the signature covers the bytes Paddle sent, and
re-serialising a parsed object changes them.

**Idempotency is PayHere's problem and comes free at Paddle.** PayHere sends
"extend by one cycle", so a retry had to be refused by primary key — that key is
`payment_id` on `payment_events`, never the order, because a subscription
charges again on the *same* order id every cycle and a retry that re-ran would
extend the period twice. Paddle sends the **absolute period end**, so writing
the same event twice writes the same dates twice. Its transaction row still
keys on the transaction id, since a duplicate charge in the ledger would be a
lie about how much somebody paid. Anything a route cannot act on answers 200 and
logs; only a storage failure answers 500, because that one *should* come back.

**A cancel goes to the gateway first and our table second.** The other order
leaves a writer who has been told they are cancelled with a card still being
charged. `/api/billing/cancel` branches on the row's own provider: PayHere takes
a second credential pair (`PAYHERE_APP_ID` / `_APP_SECRET`) for the Subscription
Manager API, and without it the account dialog shows no Cancel button rather
than one that cannot work; Paddle is one authenticated call, because it *is* the
merchant of record, and it is sent `effectiveFrom: "next_billing_period"` —
`"immediately"` would end the period the writer bought, which is the one thing
cancelling here has never done. Cancelled is not gone: `isPro()` runs a
cancelled plan to its paid-up date with no grace, and an active or past_due one
three days past it, because a renewal that needs one retry is a normal Tuesday
and a gateway's queue is not instant.

**A cancelled Paddle subscription says `active` until the period ends**, and
announces the cancellation in `scheduled_change` instead. That is correct of
Paddle — the writer has paid to the 9th and is entitled to it — and it cost a
bug the first time round, which is the reason to *test* a gateway rather than
reason about one: our cancel wrote `cancelled`, Paddle's `subscription.updated`
landed a second later saying `active`, and the webhook faithfully undid it. The
account menu then offered Cancel for a subscription already cancelled and
promised a renewal that was never coming. So `paddleStatus()` reads the
scheduled change **first** and everything else is the plain status; it is pure
and tested for exactly that. `paused` maps to cancelled — the table has no
fourth word, and that is the safe direction, since `isPro()` then runs it to the
paid-up date and stops rather than serving Pro indefinitely for nothing.

**Two checkout shapes, and neither lets the browser say what it is buying.**
PayHere is a form POST out to a payment page after `/upgrade/checkout/[orderId]`
collects billing details. Paddle is an **overlay** opened over the pricing page
— but the transaction is created by `/api/billing/paddle/checkout` first, so the
price comes from `plans.ts` and the buyer's id from their own session. Handed a
bare price id and a `customData` object, Paddle's overlay would let the person
paying choose both the price and the name on the receipt; the route is what
stops that, the same reasoning `payment_orders` was built on. `paddlePlanFrom()`
in the webhook decides the cycle from **the price id we sent**, not the billing
interval Paddle reports, because `period` is a CHECK constraint of two values
and a quarterly price would otherwise abort the write for a payment already
taken. Paddle.js loads on the **first press, not on mount** — a pricing page is
read far more often than it is bought from, and a payment network's script on
every visit is a third party watching people who are only looking.

`use-plan.ts` is the client's view of all that, and it **fetches rather than
derives**: the plan lives in Postgres and changes when the gateway says so — a
webhook away, months later, with no page open — so there is nothing local to
read it from, and it is deliberately not part of `library-store.ts`. Nothing it
returns is the real limit; the book trigger is, which is the only check a reader
with devtools cannot edit. It exists to tell a writer the truth about their own
account.

**Four legal pages exist because a gateway reviews the site before it lets
anybody take a card**, and a missing privacy or refund policy is a standard
rejection. `/privacy`, `/terms`, `/refunds` and `/contact`, sharing
`components/legal/legal-shell.tsx`, linked from the landing footer, from each
other and from the checkout. Three things about them are load-bearing:

- **They are in `PUBLIC_EXACT` in `src/proxy.ts`.** A reviewer reads the site
  *signed out*, so a policy behind the sign-in wall does not exist as far as the
  review is concerned — nor as far as a customer hunting for the refund terms
  does.
- **`src/lib/legal.ts` states each fact once** — the operator's legal name, the
  trading name, the country whose law governs, the one contact address,
  `REFUND_DAYS`, `REPLY_DAYS`, `UPDATED` and the `LEGAL_PAGES` array the footer
  and every page's see-also strip read from. Same rule the prices and the free
  limits follow: an address right on three pages and stale on the fourth is the
  exact failure a reviewer looks for. `UPDATED` is written out by hand — a date
  from `new Date()` would say the policy changed today, every day.
- **The privacy page names every route that sends anything, feature by
  feature.** That makes adding such a route an obligation to add it there too.


