-- OpenChapter admin insights, second part — the Ideas board in the activity
-- record, and who uses which feature.
--
-- `20261005000000_admin_insights.sql` is applied and is history, so the
-- record's lists grow here rather than there. Three things:
--
--   1. Two new kinds, `ideas_open` and `idea_parked`, and a new detail,
--      `idea` (a book started from a parked idea). The Ideas board is kept in
--      the writer's browser and never synced, so without these the server
--      cannot know who uses it at all.
--   2. The throttle again, with `ideas_open` among the kinds worth one row per
--      half hour: opening the board is being somewhere, not doing a thing.
--   3. `admin_feature_users`, which says *who* made a kind of event — the
--      Features tab used to say only how many people had.
--
-- **What these functions may read is a promise on /privacy**, as in the first
-- part: nothing here names the tables that hold a chapter's text, a note or a
-- cover, and `src/lib/admin/insights.test.ts` reads this file too.
--
-- **Apply this before the code that ships with it.** Until it is, the browser
-- sends the new kinds and Postgres refuses them (the app logs a warning and
-- carries on), and the Features tab says which file to apply. Check with
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'activity_events_kind_check';
--   select proname from pg_proc where proname = 'admin_feature_users';

-- ---------------------------------------------------------------------------
-- 1. The lists
-- ---------------------------------------------------------------------------
--
-- Each new list holds every value of the old one, so every row already in the
-- table passes and the constraint is added in one statement. The names are the
-- ones Postgres gave the inline column checks in the first part.

-- Matches ACTIVITY_KINDS in src/lib/activity-log.ts; a test holds them together.
alter table public.activity_events
  drop constraint if exists activity_events_kind_check,
  add constraint activity_events_kind_check check (kind in (
    'app_open', 'book_open', 'writing',
    'book_created', 'import_done', 'export_done',
    'title_check_run', 'price_check_run', 'consistency_run',
    'paperback_open', 'provenance_open',
    'pricing_view', 'checkout_start',
    'limit_hit',
    'ideas_open', 'idea_parked'
  ));

-- Matches ACTIVITY_DETAILS in src/lib/activity-log.ts.
alter table public.activity_events
  drop constraint if exists activity_events_detail_check,
  add constraint activity_events_detail_check check (detail in (
    'blank', 'import', 'idea',
    'docx', 'epub', 'md', 'txt', 'html', 'markdown', 'pdf',
    'monthly', 'annual',
    'books', 'titleCheck', 'priceCheck', 'comps', 'covers',
    'blurb', 'prose', 'track', 'arcReaders', 'ideas', 'seats',
    'checks', 'paperback'
  ));

-- ---------------------------------------------------------------------------
-- 2. The throttle
-- ---------------------------------------------------------------------------
--
-- The first part's body, with `ideas_open` among the half-hour kinds. The
-- half-hour list matches PRESENCE_KINDS in src/lib/activity-log.ts.

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
    when new.kind in ('app_open', 'book_open', 'writing', 'ideas_open')
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

-- ---------------------------------------------------------------------------
-- 3. Who uses what — service_role only
-- ---------------------------------------------------------------------------
--
-- One row per kind, detail and account, over the whole record: how many
-- events, the first and the last. The page joins the accounts it already
-- reads through `admin_users`, so no address is read here.

create or replace function public.admin_feature_users(p_kinds text[])
returns table (
  kind     text,
  detail   text,
  owner    uuid,
  events   integer,
  first_at timestamptz,
  last_at  timestamptz
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
  select ev.kind, ev.detail, ev.owner, count(*)::integer,
         min(ev.created_at), max(ev.created_at)
  from public.activity_events ev
  where ev.kind = any(coalesce(p_kinds, '{}'::text[]))
  group by ev.kind, ev.detail, ev.owner
  order by 6 desc;
end;
$$;

revoke execute on function public.admin_feature_users(text[]) from public, anon, authenticated;

grant execute on function public.admin_feature_users(text[]) to service_role;
