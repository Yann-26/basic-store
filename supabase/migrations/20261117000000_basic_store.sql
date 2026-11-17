-- =============================================================================
-- BASIC STORE — from pre-orders to a physical shop that delivers.
--
--  * Stock per size (products.size_stock) kept in sync with products.stock.
--  * Every stock change is logged in stock_movements (orders, cancellations,
--    returns, restocks, in-store sales, inventory corrections).
--  * Orders reserve their stock atomically when they are placed
--    (reserve_order_stock) and give it back when cancelled or returned
--    (release_order_stock) — never twice.
--  * New order flow: pending → confirmed → preparing → out_for_delivery →
--    delivered, plus cancelled and returned.
--  * Payment: online (100 % via Paystack) or cash on delivery.
--  * Delivery fee by zone (Abidjan / intérieur), stored on the order.
--
-- Idempotent: safe to run more than once. Run after every earlier migration.
-- =============================================================================
begin;

-- ---------------------------------------------------------------- products ---
alter table public.products add column if not exists size_stock jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists low_stock_threshold integer not null default 3
  check (low_stock_threshold >= 0);

-- For a product with sizes, stock is the sum of its sizes (sizes removed from the
-- product no longer count). A product without sizes keeps its own stock.
create or replace function public.sync_product_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total integer := 0;
  v_size text;
begin
  if coalesce(array_length(new.sizes, 1), 0) > 0 then
    foreach v_size in array new.sizes loop
      v_total := v_total + greatest(0, coalesce((new.size_stock ->> upper(v_size))::integer, 0));
    end loop;
    new.stock := v_total;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_stock on public.products;
create trigger products_sync_stock
  before insert or update of sizes, size_stock, stock on public.products
  for each row execute function public.sync_product_stock();

-- Existing products with sizes: put their old global stock on the first size so nothing is lost.
update public.products p
set size_stock = jsonb_build_object(upper(p.sizes[1]), p.stock)
where coalesce(array_length(p.sizes, 1), 0) > 0
  and p.size_stock = '{}'::jsonb
  and p.stock > 0;

create index if not exists products_stock_idx on public.products (stock) where is_active;

-- --------------------------------------------------------- stock movements ---
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  product_name text not null default '',
  size text,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('order', 'cancel', 'return', 'restock', 'adjustment', 'sale_in_store')),
  order_id uuid references public.orders (id) on delete set null,
  note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);
alter table public.stock_movements enable row level security;
revoke all on table public.stock_movements from anon, authenticated;

-- ------------------------------------------------------------------ orders ---
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status = 'preparing'
  where status in ('sourcing', 'ordered_supplier', 'shipped_supplier', 'received_warehouse', 'quality_check');
