-- =============================================================================
-- Customer reviews and the drop calendar.
--
--   * product_reviews: a rating and a few words (and a photo, optionally) from
--     a customer whose order with the piece was delivered. Shown once approved
--     in the back-office; one review per account and piece.
--   * drops: the upcoming releases (date, visual, pieces), shown on the
--     calendar; drop_reminders: the emails to warn when a drop opens.
--   * storage bucket "reviews": the customers' photos (images only, 5 MB).
--
-- Private tables: service role only (the API). Idempotent.
-- =============================================================================

create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  order_id    uuid references public.orders (id) on delete set null,
  author_name text not null,
  rating      smallint not null check (rating between 1 and 5),
  title       text not null default '',
  body        text not null default '',
  photo_url   text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_reply text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists product_reviews_user_product_key on public.product_reviews (user_id, product_id) where user_id is not null;
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, status, created_at desc);
create index if not exists product_reviews_status_idx on public.product_reviews (status, created_at desc);
alter table public.product_reviews enable row level security;
comment on table public.product_reviews is 'Reviews from customers whose order was delivered; public once approved (through the API). Service role only.';

create table if not exists public.drops (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  image_url    text,
  starts_at    timestamptz not null,
  product_ids  uuid[] not null default '{}',
  location     text not null default '',
  is_published boolean not null default true,
  reminded_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists drops_starts_idx on public.drops (starts_at);
alter table public.drops enable row level security;
comment on table public.drops is 'Drop calendar (releases). Service role only.';

create table if not exists public.drop_reminders (
  id          uuid primary key default gen_random_uuid(),
  drop_id     uuid not null references public.drops (id) on delete cascade,
  email       text not null,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists drop_reminders_drop_email_key on public.drop_reminders (drop_id, lower(email));
create index if not exists drop_reminders_pending_idx on public.drop_reminders (drop_id) where notified_at is null;
alter table public.drop_reminders enable row level security;
comment on table public.drop_reminders is 'Emails to warn when a drop opens. Service role only.';

revoke all on table public.product_reviews, public.drops, public.drop_reminders from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.product_reviews, public.drops, public.drop_reminders to service_role;
  end if;
end $$;

-- Customers' photos: public URLs, uploads only through the API (images, 5 MB).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('reviews', 'reviews', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    on conflict (id) do update
      set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  end if;
end $$;
