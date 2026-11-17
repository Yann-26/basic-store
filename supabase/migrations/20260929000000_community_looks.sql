-- =============================================================================
-- THE RISING STAR — "Rising Stars" community looks
--   The Instagram wall becomes a wall of loyal customers' outfits: each look
--   carries the customer's first name, Instagram handle, city, a quote and the
--   pieces they wear (products). Clicking a look opens Instagram.
-- Idempotent: safe to run several times.
-- =============================================================================

begin;

alter table public.instagram_posts add column if not exists customer_name text;
alter table public.instagram_posts add column if not exists customer_handle text;
alter table public.instagram_posts add column if not exists customer_city text;
alter table public.instagram_posts add column if not exists quote text;
alter table public.instagram_posts add column if not exists product_ids uuid[] not null default '{}';
alter table public.instagram_posts add column if not exists sort_order integer not null default 0;

create index if not exists instagram_posts_order_idx on public.instagram_posts (sort_order, posted_at desc) where is_published;

commit;
