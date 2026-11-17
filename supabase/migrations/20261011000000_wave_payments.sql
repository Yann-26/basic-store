-- =============================================================================
-- THE RISING STAR — payments by Wave (Paystack removed)
--   Customers pay through the shop's Wave merchant link. Such a payment is
--   created "pending", declared by the customer, and only counts once an admin
--   has confirmed it (it is then "success" and credited to the order).
-- Idempotent.
-- =============================================================================

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('wave', 'paystack', 'cash', 'mobile_money', 'bank_transfer', 'other'));
alter table public.payments alter column method set default 'wave';
comment on column public.payments.method is
  'wave = paid with the shop''s Wave link, confirmed by an admin; paystack = earlier online payments; cash / mobile_money / bank_transfer / other = recorded by an admin';

alter table public.orders alter column payment_method set default 'wave';

-- The admin list of Wave payments to check.
create index if not exists payments_pending_wave_idx on public.payments (created_at desc) where status = 'pending' and method = 'wave';
