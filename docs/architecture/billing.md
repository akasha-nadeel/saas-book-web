# Payments, plans, free limits, and the legal pages

Read before touching `src/lib/billing/`, `src/lib/free-limits.ts`, `src/components/upgrade/`, `/api/billing/*`, or `src/lib/legal.ts`.

> Extracted from CLAUDE.md on 2026-08-20. This is the canonical detail for this area;
> CLAUDE.md carries the summary and points here.
> Cross-references reading "above", "below" or "the note in the styling section" may now
> point at a sibling file in `docs/` -- see the table in CLAUDE.md.

> ## ⚠️ There are four plans now, not two (2026-09-03)
>
> This file was written when a writer was either Free or Pro, and most of it
> still reads that way. **`src/lib/billing/tiers.ts` is the current statement**
> of what a plan is; where this file says "Pro", read "one of the three paid
> plans" and check that module for the specifics. What changed:
>
> - **`PlanTier` is `free | draft | writer | studio`**, cheapest first, with
>   `TIER_LIMITS` holding what each one gives and `TIER_NAMES` the words.
>   `subscriptions.plan` — written since the first billing migration and never
>   once read back — is now the column that carries it, under a CHECK.
> - **Paying is the line, and above it the plans differ by amount.** Every paid
>   plan carries the assistant and all three models; what a plan buys is credits
>   a month. (This read "Free and Draft have no writing assistant at all" until
>   2026-09-04.) `onFreePlan()` is still the *wrong* test for anything AI,
>   because Draft is paid.
> - **The gate is the balance, not the tier.** `aiChatClosed()` in `launch.ts`
>   reads `credits.total`, so a Free account holding bought credits opens and a
>   Writer who has spent the month does not. `chatAllowed(tier)` survives as the
>   *pricing* question and is not the gate.
> - **One credit balance on one window**, not two meters: a reply costs 10 / 30 /
>   100 credits (Quick / Careful / Deep) out of a monthly grant, claimed by
>   `claim_credits(p_cost)`. `src/lib/billing/credits.ts` is the whole economy
>   and `20260904000000_ai_credits.sql` is its ledger.
> - **Six Paddle price ids**, one per plan per cycle, and `paddlePlanFrom()`
>   maps them back on the way in. `isPaddleConfigured()` requires all six.
> - **`/api/billing/paddle/change-plan`** moves an existing subscription between
>   plans with `prorationBillingMode: "prorated_immediately"`. The two 409
>   guards on the *checkout* routes stay — they protect one authorisation per
>   writer, which was never meant to mean "cannot change plan".
> - **USD only.** The LKR table came out with the fourth plan.

**Payments are Paddle *or* PayHere, one at a time, and optional in the same way
everything else is.** Configure either gateway and the app grows plans; leave
both unset and there are no plans *and nothing is held back* — every paid
screen works, and the Upgrade button says why there is nothing to buy. That
falls out of the subscription route answering `pro: true` when there is no
gateway, which `ProGate` and `requirePro()` both read. `billingConfigured()` is
checked first everywhere, and `requirePro()` passes everyone when it is false,
so a self-hosted copy running on its owner's API keys behaves exactly as it did
before billing existed.

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
a secret. `server.ts` is `requirePro()`, the
gate in front of `/api/chat`, `/api/narrate`, `/api/transcribe`,
`/api/comps/query`, `/api/comps/rank`, `/api/comps/categories`,
`/api/comps/keywords`, `/api/comps/keywords/chat`, `/api/blurb/critique` and
`/api/blurb/workshop` — 401 when
signed out, **402** when signed in and unpaid,
and the three are different messages because "sign in" shown to someone already
signed in is a loop.

**Two cycles, and both renew.** Three paid plans across them: Draft
$7.98/$71.82, Writer $14.98/$134.99, Studio $29.98/$269.82. Every annual price
is 25% below twelve monthly ones and displays as about $5.98, $11.25 and $22.49
a month. The exact total is stored in `plans.ts`; the displayed monthly
equivalent is derived from that total so rounding happens once.
`uniformAnnualSaving()` is what lets the period toggle print one "Save 25%"
badge over three columns — it answers null when the three stop agreeing, so the
badge disappears rather than lying.

