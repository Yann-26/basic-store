-- =============================================================================
-- THE RISING STAR — newsletter scheduler (pg_cron + pg_net)
--   Every 5 minutes the database calls POST {newsletter_cron_url} with
--   "Authorization: Bearer <secret>". The secret is generated here, kept in
--   Supabase Vault and never leaves the database: the API checks it by calling
--   verify_cron_secret() (service role only). No secret to copy anywhere.
--
--   One-time setup per environment (production URL of the API):
--     select vault.create_secret('https://<domain>/api/cron/newsletter', 'newsletter_cron_url');
--   Without that URL the job runs but does nothing.
-- Idempotent.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'newsletter_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'newsletter_cron_secret', 'Authenticates the newsletter cron calls to the API');
  end if;
end $$;

create or replace function public.verify_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'newsletter_cron_secret' and decrypted_secret = p_secret and length(p_secret) >= 32
  );
$$;
revoke all on function public.verify_cron_secret(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.verify_cron_secret(text) to service_role;
  end if;
end $$;

create or replace function public.dispatch_newsletter()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  -- Only call the API when something is due (no traffic otherwise).
  if not exists (
    select 1 from public.newsletter_campaigns
     where status = 'sending' or (status = 'scheduled' and scheduled_at <= now())
  ) then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function public.dispatch_newsletter() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'newsletter-dispatch';
select cron.schedule('newsletter-dispatch', '*/5 * * * *', 'select public.dispatch_newsletter()');
