-- =============================================================================
-- THE RISING STAR — security hardening (audit 2026-10-02, findings TRS-M6, TRS-M7)
--   1. admin_audit_logs: one row per back-office mutation (written by the API).
--   2. Least privilege for the public API roles. The browser never talks to
--      Supabase directly: every read/write goes through the API with the service
--      role. RLS already blocks anon/authenticated everywhere except the public
--      catalogue SELECT policies; revoking the grants as well means a future
--      policy mistake cannot expose private tables.
-- Idempotent. Rollback statements at the end.
-- =============================================================================

-- 1. Audit trail --------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_email text not null,
  action      text not null,
  method      text not null,
  path        text not null,
  resource_id text,
  status      integer not null,
  ip          text,
  request_id  text not null,
  user_agent  text
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_id, created_at desc);
alter table public.admin_audit_logs enable row level security;
comment on table public.admin_audit_logs is 'Back-office mutations (actor, route, status, request id). Never request bodies. Service role only.';

-- 2. Private tables: no privileges at all for the public API roles ---------------
do $$
declare t text;
begin
  foreach t in array array[
    'admin_audit_logs', 'auth_tokens', 'contact_messages', 'customers',
    'newsletter_campaigns', 'newsletter_deliveries', 'newsletter_subscribers', 'newsletter_suppressions',
    'order_items', 'order_tracking', 'orders', 'payments', 'settings', 'user_identities', 'users'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;

  -- Public catalogue: read-only (the RLS policies still limit it to active rows).
  foreach t in array array['brands', 'collections', 'exclusives', 'instagram_posts', 'product_media', 'products'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Sequences: nothing to generate for the public roles.
revoke all on all sequences in schema public from anon, authenticated;

-- Tables created later by migrations start without grants for the public roles.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Rollback (if a direct Supabase client is ever introduced):
--   grant select, insert, update, delete on all tables in schema public to anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
