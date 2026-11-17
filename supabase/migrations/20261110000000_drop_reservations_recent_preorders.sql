-- Reservations before the release: a drop can take pre-orders (deposit) right away, its date
-- being the release (default), or keep its pieces for its opening (early access for the list).
alter table public.drops
  add column if not exists preorders_open boolean not null default true;

-- Pre-orders of a piece over a recent window (orders with at least the deposit paid, not
-- cancelled): "12 précommandes ces dernières 24 h" on the product page.
create or replace function public.recent_preorders(p_product_id uuid, p_since timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select count(distinct o.id)::integer
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where oi.product_id = p_product_id
    and o.payment_status in ('deposit_paid', 'paid')
    and o.status <> 'cancelled'
    and o.created_at >= p_since
$$;

revoke all on function public.recent_preorders(uuid, timestamptz) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.recent_preorders(uuid, timestamptz) to service_role;
  end if;
end $$;
