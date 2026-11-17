-- =============================================================================
-- Online payments by Paystack again (Wave link removed).
--   New payments and orders default to Paystack; older Wave payments keep their
--   method and can still be confirmed or refused by an admin. Idempotent.
-- =============================================================================
alter table public.payments alter column method set default 'paystack';
alter table public.orders alter column payment_method set default 'paystack';
comment on column public.payments.method is
  'paystack = paid online (Mobile Money or card), confirmed by Paystack; wave = older payments with the shop''s Wave link, confirmed by an admin; cash / mobile_money / bank_transfer / other = recorded by an admin';
