-- =============================================================================
-- THE RISING STAR — base schema (fresh install)
--
-- Creates every table, function, trigger, RLS policy and storage bucket the
-- API needs. Idempotent and non-destructive: on a database that already has
-- the COURTLAB tables it only adds what is missing. The later
-- 20260925000000_the_rising_star.sql upgrade migration then runs as a no-op
-- for the parts already created here.
--
-- Access model: the API talks to Postgres with the service-role key (which
-- bypasses RLS). RLS is enabled everywhere; anonymous clients may only read
-- the public catalogue.
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------ helpers ---
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------- users ---
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  whatsapp text,
  role text default 'customer',
  is_active boolean default true,
  last_login timestamptz,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists users_email_key on public.users (lower(email));

-- ---------------------------------------------------------------- settings ---
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  category text not null default 'general',
  description text,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Upserts use ON CONFLICT (key)
create unique index if not exists settings_key_key on public.settings (key);

-- --------------------------------------------------------------- catalogue ---
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  logo_url text default '',
  banner_url text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  brand_id uuid references public.brands (id) on delete restrict,
  image_url text default '',
  banner_url text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collections_brand_idx on public.collections (brand_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  price numeric(12, 0) not null check (price >= 0),
  compare_at_price numeric(12, 0),
  category text not null default 'clothing'
    constraint products_category_check check (category in ('clothing', 'shoes', 'bags', 'accessories', 'jewelry')),
  subcategory text,
  gender text default 'unisex'
    constraint products_gender_check check (gender is null or gender in ('men', 'women', 'unisex', 'kids')),
  status text not null default 'available' check (status in ('available', 'unavailable', 'limited')),
  stock integer not null default 0 check (stock >= 0),
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  materials text,
  features text[] not null default '{}',
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  release_date date,
  brand_id uuid references public.brands (id) on delete set null,
  collection_id uuid references public.collections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category) where is_active;
create index if not exists products_featured_idx on public.products (is_featured) where is_active;
create index if not exists products_brand_idx on public.products (brand_id);
create index if not exists products_collection_idx on public.products (collection_id);
create index if not exists products_created_idx on public.products (created_at desc);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  file_path text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  is_main boolean not null default false,
  thumbnail_url text,
  alt_text text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_media_product_idx on public.product_media (product_id);

-- ---------------------------------------------------------------- commerce ---
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  whatsapp text,
  email text,
  city text default '',
  address text default '',
  notes text default '',
  total_orders integer not null default 0,
  total_spent numeric(14, 0) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_phone_key on public.customers (phone);
create unique index if not exists customers_email_key on public.customers (lower(email)) where email is not null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  preorder_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  status text not null default 'pending' check (status in (
    'pending', 'confirmed', 'sourcing', 'ordered_supplier', 'shipped_supplier',
    'received_warehouse', 'quality_check', 'out_for_delivery', 'delivered', 'cancelled')),
  total_price numeric(14, 0) not null default 0,
  deposit_amount numeric(14, 0) not null default 0,
  deposit_percentage numeric(5, 2) not null default 35,
  remaining_amount numeric(14, 0) not null default 0,
  payment_method text not null default 'paystack',
  payment_status text not null default 'pending',
  customer_notes text default '',
  admin_notes text,
  delivery_address text default '',
  delivery_city text default '',
  estimated_delivery date,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_price numeric(12, 0) not null default 0,
  size text,
  color text,
  quantity integer not null default 1 check (quantity between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

create table if not exists public.order_tracking (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  notes text,
  location text,
  created_at timestamptz not null default now()
);
create index if not exists order_tracking_order_idx on public.order_tracking (order_id, created_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  reference text not null unique,
  amount numeric(14, 0) not null,
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded')),
  channel text,
  customer_email text not null,
  customer_id uuid references public.customers (id) on delete set null,
  metadata jsonb not null default '{}',
  error_message text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);

-- -------------------------------------------------------------- engagement ---
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  caption text,
  embed_code text,
  post_url text,
  permalink text,
  post_id text,
  media_type text default 'image',
  likes integer default 0,
  comments integer default 0,
  is_published boolean not null default true,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------- updated_at hooks ---
do $$
declare
  t text;
begin
  foreach t in array array['users', 'settings', 'brands', 'collections', 'products', 'customers', 'orders', 'payments', 'instagram_posts']
  loop
    if not exists (select 1 from pg_trigger where tgname = t || '_set_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------- customer stats (orders count) ---
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
      total_spent = coalesce(s.total, 0)
    from (
      select count(*) as n, sum(total_price) as total
      from public.orders where customer_id = cid and status <> 'cancelled'
    ) s
    where c.id = cid;
  end loop;
  return null;
end;
$$;

drop trigger if exists orders_refresh_customer_stats on public.orders;
create trigger orders_refresh_customer_stats
  after insert or update of status, total_price, customer_id or delete on public.orders
  for each row execute function public.refresh_customer_stats();

-- Trigger functions must not be callable through the REST API.
revoke execute on function public.refresh_customer_stats() from public, anon, authenticated;
do $$
begin
  if to_regproc('public.rls_auto_enable') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- ------------------------------------------------------------ auth (RPCs) ---
-- Passwords are hashed with bcrypt (pgcrypto) inside the database.
create or replace function public.authenticate_user(user_email text, user_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.users%rowtype;
begin
  select * into u from public.users
  where lower(email) = lower(trim(user_email)) and is_active = true;

  if not found or u.password_hash <> crypt(user_password, u.password_hash) then
    return jsonb_build_object('success', false, 'message', 'Email ou mot de passe incorrect');
  end if;

  update public.users set last_login = now() where id = u.id;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', u.id, 'email', u.email, 'first_name', u.first_name,
      'last_name', u.last_name, 'phone', u.phone, 'role', coalesce(u.role, 'customer')
    )
  );
end;
$$;

create or replace function public.create_user(
  user_email text,
  user_password text,
  user_first_name text,
  user_last_name text,
  user_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.users%rowtype;
begin
  if length(coalesce(user_password, '')) < 8 then
    return jsonb_build_object('success', false, 'message', 'Mot de passe trop court');
  end if;
  if exists (select 1 from public.users where lower(email) = lower(trim(user_email))) then
    return jsonb_build_object('success', false, 'message', 'Cet email est déjà utilisé');
  end if;

  insert into public.users (email, password_hash, first_name, last_name, phone, role)
  values (lower(trim(user_email)), crypt(user_password, gen_salt('bf', 10)), trim(user_first_name), trim(user_last_name), user_phone, 'customer')
  returning * into u;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', u.id, 'email', u.email, 'first_name', u.first_name,
      'last_name', u.last_name, 'phone', u.phone, 'role', u.role
    )
  );
