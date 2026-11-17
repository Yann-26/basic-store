-- =============================================================================
-- THE RISING STAR — newsletter campaigns
--   * newsletter_campaigns: designed in the back-office (blocks: titles, text,
--     images, videos, buttons, products, personalised recommendations),
--     sent now or at a scheduled time.
--   * newsletter_deliveries: one row per recipient and campaign. The unique
--     (campaign_id, email) pair makes sending idempotent: a retried batch can
--     never email the same person twice.
--   * newsletter_suppressions: addresses that unsubscribed; never emailed again.
--   * users.marketing_opt_in: customers only receive campaigns if they chose to.
--   * claim_newsletter_deliveries(): hands out a batch of pending deliveries to
--     exactly one worker (FOR UPDATE SKIP LOCKED), re-queueing stalled ones.
-- All tables: RLS on, no policy (API / service role only). Idempotent.
-- =============================================================================

begin;

alter table public.newsletter_subscribers add column if not exists first_name text;
alter table public.newsletter_subscribers add column if not exists unsubscribed_at timestamptz;

alter table public.users add column if not exists marketing_opt_in boolean not null default false;
alter table public.users add column if not exists marketing_opt_in_at timestamptz;

create table if not exists public.newsletter_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null default 'unsubscribed',
  created_at timestamptz not null default now()
);
alter table public.newsletter_suppressions enable row level security;

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  preheader text not null default '',
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  audience text not null default 'all' check (audience in ('all', 'buyers')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletter_campaigns_due_idx on public.newsletter_campaigns (status, scheduled_at);
alter table public.newsletter_campaigns enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'newsletter_campaigns_set_updated_at') then
    create trigger newsletter_campaigns_set_updated_at before update on public.newsletter_campaigns
      for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  email text not null check (email = lower(email)),
  user_id uuid references public.users (id) on delete set null,
  first_name text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index if not exists newsletter_deliveries_queue_idx on public.newsletter_deliveries (campaign_id, status, created_at);
alter table public.newsletter_deliveries enable row level security;

-- One batch for one worker. Deliveries stuck in 'sending' for 10 minutes (worker
-- died) go back to the queue, up to 3 attempts.
create or replace function public.claim_newsletter_deliveries(p_campaign uuid, p_limit integer)
returns setof public.newsletter_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_deliveries
     set status = 'pending'
   where campaign_id = p_campaign and status = 'sending'
     and claimed_at < now() - interval '10 minutes' and attempts < 3;
  update public.newsletter_deliveries
     set status = 'failed', error = coalesce(error, 'Abandonné après 3 tentatives')
   where campaign_id = p_campaign and status = 'sending'
     and claimed_at < now() - interval '10 minutes' and attempts >= 3;

  return query
  update public.newsletter_deliveries d
     set status = 'sending', attempts = d.attempts + 1, claimed_at = now()
   where d.id in (
     select id from public.newsletter_deliveries
      where campaign_id = p_campaign and status = 'pending'
      order by created_at
      limit greatest(1, least(p_limit, 200))
      for update skip locked)
  returning d.*;
end;
$$;

revoke all on function public.claim_newsletter_deliveries(uuid, integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_newsletter_deliveries(uuid, integer) to service_role;
  end if;
end $$;

commit;
