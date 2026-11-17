-- =============================================================================
-- THE RISING STAR — Exclusivités
--   * exclusives: groups of rare, premium pieces created by the admin
--     ("Nike JA Morant", …), shown on the Exclusivités page.
--   * products.is_exclusive: an exclusive piece only appears on the
--     Exclusivités page (not on the home page or in the shop), but stays
--     reachable by its own page, search and checkout.
--   * products.exclusive_id: the group it belongs to.
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

create table if not exists public.exclusives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  brand_id uuid references public.brands (id) on delete set null,
  image_url text default '',
  banner_url text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exclusives_brand_idx on public.exclusives (brand_id);

alter table public.products add column if not exists is_exclusive boolean not null default false;
alter table public.products add column if not exists exclusive_id uuid references public.exclusives (id) on delete set null;
create index if not exists products_exclusive_idx on public.products (exclusive_id);
create index if not exists products_is_exclusive_idx on public.products (is_exclusive) where is_active;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'exclusives_set_updated_at') then
    create trigger exclusives_set_updated_at before update on public.exclusives
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Same access model as brands/collections: public read of active rows, writes via the API (service role).
alter table public.exclusives enable row level security;
drop policy if exists "Public can read active exclusives" on public.exclusives;
create policy "Public can read active exclusives" on public.exclusives for select using (is_active);

commit;