end;
$$;

-- Only the API (service role) may call the auth RPCs.
revoke all on function public.authenticate_user(text, text) from public, anon, authenticated;
revoke all on function public.create_user(text, text, text, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.authenticate_user(text, text) to service_role;
    grant execute on function public.create_user(text, text, text, text, text) to service_role;
  end if;
end $$;

-- --------------------------------------------------------------------- RLS ---
do $$
declare
  t text;
begin
  foreach t in array array['users', 'settings', 'brands', 'collections', 'products', 'product_media', 'customers', 'orders',
                           'order_items', 'order_tracking', 'payments', 'contact_messages', 'newsletter_subscribers', 'instagram_posts']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Public read access to the catalogue only; everything else is service-role only.
drop policy if exists "Public can read active brands" on public.brands;
create policy "Public can read active brands" on public.brands for select using (is_active);

drop policy if exists "Public can read active collections" on public.collections;
create policy "Public can read active collections" on public.collections for select using (is_active);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select using (is_active);

drop policy if exists "Public can read media of active products" on public.product_media;
create policy "Public can read media of active products" on public.product_media for select
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

drop policy if exists "Public can read published instagram posts" on public.instagram_posts;
create policy "Public can read published instagram posts" on public.instagram_posts for select using (is_published);

-- ----------------------------------------------------------------- storage ---
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('products', 'products', true), ('hero', 'hero', true), ('settings', 'settings', true), ('avatars', 'avatars', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------- default settings ---
-- Values are stored as JSON text inside jsonb, matching what the API writes.
insert into public.settings (key, value, category) values
  ('store_name', to_jsonb('"THE RISING STAR"'::text), 'general'),
  ('store_description', to_jsonb('"La maison de mode premium d''Afrique de l''Ouest : vêtements, chaussures et accessoires sélectionnés, en précommande."'::text), 'general'),
  ('store_email', to_jsonb('"hello@therisingstar.ci"'::text), 'general'),
  ('store_phone', to_jsonb('"+225 07 99 51 22 37"'::text), 'general'),
  ('store_whatsapp', to_jsonb('"+225 07 99 51 22 37"'::text), 'general'),
  ('store_address', to_jsonb('"Cocody, Riviera"'::text), 'general'),
  ('store_city', to_jsonb('"Abidjan"'::text), 'general'),
  ('store_country', to_jsonb('"Côte d''Ivoire"'::text), 'general'),
  ('primary_color', to_jsonb('"#D4AF37"'::text), 'appearance'),
  ('deposit_percentage', to_jsonb('35'::text), 'preorder'),
  ('delivery_days_min', to_jsonb('10'::text), 'preorder'),
  ('delivery_days_max', to_jsonb('15'::text), 'preorder'),
  ('max_items_per_order', to_jsonb('10'::text), 'preorder'),
  ('customer_order_confirmation', to_jsonb('true'::text), 'notifications'),
  ('admin_order_notification', to_jsonb('true'::text), 'notifications'),
  ('social_instagram', to_jsonb('"therisingstar.ci"'::text), 'social'),
  ('social_tiktok', to_jsonb('"@therisingstar"'::text), 'social'),
  ('social_facebook', to_jsonb('"therisingstar"'::text), 'social'),
  ('social_snapchat', to_jsonb('"therisingstar"'::text), 'social'),
  ('seo_title', to_jsonb('"THE RISING STAR | Élégance. Audace. Exclusivité."'::text), 'seo'),
  ('announcement_text', to_jsonb('"Livraison partout en Côte d’Ivoire · Acompte de 35 % seulement · Authenticité garantie"'::text), 'storefront')
on conflict (key) do nothing;

commit;
