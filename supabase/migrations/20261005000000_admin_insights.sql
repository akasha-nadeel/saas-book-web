-- OpenChapter admin insights — an activity record, and the read side of it.
--
-- Two halves, written together because neither is any use without the other:
--
--   1. `activity_events`, a private record of which features a signed-in
--      writer used and when. Insert-only from the browser, on the same
--      "suggestion box" shape as `feedback`: a writer may add a row and may
--      never read one, including their own.
--   2. The `admin_*` functions, which are the only way anything reads it — or
--      reads across accounts at all. They are executable by `service_role`
--      alone, and the app calls them from `/admin` after `requireAdmin()`.
--
-- **What these functions may read is a promise on /privacy.** The operator
-- sees an account's email, its activity record, its books' titles and its
-- word counts — never a chapter's text, a note or a cover. So nothing in this
-- file names the three tables that hold those, and
-- `src/lib/admin/insights.test.ts` reads this file and fails if one appears
-- outside a comment.
--
-- **Apply this before the code that ships with it.** The browser half
-- swallows a missing table, so it degrades to recording nothing; `/admin`
-- says which file to apply rather than crashing. Check with
--   select to_regclass('public.activity_events');
--   select proname from pg_proc where proname like 'admin_%';

-- ---------------------------------------------------------------------------
-- 1. The activity record
-- ---------------------------------------------------------------------------

create table if not exists public.activity_events (
  id          bigint generated always as identity primary key,

  -- Set from the session by the default rather than by the client; the insert
  -- policy below refuses anything else. On delete cascade: the record belongs
  -- to the account and goes with it, which is what /privacy says.
  owner       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,

  -- Matches ACTIVITY_KINDS in src/lib/activity.ts; a test holds them together.
  -- **There is no free-text column in this table, and there must not be one.**
  -- A kind and a detail drawn from fixed lists cannot carry a sentence of
  -- anybody's book.
  kind        text not null check (kind in (
                'app_open', 'book_open', 'writing',
                'book_created', 'import_done', 'export_done',
                'title_check_run', 'price_check_run', 'consistency_run',
                'paperback_open', 'provenance_open',
                'pricing_view', 'checkout_start',
                'limit_hit'
              )),

  -- Matches ACTIVITY_DETAILS in src/lib/activity.ts.
  detail      text check (detail in (
                'blank', 'import',
                'docx', 'epub', 'md', 'txt', 'html', 'markdown', 'pdf',
                'monthly', 'annual',
                'books', 'titleCheck', 'priceCheck', 'comps', 'covers',
                'blurb', 'prose', 'track', 'arcReaders', 'ideas', 'seats',
                'checks', 'paperback'
              )),

  -- Which book, by id only. No foreign key, so deleting a book does not erase
  -- the history of having written it. The shape check is what keeps this an
  -- id rather than a place to put text.
  book_id     text check (book_id ~ '^[A-Za-z0-9-]{1,64}$'),

  created_at  timestamptz not null default now()
);

create index if not exists activity_events_owner_idx
  on public.activity_events (owner, created_at desc);
create index if not exists activity_events_created_idx
  on public.activity_events (created_at desc);
