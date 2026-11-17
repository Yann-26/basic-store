-- =============================================================================
-- THE RISING STAR — account security & customer area
--   * users.email_verified_at: email confirmed through a link. Accounts that
--     existed before this migration are considered verified.
--   * auth_tokens: one-time links (email verification, password reset). Only
--     a SHA-256 hash of each token is stored; tokens expire and are single-use.
--   * reset_user_password(): sets a new bcrypt password after a reset link and
--     revokes every session. Service role only.
--   * orders.user_id: the account that placed the order ("Mon compte").
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

alter table public.users add column if not exists email_verified_at timestamptz;
update public.users set email_verified_at = coalesce(created_at, now()) where email_verified_at is null;

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_user_idx on public.auth_tokens (user_id, purpose);
alter table public.auth_tokens enable row level security; -- service role only

alter table public.orders add column if not exists user_id uuid references public.users (id) on delete set null;
create index if not exists orders_user_idx on public.orders (user_id);

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
