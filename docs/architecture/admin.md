# The admin dashboard and the activity record

Added 2026-10-05. The operator — whoever is listed in `ADMIN_EMAILS` — gets
`/admin` instead of their own books: every account, what each one does, who
pays, and a handful of plainly stated segments.

## Why it exists

OpenChapter got its first strangers on 2026-10-04, off the India ads campaign.
Until then the only way to see them was a SQL query pasted into Supabase, and
that query could answer *who signed up* and *how many words* but not *who came
back* or *what they used*. `last_sign_in_at` barely moves: a session lasts 400
days (`AUTH_COOKIE_OPTIONS`), so a writer who returns every day for a month
signs in once. Product analytics did not exist — the Google Ads tag is the only
script on the site and it counts conversions, not behaviour.

So there are two halves: a first-party **activity record**, and a dashboard
that reads it alongside what the database already held.

## The activity record

`public.activity_events`, in `supabase/migrations/20261005000000_admin_insights.sql`.

- **What a row can carry is the whole design.** `kind` and `detail` are CHECK
  enums; `book_id` must look like an id (`^[A-Za-z0-9-]{1,64}$`); there is no
  free-text column. A release that tried to send a sentence would be refused by
  Postgres, not stored. `activity-log.test.ts` pins the column list and holds
  the CHECK lists to `ACTIVITY_KINDS` / `ACTIVITY_DETAILS` in
  `src/lib/activity-log.ts`.
- **Insert-only, the `feedback` shape.** `authenticated` has a column-level
  insert grant on `(kind, detail, book_id)` and nothing else — it cannot name
  `owner` (defaults to `auth.uid()`, checked by the policy) or `created_at`
  (overwritten by the trigger), and it cannot select, so a writer cannot read
  the record back. `anon` has nothing.
- **A throttle in the database**, because the browser is a suggestion:
  `app_open`, `book_open` and `writing` collapse within 30 minutes per owner,
  kind, detail and book; everything else within 10 seconds; and past 500 rows
  a day for one account the rest are dropped. The trigger returns null, so a
  throttled insert is still a success and nothing retries.
- **`noteActivity(kind, { detail?, bookId? })` is the only caller-side
  function.** Fire-and-forget: returns at once, never throws, does nothing for
  a local-only or signed-out writer, swallows a missing table (PGRST205 /
  42P01) and logs anything else with its code. It mirrors the throttle so it
  does not send what the database would drop. The detail is required by type
  exactly where a kind has a list.
- **Not `src/lib/activity.ts`.** That is the writer's own words-per-day log,
  local, shown back to them by the writing record. This one is server-side,
  read only by the operator, and carries no word counts.

### Where each kind is recorded

| Kind | Where |
|---|---|
| `app_open` | `LibrarySync` — on load and when the tab becomes visible again |
| `book_open` | `chapter-editor.tsx`, beside `touchLastOpened` |
| `writing` | `chapter-editor.tsx`, after a successful `saveBody` |
| `book_created` | `new-book-form.tsx`, `import-book.tsx` |
| `import_done` | the four in-app `importFile` call sites, via `noteImport(file.name)` — format only, never the name |
| `export_done` | `export-page.tsx`, after `runExport` returns (print fallback included) |
| `title_check_run` / `price_check_run` | after a successful `gate.spend()` |
| `consistency_run` | `consistency-page.tsx` `run` |
| `limit_hit` | `useLimitGate.spend()` when refused (all metered tools at once), the new-book limit, a locked consistency check, the paperback gate |
| `paperback_open` / `provenance_open` | those screens, once the plan is known |
| `pricing_view` | `Plans` on mount (signed-in only — `noteActivity` asks) |
| `checkout_start` | `PaddleUpgradeButton` press |

A new kind is three edits: the SQL CHECK (a **new migration** — the applied
one is history), `ACTIVITY_KINDS`, and `KIND_LABELS` in `insights.ts`. The
tests fail until all three agree. **/privacy lists the moments in words**, so a
new kind is a fourth edit there.

## The read side

