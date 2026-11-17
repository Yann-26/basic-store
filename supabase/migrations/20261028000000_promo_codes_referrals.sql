-- =============================================================================
-- Promo codes and referral.
--
--   * promo_codes: codes created in the back-office (manual), each customer's
--     code to share with friends (referral) and the credit a referrer receives
--     once a friend's order is delivered (reward).
--   * promo_redemptions: one row per order that used a code; released when the
--     order is cancelled, so the use goes back to the code.
--   * orders: the basket before discount, the discount, the code used and the
--     account that referred the customer.
--
-- Uses are counted atomically by redeem_promo_code() / release_promo_code().
-- Private tables: service role only (the API). Idempotent.
-- =============================================================================

create table if not exists public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,
  kind              text not null check (kind in ('percent', 'fixed')),
  value             numeric(14, 0) not null check (value > 0),
  description       text not null default '',
  min_order         numeric(14, 0) not null default 0 check (min_order >= 0),
  max_uses          integer check (max_uses is null or max_uses > 0),
  per_account_limit integer not null default 1 check (per_account_limit > 0),
  starts_at         timestamptz,
  ends_at           timestamptz,
  is_active         boolean not null default true,
  source            text not null default 'manual' check (source in ('manual', 'referral', 'reward')),
  owner_user_id     uuid references public.users (id) on delete cascade,
  source_order_id   uuid references public.orders (id) on delete set null,
  first_order_only  boolean not null default false,
  uses              integer not null default 0 check (uses >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint promo_codes_percent_check check (kind <> 'percent' or value <= 100)
);
create unique index if not exists promo_codes_code_key on public.promo_codes (upper(code));
-- One code to share per account, one reward per referred order.
create unique index if not exists promo_codes_referral_owner_key on public.promo_codes (owner_user_id) where source = 'referral';
create unique index if not exists promo_codes_reward_order_key on public.promo_codes (source_order_id) where source = 'reward';
create index if not exists promo_codes_owner_idx on public.promo_codes (owner_user_id);
alter table public.promo_codes enable row level security;
comment on table public.promo_codes is 'Promo, referral and reward codes. Service role only.';

create table if not exists public.promo_redemptions (
  id            uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  order_id      uuid not null references public.orders (id) on delete cascade,
  user_id       uuid references public.users (id) on delete set null,
  amount        numeric(14, 0) not null check (amount >= 0),
  released_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists promo_redemptions_order_key on public.promo_redemptions (order_id);
create index if not exists promo_redemptions_code_user_idx on public.promo_redemptions (promo_code_id, user_id);
alter table public.promo_redemptions enable row level security;
comment on table public.promo_redemptions is 'Orders that used a promo code. Service role only.';

alter table public.orders
  add column if not exists subtotal_price numeric(14, 0),
  add column if not exists discount_amount numeric(14, 0) not null default 0,
  add column if not exists promo_code text,
  add column if not exists referred_by_user_id uuid references public.users (id) on delete set null;
create index if not exists orders_referred_by_idx on public.orders (referred_by_user_id) where referred_by_user_id is not null;
comment on column public.orders.subtotal_price is 'Basket before discount (total_price is what the customer pays).';
comment on column public.orders.referred_by_user_id is 'Account whose referral code the customer used.';

revoke all on table public.promo_codes, public.promo_redemptions from anon, authenticated;

/**
 * Records that an order used a code, if it still can: the code is locked, its
 * total and per-account limits are checked and its use count goes up, in one
 * step. False when the code can no longer be used (another order took the last use).
 */
create or replace function public.redeem_promo_code(p_code_id uuid, p_order_id uuid, p_user_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.promo_codes;
  used integer;
begin
  select * into c from public.promo_codes where id = p_code_id for update;
  if not found or not c.is_active then return false; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return false; end if;
  if p_user_id is not null then
    select count(*) into used from public.promo_redemptions
      where promo_code_id = p_code_id and user_id = p_user_id and released_at is null;
    if used >= c.per_account_limit then return false; end if;
  end if;
  insert into public.promo_redemptions (promo_code_id, order_id, user_id, amount)
    values (p_code_id, p_order_id, p_user_id, p_amount);
  update public.promo_codes set uses = uses + 1, updated_at = now() where id = p_code_id;
  return true;
end;
$$;

/** Gives the use back when the order that took it is cancelled. Safe to call twice. */
create or replace function public.release_promo_code(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.promo_redemptions;
begin
  update public.promo_redemptions set released_at = now()
    where order_id = p_order_id and released_at is null
    returning * into r;
  if found then
    update public.promo_codes set uses = greatest(uses - 1, 0), updated_at = now() where id = r.promo_code_id;
  end if;
end;
$$;

revoke all on function public.redeem_promo_code(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.release_promo_code(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.promo_codes, public.promo_redemptions to service_role;
    grant execute on function public.redeem_promo_code(uuid, uuid, uuid, numeric) to service_role;
    grant execute on function public.release_promo_code(uuid) to service_role;
  end if;
end $$;
