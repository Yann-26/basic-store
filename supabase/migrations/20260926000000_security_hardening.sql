-- =============================================================================
-- THE RISING STAR — security hardening
--   * users.tokens_valid_after: session tokens issued before this instant are
--     rejected (bumped on password change → logs out every other session).
--   * change_user_password(): verifies the current password and re-hashes the
--     new one with bcrypt, inside the database. Service role only.
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

alter table public.users
  add column if not exists tokens_valid_after timestamptz not null default '1970-01-01T00:00:00Z';

create or replace function public.change_user_password(p_user_id uuid, p_current_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.users%rowtype;
begin
  select * into u from public.users where id = p_user_id and is_active = true;
  if not found or u.password_hash <> crypt(p_current_password, u.password_hash) then
    return jsonb_build_object('success', false, 'message', 'Mot de passe actuel incorrect');
  end if;
  if length(coalesce(p_new_password, '')) < 8 then
    return jsonb_build_object('success', false, 'message', 'Mot de passe trop court');
  end if;
  if p_new_password = p_current_password then
    return jsonb_build_object('success', false, 'message', 'Le nouveau mot de passe doit être différent de l''actuel');
  end if;

  update public.users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         tokens_valid_after = now()
   where id = u.id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.change_user_password(uuid, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.change_user_password(uuid, text, text) to service_role;
  end if;
end $$;

commit;
