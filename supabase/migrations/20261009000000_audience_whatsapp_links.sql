-- =============================================================================
-- THE RISING STAR — audience: WhatsApp visits by link type
--   The shop has one general link, plus WhatsApp links tagged
--   utm_medium=status|message|group: WhatsApp never says whether a click came
--   from a status, a discussion or a group (and on iPhone not even that it came
--   from WhatsApp). site_audience_stats() now also returns that breakdown.
-- Idempotent.
-- =============================================================================

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
    select distinct on (session_id) session_id, source, utm_medium, country, city, device, path, created_at
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
    -- WhatsApp visits by link type (status / message / group); '' = the general link
    'whatsapp', coalesce((
      select jsonb_agg(jsonb_build_object('key', medium, 'visits', n) order by n desc)
        from (select coalesce(utm_medium, '') medium, count(*) n from sessions where source = 'whatsapp' group by 1) s
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
