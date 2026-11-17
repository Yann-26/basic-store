-- Numbered pieces: a limited series has a fixed size (e.g. 50 pieces). Each piece of it gets a
-- number ("Pièce 27 / 50") when the order's first payment (the deposit) is received, so abandoned
-- baskets never take a number. When every number is given, the series is complete (sold out).
alter table public.products
  add column if not exists series_size integer check (series_size is null or series_size > 0),
  add column if not exists pieces_numbered integer not null default 0 check (pieces_numbered >= 0);

alter table public.order_items
  add column if not exists piece_numbers integer[] not null default '{}';

-- The gauge counts pieces whose order is paid, deposit included (the balance comes before delivery).
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
    and o.payment_status in ('deposit_paid', 'paid')
    and o.status <> 'cancelled'
$$;

/**
 * Gives the next numbers of their series to the pieces of an order (lines of numbered products
 * that have none yet). Each product row is locked by its update, so two orders paid at the same
 * moment never share a number; calling it again changes nothing. Returns every line of the order.
 */
create or replace function public.number_order_pieces(p_order_id uuid)
returns table (order_item_id uuid, product_id uuid, piece_numbers integer[], series_size integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  line record;
  first_number integer;
begin
  for line in
    select oi.id, oi.product_id, oi.quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and p.series_size is not null
      and cardinality(oi.piece_numbers) = 0
      and oi.quantity > 0
    order by oi.id
    for update of oi
  loop
    update public.products
      set pieces_numbered = pieces_numbered + line.quantity
      where id = line.product_id
      returning pieces_numbered - line.quantity into first_number;
    update public.order_items
      set piece_numbers = array(select generate_series(first_number + 1, first_number + line.quantity))
      where id = line.id;
  end loop;

  return query
    select oi.id, oi.product_id, oi.piece_numbers, p.series_size
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id;
end;
$$;

revoke all on function public.number_order_pieces(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.number_order_pieces(uuid) to service_role;
  end if;
end $$;
