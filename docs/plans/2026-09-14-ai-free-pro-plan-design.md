# OpenChapter goes AI-free, with one Pro plan

Decided 2026-09-14, in a brainstorming session with the owner. There were no
real users at the time, so nothing is migrated gently.

## Decisions

1. **The AI is deleted, not hidden.** That covers:
   - the editor assistant and the ten gated model routes (blurb, keywords,
     categories, comps query/rank, narrate, transcribe)
   - the credits ledger and the Starter Pass
   - every AI claim on the site
2. **Voice typing stays.** It is the browser's own `SpeechRecognition`: we call
   no model and hold no key. In Chrome the audio goes to Google's speech service,
   and `/privacy` keeps saying so.
3. **Two plans: Free and Pro.** Pro is billed monthly or yearly. There is no
   lifetime option.

   | | Free | Pro |
   |---|---|---|
   | Books | 1 | Unlimited |
   | Title checks | 2 a day | Unlimited |
   | Exports (Word, EPUB, PDF), import, sync, consistency check, voice typing | Yes | Yes |
   | Price | $0 | **$5.99 / month** or **$49.99 / year** |

   The yearly price works out to about $4.17 a month, 30% below monthly. After
   Paddle's 5% + 50¢, a monthly payment keeps $5.19. That is above the $5 floor
   the earlier Draft price was set against, now with no model cost to cover.
4. **The site says "No AI" out loud**: in the hero, the FAQ and both pricing
   cards.

## Why this price

Taken from each app's own pricing page on 2026-09-14:

| App | Free | Paid |
|---|---|---|
| WriteO | 2 novels, DOCX/TXT export only | $9.49/mo, or $89.88/yr |
| Novlr | 2 projects | Starter $8/mo, Studio $16/mo (billed yearly) |
| Reedsy Studio | Unlimited books, PDF/EPUB | Paid add-ons (history, stats, outlining) |
| Campfire | 25,000 words | $12/mo (sale price) |
| Plottr | none; markets "No AI" | $9.99/mo or $60/yr desktop; $14.99/mo or $99/yr Pro |
| Dabble | 14-day trial | $19 / $29 / $49 a month |
| Novelcrafter | trial | Scribe $4/mo |
| Atticus / Vellum | none | $147 / $199.99–$249.99 once |

Pro here adds only two things, so it is priced under WriteO and Novlr.

**One free book is stricter than every free plan above.** That is a deliberate
push towards paying, and it is the first thing to revisit if sign-ups stall.

## What the owner does outside the code

- Create two prices in Paddle. Put their ids in `PADDLE_PRICE_PRO_MONTHLY` and
  `PADDLE_PRICE_PRO_ANNUAL`.
- Remove the AI keys and the old price ids from the Vercel environment.
- Apply `20260914000000_ai_free_pro_plan.sql` **before** deploying the code.
- `PLANS_ON_SALE` stays false until a real checkout has been proven.