Seven `security definer` functions with `search_path = ''`: `admin_users`,
`admin_daily`, `admin_feature_use`, `admin_user_detail`, `admin_feedback`,
`admin_interest`, `admin_payments`.

- **Executable by `service_role` only.** Each is revoked from `public, anon,
  authenticated` by name — Postgres grants EXECUTE to PUBLIC by default and
  Supabase's default privileges grant it to both browser roles, so leaving the
  revoke out would hand every account every other account's email. A test
  fails if a function lacks either the revoke or the grant. The
  `auth.role() in ('anon','authenticated')` check at the top of each is a
  second lock that cannot misfire on the secret key.
- **None of them reads `chapter_bodies`, `chapter_notes` or `book_covers`.**
  That is the promise on /privacy — the operator sees titles and counts, never
  prose, notes or covers — and `insights.test.ts` reads the migration (comments
  stripped) and fails if one of those names appears.
- **"Completed payment" is one rule**, written the same way in every function:
  Paddle `transaction.completed`, PayHere status code 2.
- Verified on 2026-10-05 against Postgres 17 (PGlite) with stub `auth` and
  role setup and Supabase's default privileges: 52 checks, including every
  refusal. **Applied to the live project the same day, before the code
  shipped**, and checked through PostgREST: the secret key reads every
  account, the publishable key gets `42501` on both the functions and the
  table. On another project, **check the database** as for every migration
  here:
  `select to_regclass('public.activity_events')` and
  `select proname from pg_proc where proname like 'admin_%'`.

## The gate

- `ADMIN_EMAILS` — server-only, comma-separated, exact and case-insensitive
  (`src/lib/admin/admin-email.ts`). **Unset means nobody is admin**; that is
  the safe failure and why the address is not in the source.
- `requireAdmin()` (`src/lib/admin/require-admin.ts`) runs first in every
  `/admin` page: `getClaims()` (never `getSession()`), the email against the
  list, then the account read with the secret key — the address must be
  **confirmed** and still on the list. Anyone else gets `notFound()`, the same
  404 a hidden route gives. With no secret key the page says so and shows
  nothing, because it can read nothing.
- `/admin` is not on the proxy's public lists, so a signed-out visitor is sent
  to sign-in first.

## Home for the operator

`app/page.tsx` redirects the operator's bare `/` to `/admin`. Any `?area=` means
they are inside their own dashboard, so the dashboard writes
`/?area=overview` rather than `/` for them (`goToArea` in `bookshelf.tsx`), and
both side panels carry an Admin row. Every other "home" link in the app — the
editor's, the wordmark — lands them on `/admin`, which is what the owner chose.
The redirect reads only the claims email; the page does the real check.

## The dashboard

`src/app/admin/page.tsx` (tabs by `?tab=`, one read per tab) and
`src/app/admin/users/[userId]/page.tsx`; drawn by `src/components/admin/`,
Server Components except `users-table.tsx`. Pure logic in
`src/lib/admin/insights.ts`, tested.

- **Segments, not scores.** Every account is in exactly one segment — the
  first rule it meets in `SEGMENTS` — and the rule is printed beside the label
  everywhere it appears. Paying uses billing's own `isPro`, grace days and all.
  "Hit a free limit" reads `LAUNCH_LIMITS.freeBooks` rather than a copy.
- **The funnel's steps are counted independently** and are not forced to nest:
  somebody can pay without writing 100 words.
- **Monthly revenue is derived from `plans.ts`** (`perMonthOf`) over active
  subscriptions, never from a copy of the prices.
- **The record is younger than the accounts** and the screens say when it
  began. Anything that rests on it knows nothing before the first event;
  "last seen" also reads `chapters.updated_at` and `last_sign_in_at` so older
  accounts are not all "never".
- The operator's own accounts are counted like anybody else's.

### What it changed elsewhere

- `feedback`'s migration says there is deliberately no screen that lists
  feedback. There is now one, and only the operator can open it — which was
  the condition that note was protecting.
- /privacy names the activity record and what the operator can see, and its
  date moved to 5 October 2026.
