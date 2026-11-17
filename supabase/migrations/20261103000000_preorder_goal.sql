-- Preorder goal: a series is made once enough pieces are paid (production paid by the preorders).
alter table public.products
  add column if not exists preorder_goal integer check (preorder_goal is null or preorder_goal > 0),
  add column if not exists preorder_deadline timestamptz;

-- Pieces of a product already paid in full (cancelled orders excluded): the gauge of the product page.
create or replace function public.preorder_pieces(p_product_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.payment_status = 'paid'
    and o.status <> 'cancelled'
$$;

revoke all on function public.preorder_pieces(uuid) from public, anon, authenticated;
grant execute on function public.preorder_pieces(uuid) to service_role;