alter table public.orders add constraint orders_status_check check (status in (
  'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'returned'));

alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists delivery_zone text not null default 'abidjan';
alter table public.orders add column if not exists delivery_fee numeric(12, 0) not null default 0 check (delivery_fee >= 0);
alter table public.orders add column if not exists returned_at timestamptz;
alter table public.orders alter column payment_method set default 'cash_on_delivery';

-- --------------------------------------------------------------- functions ---

-- Takes the stock of a freshly written order, in one transaction: locks its
-- products, checks every line, takes the units and logs the movements.
-- Raises 'OUT_OF_STOCK:<product name>:<size>:<available>' when a line cannot be
-- served (nothing is taken then; the API deletes the order). Runs once per order.
create or replace function public.reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_product public.products%rowtype;
  v_has_sizes boolean;
  v_available integer;
begin
  perform 1 from public.orders where id = p_order_id and not stock_reserved for update;
  if not found then
    return false;
  end if;
  -- Lock every product of the order in a stable order (no deadlock between two checkouts).
  perform 1 from public.products
    where id in (select product_id from public.order_items where order_id = p_order_id)
    order by id
    for update;

  for v_line in
    select product_id, product_name, upper(coalesce(size, '')) as size, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id, product_name, upper(coalesce(size, ''))
  loop
    select * into v_product from public.products where id = v_line.product_id;
    if not found then
      raise exception 'OUT_OF_STOCK:%:%:0', v_line.product_name, v_line.size;
    end if;
    v_has_sizes := coalesce(array_length(v_product.sizes, 1), 0) > 0;
    v_available := case when v_has_sizes then coalesce((v_product.size_stock ->> v_line.size)::integer, 0) else v_product.stock end;
    if v_available < v_line.quantity then
      raise exception 'OUT_OF_STOCK:%:%:%', v_product.name, v_line.size, greatest(v_available, 0);
    end if;
    if v_has_sizes then
      update public.products
        set size_stock = jsonb_set(size_stock, array[v_line.size], to_jsonb(v_available - v_line.quantity)), updated_at = now()
        where id = v_product.id;
    else
      update public.products set stock = stock - v_line.quantity, updated_at = now() where id = v_product.id;
    end if;
    insert into public.stock_movements (product_id, product_name, size, delta, reason, order_id)
      values (v_product.id, v_product.name, nullif(v_line.size, ''), -v_line.quantity, 'order', p_order_id);
  end loop;

  update public.orders set stock_reserved = true where id = p_order_id;
  return true;
end;
$$;

-- Puts the stock of an order back (cancelled or returned). Runs once per order:
-- returns false when the stock was already given back.
create or replace function public.release_order_stock(p_order_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_has_sizes boolean;
begin
  if p_reason not in ('cancel', 'return') then
    raise exception 'invalid reason %', p_reason;
  end if;
  update public.orders set stock_reserved = false where id = p_order_id and stock_reserved
    returning id into p_order_id;
  if p_order_id is null then
    return false;
  end if;

  for v_line in
    select oi.product_id, oi.product_name, upper(coalesce(oi.size, '')) as size, oi.quantity, p.sizes
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
  loop
    v_has_sizes := coalesce(array_length(v_line.sizes, 1), 0) > 0;
    if v_has_sizes then
      update public.products
        set size_stock = jsonb_set(size_stock, array[v_line.size],
              to_jsonb(coalesce((size_stock ->> v_line.size)::integer, 0) + v_line.quantity)),
            updated_at = now()
        where id = v_line.product_id;
    else
      update public.products set stock = stock + v_line.quantity, updated_at = now() where id = v_line.product_id;
    end if;
    insert into public.stock_movements (product_id, product_name, size, delta, reason, order_id)
      values (v_line.product_id, v_line.product_name, nullif(v_line.size, ''), v_line.quantity, p_reason, p_order_id);
  end loop;
  return true;
end;
$$;

-- Moves the stock of one product (one size) by hand from the back-office.
-- Never goes below zero. Returns the new quantity of that size.
create or replace function public.adjust_stock(
  p_product_id uuid, p_size text, p_delta integer, p_reason text, p_note text, p_admin uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_size text := upper(coalesce(p_size, ''));
  v_has_sizes boolean;
  v_current integer;
  v_next integer;
begin
  if p_delta = 0 then
    raise exception 'delta must not be zero';
  end if;
  if p_reason not in ('restock', 'adjustment', 'sale_in_store') then
    raise exception 'invalid reason %', p_reason;
  end if;
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  v_has_sizes := coalesce(array_length(v_product.sizes, 1), 0) > 0;
  if v_has_sizes and not (v_size = any (select upper(s) from unnest(v_product.sizes) s)) then
    raise exception 'UNKNOWN_SIZE:%', v_size;
  end if;
  v_current := case when v_has_sizes then coalesce((v_product.size_stock ->> v_size)::integer, 0) else v_product.stock end;
  v_next := v_current + p_delta;
  if v_next < 0 then
    raise exception 'OUT_OF_STOCK:%:%:%', v_product.name, v_size, v_current;
  end if;
  if v_has_sizes then
    update public.products set size_stock = jsonb_set(size_stock, array[v_size], to_jsonb(v_next)), updated_at = now() where id = p_product_id;
  else
    update public.products set stock = v_next, updated_at = now() where id = p_product_id;
  end if;
  insert into public.stock_movements (product_id, product_name, size, delta, reason, note, created_by)
    values (p_product_id, v_product.name, nullif(v_size, ''), p_delta, p_reason, nullif(trim(coalesce(p_note, '')), ''), p_admin);
  return v_next;
end;
$$;

revoke all on function public.reserve_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.release_order_stock(uuid, text) from public, anon, authenticated;
revoke all on function public.adjust_stock(uuid, text, integer, text, text, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.reserve_order_stock(uuid) to service_role;
    grant execute on function public.release_order_stock(uuid, text) to service_role;
    grant execute on function public.adjust_stock(uuid, text, integer, text, text, uuid) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------- settings ---
insert into public.settings (key, value, category) values
  ('delivery_fee_abidjan', to_jsonb('1500'::text), 'delivery'),
  ('delivery_fee_interior', to_jsonb('3000'::text), 'delivery'),
  ('free_delivery_from', to_jsonb('0'::text), 'delivery'),
  ('cash_on_delivery_enabled', to_jsonb('true'::text), 'delivery'),
  ('online_payment_enabled', to_jsonb('true'::text), 'delivery')
on conflict (key) do nothing;

update public.settings set value = to_jsonb('2'::text) where key = 'delivery_days_min';
update public.settings set value = to_jsonb('5'::text) where key = 'delivery_days_max';

-- Brand: Basic Store (only the values still holding the previous brand's defaults).
update public.settings set value = to_jsonb('"Basic Store"'::text)
  where key = 'store_name';
update public.settings set value = to_jsonb('"La qualité à bon prix. Vêtements, chaussures et accessoires — boutique à Angré Nouveau CHU, Djorogobité 1. On livre partout en Côte d’Ivoire."'::text)
  where key = 'store_description';
update public.settings set value = to_jsonb('"+225 07 19 19 19 09"'::text) where key in ('store_phone', 'store_whatsapp');
update public.settings set value = to_jsonb('"Angré Nouveau CHU, Djorogobité 1"'::text) where key = 'store_address';
update public.settings set value = to_jsonb('"#0A0A0A"'::text) where key = 'primary_color';
update public.settings set value = to_jsonb('"basicstoreci"'::text) where key = 'social_instagram';
update public.settings set value = to_jsonb('"Basic Store | La qualité à bon prix — Abidjan"'::text) where key = 'seo_title';
update public.settings set value = to_jsonb('"Livraison partout en Côte d’Ivoire · Paiement à la livraison ou en ligne · Boutique à Angré"'::text)
  where key = 'announcement_text';

commit;
