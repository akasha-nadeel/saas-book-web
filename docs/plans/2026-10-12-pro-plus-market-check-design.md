# Pro Plus and the Market check

Decided 2026-10-12 by the owner. Builds on
`2026-10-05-price-check-amazon-design.md`, which has the Amazon data's
measurements and the providers tested.

## Why a third plan

Amazon's data comes from OpenWeb Ninja and every request is paid for. On
2026-10-12 there were no paying writers, so the owner did not want to give it to
Pro ($5.99) and pay for it out of pocket. It became **Pro Plus**: Pro and
Amazon's data, **$9.99 a month or $99.48 a year** ($8.29 a month, the same 17%
as Pro, so one "Save" badge fits both).

- Pro lost the Amazon tab the same day. Nobody had bought it.
- **`AMAZON_DATA_TIER`** (`src/lib/billing/tiers.ts`) is the one switch: set it
  to `"pro"` and Pro gets the data back, with the server gate, the locked tabs,
  the badges and the plan rows following.
- Pro Plus keeps $8.99 a monthly sale after Paddle's 5% + 50¢.

## What writers asked for, and what Amazon's data can honestly answer

Searched 2026-10-12 (KDP forums, author communities, tool reviews). The pains:

| Pain | What we show | What we refuse to show |
|---|---|---|
| Ghost categories; choosing three categories | Every category the genre's top 100 rank in, with how many of them rank there. A category with books ranking in it has a page. | A verdict on any category none of them ranks in |
| "How hard is #1 here?" | The whole-store rank of the list's #1, #10, #25, #50 and #100 | Sales a rank "takes" — the tools that sell that number ($197–199) are the ones writers distrust |
| KU or wide? | How many of the top 100 are in Kindle Unlimited (Prices tab) | Advice |
| Launch, reviews, covers | New Releases, Movers & Shakers (Amazon's own note on each move), Most Wished For; rating counts in bands; new-release prices in bands; the top 100's covers side by side | A middle launch price: those lists carry no publisher, so the two sides cannot be kept apart |
| Rank tracking for my own book | **Held for later** (`TODO.md`) | — |

The search check (what readers see for a phrase) was offered and not chosen.

## Cost

The server cache is shared, so cost grows with **genres**, not writers:

- lists 7 days
- each book's details 30 days
- the five ladder books 7 days, under an `x-oc-read: ladder` header, since Next's fetch cache keys on headers
- the trend lists 1 day

A genre is about 102 requests the first time, then about 17 a week, plus 5 a
week for the ladder and 3 a day for the trends. All 27 genres opened every day
come to about 5,500 requests a month. That fits OpenWeb Ninja's $25 fixed plan
(10,000 a month), and three Pro Plus subscribers cover it. Pay-as-you-go
($0.005, no monthly fee) is cheaper until then.

**Sell first, pay after.** The owner chose to put Pro Plus on sale at once. The
first sale mails the owner (`billing/sale-alert.ts`) to move OpenWeb Ninja off
its free 100 requests a month, which is about one genre.

## The Market check

The price check was renamed because it now asks three questions.

- A genre opens on **Prices | Categories | Trends** and nothing else. Nothing is
  fetched until a section is pressed, and the bar stays on top inside one.
- Below Pro Plus, Categories and Trends say what they show with **no figure**,
  not even a blurred one, because every figure is a request somebody paid for.
- The ids did not change (`price-check`), so no link broke.

## Billing shape

- `PlanTier` is `free | pro | plus`. Every gate but Amazon's means "any paid
  plan", which is right because Pro Plus includes Pro.
- **Only Pro's Paddle ids decide whether Paddle is configured** (`CORE_TIER`).
  Pro Plus without prices is "Available soon". This guards against the
  2026-08-23 outage, when missing ids gave everything away.
- Migration `20261012010000_pro_plus_plan.sql` widens the plan CHECKs. **Apply
  it first.**

## Unlimited books on Free — built, then taken back (2026-10-13 → 10-15)

On 2026-10-13 the owner asked for unlimited books on every plan, with a
one-time popup for existing writers and an email to every account. All three
were built, and its migration (`20261013000000_free_unlimited_books.sql`)
dropped the book-limit trigger in the live database.

On 2026-10-15, before any of it went live and before the email was sent, the
owner decided **Free stays at three books**. The popup and the email script
were deleted. `20261015000000_free_three_books_again.sql` puts the trigger
back, with a new sentence so a console error names it.

**What stayed from it:** the browser's book gates now read
`bookLimitFor(plan)` and `atBookLimit` in place of `LAUNCH_LIMITS.freeBooks`.
That makes `TIER_LIMITS.free.books` the one TypeScript statement of the count,
held to the trigger by `launch.test.ts`.
