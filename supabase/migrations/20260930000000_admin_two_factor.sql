-- =============================================================================
-- THE RISING STAR — two-factor authentication for admins (TOTP, RFC 6238)
--   * totp_secret / totp_pending_secret: encrypted by the API (AES-256-GCM),
--     never stored in clear. The pending secret is the one being set up.
--   * totp_last_counter: last accepted time step, so a code can't be replayed.
--   * totp_recovery_codes: SHA-256 hashes of the one-time recovery codes.
-- Reset an admin who lost their phone and recovery codes (they set up 2FA
-- again at their next login):
--   update public.users set totp_secret = null, totp_enabled_at = null,
--     totp_recovery_codes = '{}', tokens_valid_after = now() where email = '…';
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

alter table public.users add column if not exists totp_secret text;
alter table public.users add column if not exists totp_pending_secret text;
alter table public.users add column if not exists totp_enabled_at timestamptz;
alter table public.users add column if not exists totp_last_counter bigint not null default 0;
alter table public.users add column if not exists totp_recovery_codes text[] not null default '{}';

commit;
