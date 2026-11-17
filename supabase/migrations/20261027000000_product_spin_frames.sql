-- =============================================================================
-- Turn-around photos: the pictures taken around a piece on a turntable, in
-- order. The storefront steps through them as the visitor turns the piece.
-- Idempotent.
-- =============================================================================
alter table public.products
  add column if not exists spin_frames text[] not null default '{}';

comment on column public.products.spin_frames is 'Public URLs of the turntable photos, in order (a full turn). Fewer than 2 disables the rotation.';