create index if not exists activity_events_kind_idx
  on public.activity_events (kind, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "writers may record their own activity"
  on public.activity_events;
create policy "writers may record their own activity"
  on public.activity_events for insert
  to authenticated
  with check (owner = auth.uid());

-- Column-level, so the client cannot set `owner`, `id` or `created_at` at all.
-- No select, no update, no delete: a writer cannot read the record back, and
-- nobody can rewrite it. This project was created with "Automatically expose
-- new tables" off, so without these grants the table is unreachable.
grant insert (kind, detail, book_id) on public.activity_events to authenticated;
grant select, insert on public.activity_events to service_role;

-- A throttle, because the browser is a suggestion and this is what holds.
--
-- The presence kinds (opening the app, opening a book, writing) are worth one
-- row per half hour — a writer who switches tabs forty times in an afternoon
-- had one afternoon, not forty visits. Everything else collapses repeats
-- inside ten seconds, which is a double click rather than a second export.
-- Past 500 rows in a day for one account the rest are dropped: no real
-- writer gets near it, and a script cannot fill the table.
--
-- Returning null drops the row silently, so a throttled insert is still a
-- success to the client and nothing is retried.
create or replace function public.activity_events_throttle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
begin
  new.created_at := now();

  v_window := case
    when new.kind in ('app_open', 'book_open', 'writing')
      then interval '30 minutes'
    else interval '10 seconds'
  end;

  if exists (
    select 1
    from public.activity_events e
    where e.owner = new.owner
      and e.kind = new.kind
      and e.detail is not distinct from new.detail
      and e.book_id is not distinct from new.book_id
      and e.created_at > now() - v_window
  ) then
    return null;
  end if;

  if (
    select count(*)
    from public.activity_events e
    where e.owner = new.owner
      and e.created_at > now() - interval '1 day'
  ) >= 500 then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists activity_events_throttle on public.activity_events;
create trigger activity_events_throttle
  before insert on public.activity_events
  for each row execute function public.activity_events_throttle();

-- ---------------------------------------------------------------------------
-- 2. The read side — service_role only
-- ---------------------------------------------------------------------------
--
-- Every function below is `security definer` with an empty search_path, the
-- house shape for helpers, and is revoked from public, anon and authenticated
-- by name: Postgres grants EXECUTE to PUBLIC by default and Supabase's default
-- privileges grant it to anon and authenticated, so leaving the revoke out
-- would hand every account on the site every other account's email.
--
-- The `auth.role()` test at the top of each is the second lock, not the first.
-- It refuses the two roles a browser can hold and lets anything else through,
-- so a change in how the secret key presents itself cannot break the page.
--
-- "Completed payment" is one rule, used everywhere money is summed: Paddle's
-- `transaction.completed`, and PayHere's status code 2.

-- One row per account. Counts only, and the book count leaves the trash out,
-- as the free limit does.
create or replace function public.admin_users()
returns table (
  id                 uuid,
  email              text,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed    boolean,
  provider           text,
  books              integer,
  chapters           integer,
  words              bigint,
  last_change_at     timestamptz,
  first_event_at     timestamptz,
  last_event_at      timestamptz,
  events_30          integer,
  active_days_30     integer,
  active_days_total  integer,
  last_writing_at    timestamptz,
  last_limit_at      timestamptz,
  saw_pricing        boolean,
  started_checkout   boolean,
  plan               text,
  status             text,
  period             text,
  sub_provider       text,
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  paid               jsonb,
  interest_presses   integer,
  feedback_count     integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    coalesce(b.books, 0),
    coalesce(c.chapters, 0),
    coalesce(c.words, 0)::bigint,
    c.last_change_at,
    e.first_event_at,
    e.last_event_at,
    coalesce(e.events_30, 0),
    coalesce(e.active_days_30, 0),
    coalesce(e.active_days_total, 0),
    e.last_writing_at,
    e.last_limit_at,
    coalesce(e.saw_pricing, false),
    coalesce(e.started_checkout, false),
    s.plan,
    s.status,
    s.period,
    s.provider,
    s.current_period_end,
    s.cancelled_at,
    coalesce(p.paid, '{}'::jsonb),
    coalesce(i.presses, 0),
    coalesce(f.notes, 0)
  from auth.users u
  left join lateral (
    select count(*)::integer as books
    from public.books bk
    where bk.owner = u.id and bk.trashed_at is null
  ) b on true
  left join lateral (
    select
      count(*)::integer as chapters,
      coalesce(sum(ch.words), 0)::bigint as words,
      max(ch.updated_at) as last_change_at
    from public.chapters ch
    join public.books bk on bk.id = ch.book_id
    where ch.owner = u.id
      and ch.trashed_at is null
      and bk.trashed_at is null
  ) c on true
  left join lateral (
    select
      min(ev.created_at) as first_event_at,
      max(ev.created_at) as last_event_at,
      (count(*) filter (
        where ev.created_at > now() - interval '30 days'))::integer as events_30,
      (count(distinct (ev.created_at at time zone 'utc')::date) filter (
        where ev.created_at > now() - interval '30 days'))::integer as active_days_30,
      (count(distinct (ev.created_at at time zone 'utc')::date))::integer
        as active_days_total,
      max(ev.created_at) filter (where ev.kind = 'writing') as last_writing_at,
      max(ev.created_at) filter (where ev.kind = 'limit_hit') as last_limit_at,
      bool_or(ev.kind = 'pricing_view') as saw_pricing,
      bool_or(ev.kind = 'checkout_start') as started_checkout
    from public.activity_events ev
    where ev.owner = u.id
  ) e on true
  left join public.subscriptions s on s.owner = u.id
  left join lateral (
    select jsonb_object_agg(t.currency, t.total) as paid
    from (
      select coalesce(pe.currency, 'USD') as currency, sum(pe.amount) as total
      from public.payment_events pe
      where pe.owner = u.id
        and pe.amount is not null
        and (
          (pe.provider = 'paddle' and pe.event_type = 'transaction.completed')
          or (pe.provider = 'payhere' and pe.status_code = 2)
        )
      group by 1
    ) t
  ) p on true
  left join lateral (
    select count(*)::integer as presses
    from public.plan_interest pi
    where pi.owner = u.id
  ) i on true
  left join lateral (
    select count(*)::integer as notes
    from public.feedback fb
    where fb.owner = u.id
  ) f on true
  order by u.created_at desc;
end;
$$;

-- One row per day, oldest first, UTC days. Clamped to a year.
create or replace function public.admin_daily(p_days integer)
returns table (
  day          date,
  signups      integer,
  active_users integer,
  writers      integer,
  payments     integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select
    (d at time zone 'utc')::date,
    (select count(*)::integer from auth.users u
      where u.created_at >= d and u.created_at < d + interval '1 day'),
    (select count(distinct ev.owner)::integer from public.activity_events ev
      where ev.created_at >= d and ev.created_at < d + interval '1 day'),
    (select count(distinct ev.owner)::integer from public.activity_events ev
      where ev.kind = 'writing'
        and ev.created_at >= d and ev.created_at < d + interval '1 day'),
    (select count(*)::integer from public.payment_events pe
      where pe.created_at >= d and pe.created_at < d + interval '1 day'
        and (
          (pe.provider = 'paddle' and pe.event_type = 'transaction.completed')
          or (pe.provider = 'payhere' and pe.status_code = 2)
        ))
  from generate_series(
    date_trunc('day', now() at time zone 'utc') at time zone 'utc'
      - make_interval(days => v_days - 1),
    date_trunc('day', now() at time zone 'utc') at time zone 'utc',
    interval '1 day'
  ) as d
  order by 1;
end;
$$;

-- Which features were used, by how many people, over the last p_days.
create or replace function public.admin_feature_use(p_days integer)
returns table (
  kind   text,
  detail text,
  events integer,
  users  integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select ev.kind, ev.detail, count(*)::integer, count(distinct ev.owner)::integer
  from public.activity_events ev
  where ev.created_at > now() - make_interval(days => v_days)
  group by ev.kind, ev.detail
  order by 3 desc;
end;
$$;

-- Everything about one account that is not its prose: its books by title and
-- count, its last 300 events, its payments, its feedback, its presses on a
-- paid button, and the books it has been invited to.
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bk.id,
        'title', bk.title,
        'genre', bk.genre,
        'kind', bk.kind,
        'target_words', bk.target_words,
        'created_at', bk.created_at,
        'updated_at', bk.updated_at,
        'last_opened_at', bk.last_opened_at,
        'archived_at', bk.archived_at,
        'trashed_at', bk.trashed_at,
        'chapters', (
          select count(*) from public.chapters ch
          where ch.book_id = bk.id and ch.trashed_at is null),
        'words', (
          select coalesce(sum(ch.words), 0) from public.chapters ch
          where ch.book_id = bk.id and ch.trashed_at is null)
      ) order by bk.updated_at desc)
      from public.books bk
      where bk.owner = p_user
    ), '[]'::jsonb),

    'events', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select ev.kind, ev.detail, ev.book_id, ev.created_at
        from public.activity_events ev
        where ev.owner = p_user
        order by ev.created_at desc
        limit 300
      ) x
    ), '[]'::jsonb),

    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', pe.created_at,
        'provider', pe.provider,
        'event_type', pe.event_type,
        'status_code', pe.status_code,
        'amount', pe.amount,
        'currency', pe.currency,
        'completed',
          (pe.provider = 'paddle' and pe.event_type = 'transaction.completed')
          or (pe.provider = 'payhere' and pe.status_code = 2)
      ) order by pe.created_at desc)
      from public.payment_events pe
      where pe.owner = p_user
    ), '[]'::jsonb),

    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', fb.created_at,
        'topic', fb.topic,
        'sentiment', fb.sentiment,
        'message', fb.message
      ) order by fb.created_at desc)
      from public.feedback fb
      where fb.owner = p_user
    ), '[]'::jsonb),

    'interest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', pi.created_at,
        'tier', pi.tier,
        'period', pi.period,
        'source', pi.source
      ) order by pi.created_at desc)
      from public.plan_interest pi
      where pi.owner = p_user
    ), '[]'::jsonb),

    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'book_id', bm.book_id,
        'title', bk.title,
        'role', bm.role,
        'status', bm.status,
        'accepted_at', bm.accepted_at
      ) order by bm.created_at desc)
      from public.book_members bm
      left join public.books bk on bk.id = bm.book_id
      where bm.user_id = p_user
    ), '[]'::jsonb)
  );
