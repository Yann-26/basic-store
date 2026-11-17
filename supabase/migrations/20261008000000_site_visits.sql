-- =============================================================================
-- THE RISING STAR — audience (who visits the shop, from where)
--   One row per page view, written by the API (service role) from a beacon the
--   storefront sends in real browsers only (link-preview robots don't run JS).
--   Privacy by design: no IP address and no account id is stored. A visitor is
--   an HMAC of (IP, browser, day) that changes every day, so nobody can be
--   followed over time; location is the country/region/city Vercel derives from
--   the IP at the edge. Rows older than 13 months are deleted automatically.
-- Idempotent.
-- =============================================================================

create table if not exists public.site_visits (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  session_id    text not null check (length(session_id) between 8 and 64),
  visitor_hash  text not null check (length(visitor_hash) between 8 and 64),
  is_landing    boolean not null default false,
  path          text not null check (length(path) <= 300),
  source        text not null check (length(source) <= 40),
  referrer_host text check (length(referrer_host) <= 120),
  utm_source    text check (length(utm_source) <= 60),
  utm_medium    text check (length(utm_medium) <= 60),
  utm_campaign  text check (length(utm_campaign) <= 80),
  country       text check (length(country) <= 2),
  region        text check (length(region) <= 80),
  city          text check (length(city) <= 80),
  device        text check (device in ('mobile', 'tablet', 'desktop')),
  browser       text check (length(browser) <= 30)
);
create index if not exists site_visits_created_idx on public.site_visits (created_at desc);
create index if not exists site_visits_landing_idx on public.site_visits (created_at desc) where is_landing;
alter table public.site_visits enable row level security;
revoke all on table public.site_visits from anon, authenticated;
comment on table public.site_visits is 'Storefront page views (no IP, daily-rotating visitor hash, coarse location). Service role only.';

-- Everything the Audience page shows for a period, in one round trip.
create or replace function public.site_audience_stats(p_from timestamptz, p_to timestamptz, p_hourly boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (select * from site_visits where created_at >= p_from and created_at < p_to),
  prev as (
    select * from site_visits
     where created_at >= p_from - (p_to - p_from) and created_at < p_from
  ),
  sessions as (
    -- the first page of each visit carries its source and location
    select distinct on (session_id) session_id, source, country, city, device, path, created_at
      from v order by session_id, created_at
  )
  select jsonb_build_object(
    'visitors',  (select count(distinct visitor_hash) from v),
    'visits',    (select count(distinct session_id) from v),
    'pageviews', (select count(*) from v),
    'previous', jsonb_build_object(
      'visitors',  (select count(distinct visitor_hash) from prev),
      'visits',    (select count(distinct session_id) from prev),
      'pageviews', (select count(*) from prev)
    ),
    'live', (select count(distinct session_id) from site_visits where created_at >= now() - interval '5 minutes'),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('t', b.t, 'visits', b.visits, 'visitors', b.visitors) order by b.t)
        from (
          select date_trunc(case when p_hourly then 'hour' else 'day' end, created_at) as t,
                 count(distinct session_id) as visits, count(distinct visitor_hash) as visitors
            from v group by 1
        ) b
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('key', source, 'visits', n) order by n desc)
        from (select source, count(*) n from sessions group by source) s
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('key', country, 'visits', n) order by n desc)
        from (select coalesce(country, '') country, count(*) n from sessions group by 1 order by 2 desc limit 15) s
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('key', city, 'country', country, 'visits', n) order by n desc)
        from (select city, country, count(*) n from sessions where city is not null group by 1, 2 order by 3 desc limit 15) s
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('key', path, 'views', n) order by n desc)
        from (select path, count(*) n from v group by path order by 2 desc limit 15) s
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('key', device, 'visits', n) order by n desc)
        from (select coalesce(device, 'desktop') device, count(*) n from sessions group by 1) s
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r.at desc)
        from (
          select created_at at, source, country, city, device, path
            from site_visits where is_landing and created_at < p_to
           order by created_at desc limit 30
        ) r
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.site_audience_stats(timestamptz, timestamptz, boolean) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.site_audience_stats(timestamptz, timestamptz, boolean) to service_role;
  end if;
end $$;

-- Retention: 13 months, purged every night at 03:17 UTC.
create extension if not exists pg_cron;
select cron.unschedule('site-visits-retention') where exists (select 1 from cron.job where jobname = 'site-visits-retention');
select cron.schedule('site-visits-retention', '17 3 * * *', $$delete from public.site_visits where created_at < now() - interval '13 months'$$);
