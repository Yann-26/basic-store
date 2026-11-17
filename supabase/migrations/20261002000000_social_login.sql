-- =============================================================================
-- THE RISING STAR — sign-in with Google, Facebook and TikTok
--   * user_identities: social accounts linked to a user (one per provider).
--     Only the provider's stable user id is stored, never its access tokens.
--   * users.password_set: false for accounts created through a social login
--     (they get an unusable random password until they choose one through
--     "Mot de passe oublié"). Used so a user can't unlink their only way in.
--   * auth_tokens: new purposes 'oauth_login' (the one-time code the storefront
--     exchanges for a session after the provider redirect) and 'oauth_link'
--     (starts linking a provider from "Mon compte").
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

alter table public.users add column if not exists password_set boolean not null default true;

create table if not exists public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'facebook', 'tiktok')),
  provider_user_id text not null,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (user_id, provider)
);
create index if not exists user_identities_user_idx on public.user_identities (user_id);
alter table public.user_identities enable row level security; -- service role only

alter table public.auth_tokens drop constraint if exists auth_tokens_purpose_check;
alter table public.auth_tokens add constraint auth_tokens_purpose_check
  check (purpose in ('verify_email', 'reset_password', 'oauth_login', 'oauth_link'));

-- Choosing a password through a reset link makes it a real one.
create or replace function public.reset_user_password(p_user_id uuid, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return jsonb_build_object('success', false, 'message', 'Mot de passe trop court');
  end if;
  update public.users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         password_set = true,
         tokens_valid_after = now(),
         -- Receiving the reset link proves the address.
         email_verified_at = coalesce(email_verified_at, now())
   where id = p_user_id and is_active = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Compte introuvable ou suspendu');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.reset_user_password(uuid, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.reset_user_password(uuid, text) to service_role;
  end if;
end $$;

commit;