end;
$$;

-- The latest feedback, with who sent it.
create or replace function public.admin_feedback(p_limit integer)
returns table (
  created_at timestamptz,
  topic      text,
  sentiment  text,
  message    text,
  owner      uuid,
  email      text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select fb.created_at, fb.topic, fb.sentiment, fb.message, fb.owner, u.email::text
  from public.feedback fb
  left join auth.users u on u.id = fb.owner
  order by fb.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- The latest presses on a paid button, signed in or not.
create or replace function public.admin_interest(p_limit integer)
returns table (
  created_at timestamptz,
  tier       text,
  period     text,
  source     text,
  owner      uuid,
  email      text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select pi.created_at, pi.tier, pi.period, pi.source, pi.owner,
         coalesce(pi.email, u.email::text)
  from public.plan_interest pi
  left join auth.users u on u.id = pi.owner
  order by pi.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- The latest payment events, with who paid.
create or replace function public.admin_payments(p_limit integer)
returns table (
  created_at  timestamptz,
  provider    text,
  event_type  text,
  status_code integer,
  amount      numeric,
  currency    text,
  completed   boolean,
  owner       uuid,
  email       text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select
    pe.created_at, pe.provider, pe.event_type, pe.status_code,
    pe.amount::numeric, pe.currency,
    (pe.provider = 'paddle' and pe.event_type = 'transaction.completed')
      or (pe.provider = 'payhere' and pe.status_code = 2),
    pe.owner, u.email::text
  from public.payment_events pe
  left join auth.users u on u.id = pe.owner
  order by pe.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke execute on function public.admin_users() from public, anon, authenticated;
revoke execute on function public.admin_daily(integer) from public, anon, authenticated;
revoke execute on function public.admin_feature_use(integer) from public, anon, authenticated;
revoke execute on function public.admin_user_detail(uuid) from public, anon, authenticated;
revoke execute on function public.admin_feedback(integer) from public, anon, authenticated;
revoke execute on function public.admin_interest(integer) from public, anon, authenticated;
revoke execute on function public.admin_payments(integer) from public, anon, authenticated;

grant execute on function public.admin_users() to service_role;
grant execute on function public.admin_daily(integer) to service_role;
grant execute on function public.admin_feature_use(integer) to service_role;
grant execute on function public.admin_user_detail(uuid) to service_role;
grant execute on function public.admin_feedback(integer) to service_role;
grant execute on function public.admin_interest(integer) to service_role;
grant execute on function public.admin_payments(integer) to service_role;
