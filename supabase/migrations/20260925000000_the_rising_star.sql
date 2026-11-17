-- =============================================================================
-- THE RISING STAR — schema upgrade
--   * The store now sells all wearables (clothing, shoes, bags, accessories,
--     jewelry) instead of sneakers only.
--   * Sizes become free text ("M", "42", "TU") instead of integers.
--   * New merchandising fields, contact messages and newsletter tables.
--   * Rebrand default settings from COURTLAB to THE RISING STAR.
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

-- ---------------------------------------------------------------- products ---
alter table public.products add column if not exists compare_at_price numeric;
alter table public.products add column if not exists subcategory text;
alter table public.products add column if not exists gender text;
alter table public.products add column if not exists materials text;
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists is_featured boolean not null default false;

-- sizes: integer[] / jsonb → text[]
do $$
declare
  col_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into col_type
  from pg_attribute a
  where a.attrelid = 'public.products'::regclass and a.attname = 'sizes' and not a.attisdropped;

  if col_type is null then
    alter table public.products add column sizes text[] not null default '{}';
  elsif col_type = 'jsonb' or col_type = 'json' then
    -- USING cannot contain a subquery: go through a temporary column.
    alter table public.products add column sizes_text text[] not null default '{}';
    update public.products
      set sizes_text = coalesce(array(select jsonb_array_elements_text(
        case when jsonb_typeof(sizes::jsonb) = 'array' then sizes::jsonb else '[]'::jsonb end)), '{}');
    alter table public.products drop column sizes;
    alter table public.products rename column sizes_text to sizes;
  elsif col_type <> 'text[]' then
    alter table public.products alter column sizes drop default;
    alter table public.products alter column sizes type text[] using sizes::text[];
    alter table public.products alter column sizes set default '{}';
  end if;
end $$;

-- Map legacy sneaker categories ("Basketball", "lifestyle", …) to the taxonomy
update public.products
set subcategory = coalesce(subcategory, initcap(category)),
    category = 'shoes'
where category is null
   or lower(category) not in ('clothing', 'shoes', 'bags', 'accessories', 'jewelry');

update public.products set gender = 'unisex' where gender is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_category_check') then
    alter table public.products add constraint products_category_check
      check (category in ('clothing', 'shoes', 'bags', 'accessories', 'jewelry'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_gender_check') then
    alter table public.products add constraint products_gender_check
      check (gender is null or gender in ('men', 'women', 'unisex', 'kids'));
  end if;
end $$;

create index if not exists products_category_idx on public.products (category) where is_active;
create index if not exists products_featured_idx on public.products (is_featured) where is_active;

-- ------------------------------------------------------------- order items ---
do $$
declare
  col_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into col_type
  from pg_attribute a
  where a.attrelid = 'public.order_items'::regclass and a.attname = 'size' and not a.attisdropped;

  if col_type is not null and col_type <> 'text' then
    alter table public.order_items alter column size type text using size::text;
  end if;
end $$;

-- -------------------------------------------------------- contact messages ---
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

-- ------------------------------------------------------------- newsletter ---
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

-- Only the service role (API) may touch these tables.
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ---------------------------------------------------------------- settings ---
-- Rebrand values that still carry the old name; untouched custom values stay.
update public.settings set value = '"THE RISING STAR"'
where key = 'store_name' and value::text ilike '%courtlab%';

update public.settings set value = '"THE RISING STAR | Élégance. Audace. Exclusivité."'
where key = 'seo_title' and value::text ilike '%courtlab%';

update public.settings set value = '"#D4AF37"'
where key = 'primary_color' and value::text ilike '%FF6B00%';

-- Any other text setting mentioning the old brand (emails, socials, SEO…)
do $$
declare
  col_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into col_type
  from pg_attribute a
  where a.attrelid = 'public.settings'::regclass and a.attname = 'value' and not a.attisdropped;

  execute format(
    'update public.settings set value = (replace(replace(value::text, %L, %L), %L, %L))::%s where value::text ilike %L',
    'COURTLAB', 'THE RISING STAR', 'courtlab', 'therisingstar', col_type, '%courtlab%'
  );
end $$;

-- Sneaker-only copy no longer fits: drop it so the app's new defaults apply.
delete from public.settings
where key in ('hero_title', 'hero_subtitle', 'hero_cta_primary', 'hero_cta_secondary', 'store_description', 'seo_description', 'seo_keywords')
  and (value::text ilike '%sneaker%' or value::text ilike '%basket%' or value::text ilike '%Performance.%');

commit;