This lower first-launch price is deliberate: the public MVP now sells a focused
book-writing workspace, a monthly writing-assistant allowance, five Free
books and unlimited Pro books. Every export format is free on both plans. It is priced below mature author
software while still protecting AI costs with hard usage limits. After there
are paying subscribers, a price change is an announcement rather than an edit,
and Paddle leaves an existing subscription on the price it was bought at
regardless. **A price change is three edits, not one:** this table, two *new*
prices in Paddle's catalog (never an edit of the live ones), and the resulting
six `PADDLE_PRICE_<TIER>_<CYCLE>` ids in the environment — and
Paddle checks that the site's prices match the live catalog, so the two must
not sit out of step across a review.
The LKR table came out on 2026-09-03: three plans times two cycles times two
currencies is twelve figures to keep true and eleven were never rendered, since
this deployment charges in USD. Putting a second currency back means restoring
the record shape in `plans.ts` and its `FORMAT` entry; nothing else reads it. A lifetime tier was
built on 2026-08-03 and removed the same day — worth knowing only because the
removal is a decision rather than an omission: selling outright is what this
market mostly does, and it trades recurring revenue for a support obligation
with no end date. If it ever returns, the expensive parts in code are that
PayHere must be sent **no `recurrence` and no `duration`** or it bills the
one-off price every month, that there is no period end to store, and that
`isPro` has to answer without a date.

**What is free is enough to understand the product.** Free includes five books,
unlimited chapters and words, autosave/sync where accounts are configured,
**every export format**, and the title and consistency checks. It is granted
**no assistant credits**. Draft ($7.98) adds unlimited books, unlimited title
checks, 2,000 credits a month and letting the assistant write into the chapter;
Writer ($14.98) is 5,000 credits and Studio ($29.98) 10,000 — nothing else
separates those three. EPUB and PDF were Pro until 2026-08-27; see the
note in `launch.ts` for why that was the wrong thing to charge for, and
`launch.test.ts` for what now stops it drifting back. The backend enforces expensive or paid limits: the book limit is in the
database trigger (which counts the active shelf only, and fires on the
restore as well as the insert so archive-and-restore cannot walk past it),
assistant usage is claimed through a Supabase RPC, and PDF
export checks launch entitlements before rendering.

**Writing a blurb is free; having one *read* is not.** `/api/blurb/critique` is
the newest metered route and the one that most needed the refusal spelled out,
because this is where a paid generator would obviously sell — see
`src/lib/blurb-critique.ts` for the whole argument. Three things about it. **It
reports and never writes**, like everything else here: the parsed shape has no
field for a rewritten sentence, a "note" long enough to be replacement copy is
dropped server-side, and a test asserts both. **The stores are not the reason**
— Amazon's AI disclosure covers the manuscript, a description is *metadata* and
needs no declaration at all, so a generator would be permitted and is refused on
product grounds: generated blurbs are generic exactly where a blurb cannot
afford to be, and generating one honestly would mean sending the whole book,
which yields a synopsis with the ending in it. And **no prose leaves** — what
goes is the description, the title and the genre, all typed into form fields, so
this route is not on the short list of places the manuscript can travel.

**Its sibling writes, and the shape is what makes that allowed.**
`/api/blurb/workshop` over the pure `src/lib/blurb-workshop.ts` is a
*conversation*: it asks who the book is about, what they want, what is in the
way and what failure costs, and assembles a draft **from the writer's own
answers**. The specifics are theirs; the model does the shaping. That is a
different thing from the generator refused above, and the two failures that
refusal names are avoided by construction rather than by prompting — the
prompt forbids stating any fact the writer did not give it, and only the
*opening* is sent, so there is no ending to leak onto the back cover. The
public promise is untouched either way: the landing page refuses covers and
*prose*, and a blurb is metadata.

Five things hold it, and the first is the interesting one:

- **The draft is tagged, not guessed at.** An earlier shape asked for prose and
  tried to work out which paragraph was the blurb; every heuristic for that is
  wrong somewhere, because a long answer to "why does that opening not work"
  looks exactly like a draft. `<blurb>` is a signal the model either sends or
  does not, so a turn that is a question simply has no button — and a draft
  over `BLURB_MAX` is **refused rather than truncated**, since a paragraph cut
  mid-sentence would be offered as though somebody had written it.
- **It sends prose, which is the third such route**, so it carries the
  obligations: `/privacy` names it, and the panel lists what leaves *above the
  input, before the press*. The opening is capped **shorter than `rank.ts`'s**
  — everything past the opening is where the ending lives — and cut again
  server-side, because a browser is not where that promise is kept.
