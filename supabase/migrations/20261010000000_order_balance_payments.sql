-- =============================================================================
-- THE RISING STAR — real money only: deposit, balance and cash payments
--   An order now records what was really paid (`amount_paid`), from every
--   payment that succeeded: the online deposit, the online balance, or a cash /
--   mobile-money payment the admin records by hand. Its payment status follows
--   from that amount and is never set by hand, and delivering an order no
--   longer marks it paid.
-- Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------- payments ---
alter table public.payments
  add column if not exists kind text not null default 'deposit',
  add column if not exists method text not null default 'paystack',
  add column if not exists note text,
  add column if not exists recorded_by uuid references public.users (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_kind_check') then
    alter table public.payments add constraint payments_kind_check check (kind in ('deposit', 'balance'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_method_check') then
    alter table public.payments add constraint payments_method_check
      check (method in ('paystack', 'cash', 'mobile_money', 'bank_transfer', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_positive') then
    alter table public.payments add constraint payments_amount_positive check (amount > 0) not valid;
  end if;
end $$;
comment on column public.payments.kind is 'deposit = first payment of the order, balance = any later payment';
comment on column public.payments.method is 'paystack = paid online; cash / mobile_money / bank_transfer / other = recorded by an admin';

-- ------------------------------------------------------------------ orders ---
alter table public.orders
  add column if not exists amount_paid numeric(14, 0) not null default 0,
  add column if not exists fully_paid_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_amount_paid_check') then
    alter table public.orders add constraint orders_amount_paid_check check (amount_paid >= 0) not valid;
  end if;
end $$;
comment on column public.orders.amount_paid is 'Money really received for this order (sum of its successful payments, net of refunds).';

-- Rebuild from the payments themselves: no order counts as paid without money behind it.
update public.orders o set
  amount_paid = coalesce(p.paid, 0),
  payment_status = case
    when o.payment_status = 'refunded' then 'refunded'
    when coalesce(p.paid, 0) >= o.total_price and o.total_price > 0 then 'paid'
    when coalesce(p.paid, 0) > 0 then 'deposit_paid'
    else 'pending'
  end,
  fully_paid_at = case when coalesce(p.paid, 0) >= o.total_price and o.total_price > 0 then coalesce(o.fully_paid_at, now()) end
from (
  select o2.id, sum(pay.amount) filter (where pay.status = 'success') as paid
  from public.orders o2 left join public.payments pay on pay.order_id = o2.id
  group by o2.id
) p
where p.id = o.id;

/**
 * Adds a received (or, negative, refunded) amount to an order in one atomic
 * step and derives its payment status from the new total. Called by the API
 * only after the payment itself has been recorded as successful (or refunded).
 */
create or replace function public.apply_order_payment(p_order_id uuid, p_amount numeric)
returns table (amount_paid numeric, total_price numeric, payment_status text)
language sql
security definer
set search_path = public
as $$
  update public.orders o set
    amount_paid = greatest(o.amount_paid + p_amount, 0),
    payment_status = case
      when greatest(o.amount_paid + p_amount, 0) >= o.total_price and o.total_price > 0 then 'paid'
      when greatest(o.amount_paid + p_amount, 0) > 0 then 'deposit_paid'
      when p_amount < 0 then 'refunded'
      else o.payment_status
    end,
    fully_paid_at = case
      when greatest(o.amount_paid + p_amount, 0) >= o.total_price and o.total_price > 0 then coalesce(o.fully_paid_at, now())
    end,
    updated_at = now()
  where o.id = p_order_id
  returning o.amount_paid, o.total_price, o.payment_status;
$$;
revoke all on function public.apply_order_payment(uuid, numeric) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_order_payment(uuid, numeric) to service_role;
  end if;
end $$;

-- "Total spent" by a customer = money really paid, not the value of what was ordered.
create or replace function public.refresh_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[] := array[]::uuid[];
  cid uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then ids := ids || new.customer_id; end if;
  if tg_op in ('UPDATE', 'DELETE') then ids := ids || old.customer_id; end if;
  foreach cid in array ids loop
    update public.customers c set
      total_orders = coalesce(s.n, 0),
      total_spent = coalesce(s.paid, 0)
    from (
      select count(*) filter (where status <> 'cancelled') as n, sum(amount_paid) as paid
      from public.orders where customer_id = cid
    ) s
    where c.id = cid;
  end loop;
  return null;
end;
$$;

drop trigger if exists orders_refresh_customer_stats on public.orders;
create trigger orders_refresh_customer_stats
  after insert or update of status, total_price, amount_paid, customer_id or delete on public.orders
  for each row execute function public.refresh_customer_stats();

update public.customers c set total_spent = coalesce(s.paid, 0)
from (select customer_id, sum(amount_paid) as paid from public.orders group by customer_id) s
where s.customer_id = c.id;