- **Nothing reaches the book without a press.** A draft lands in the *draft*,
  so the save bar appears and the writer commits it; the box is never
  overwritten silently.
- **Nothing is persisted**, exactly as the assistant's chat is not — a
  conversation about a draft is scaffolding.
- **It is not streamed, and that is now a choice rather than a constraint.**
  The reasoning was that this has to run on whichever provider is configured
  while the assistant could afford to be Anthropic-only, and that an SSE reader
  for Gemini was the complication `ai.ts` was scoped to avoid. Both halves have
  since gone: the assistant cannot afford it either, and `streamModel` is that
  SSE reader, written and tested. So switching this to stream is now swapping
  `askModel` for `streamModel` and reading the pieces — worth doing if a draft
  arriving all at once ever feels slow, and deliberately not done on spec.

Send a chapter from the *critique* route and it needs a line on the privacy
page and a sentence above the button, as the prose report and the workshop
have.

**Everything else is metered in the unit its own work comes in, and
`src/lib/free-limits.ts` is the whole of the policy.** There is no single global
number, and there was: a version of this gave the free plan "every tool,
unlimited, on five books". A *container* limit cannot hold a container whose
contents are arbitrary — the comps box and the title-check box take any words a
writer types, so one book slot was a general-purpose research desk for any number
of manuscripts. Four shapes replaced it:

| Shape | Tools | Free |
|---|---|---|
| **Per day** | comps, covers, title check | 2 / 3 / 2 a day |
| **Per book** | blurb, prose report, track | 5 / 6 / 2 books |
| **By occupancy** | ARC readers, seats | 10 a book / 2 a book |
| **In total, for good** | keyword suggestions, blurb chat, keyword chat | 5 / 3 / 3 ever |

**The fourth shape follows the cost, not the work, and it is the only one that
never comes back.** The three daily limits guard things that are free to us —
two keyless catalogues and arithmetic in a browser — so a writer who resets the
counter costs nothing and gets more of something that was free anyway. Keyword
suggestions ask a model on every press. Counted per day, one free account could
spend seven hundred model calls a year; counted five in total, it costs at most
five, ever. Five is what it takes to do one book properly (two or three runs
before the seven boxes look right), which covers the listing somebody came here
for and does not cover a backlist.

**The members of that shape carry different numbers, and the ratio is the
bill.** A keyword press is one short model call; a conversation — about a blurb
or about the seven boxes — is five to fifteen, so one of those costs roughly
fifty times one of these, hence three rather than five. The two chats are
counted **separately** (`blurbChat` and `keywordChat`, three each) rather than
out of one pot, because they belong to different screens and a writer who used
their allowance on the blurb should not find the keyword box already shut. **A
conversation is the unit, not a message**: counting messages would stop a
writer mid-brainstorm, and the blurb interview asks four questions before it
offers anything. It is spent on the *first message* of a chat, so opening the
panel and reading it costs nothing, and a reload with nothing said costs
nothing either. `WORDS` says "conversations" for both for that reason — "3
chats left" beside a chat box would otherwise be read as three messages, which
is a different and much smaller promise.

**Its sentences may not borrow the daily vocabulary**, and a test enforces that:
no "today", no "tomorrow", no "a day", because all three would be untrue of a
wall that stays shut. `leftLine` says "2 free suggestions left."; `spentLine`
says the plan includes five and they are used, and stops — the dialog beside it
is where Pro is offered, and a spent line that also sold something would be
doing two jobs at the moment of refusal.

**It is also the first counter here in front of a route that bills**, which is
worth stating plainly: clearing storage really does hand somebody another five,
and the damage is five short prompts, which is not worth a table in Postgres to
prevent. What is *not* left to the browser is the wall — `/api/comps/keywords`
carries `requirePro()` like every other model route, so the sixth press is
refused by the server whatever the client believes. And **`useLimitGate` does
not record for this shape**: the screen calls `spendTotalUse` when a reply
actually lands, because a gateway 502 must not cost one of five.

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
machine's clock. That is accepted rather than papered over, because the routes
that actually cost money are gated by `requirePro()` on the server and none of
this touches them.

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
The metered routes are `requirePro()` on the server, which is the only check a
reader with devtools cannot edit. Everything else is computed in the browser: the
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
returns gates anything that costs money; the billed routes check server-side,
which is the only check a reader with devtools cannot edit. It exists to tell a
writer the truth about their own account.

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


