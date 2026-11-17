-- =============================================================================
-- THE RISING STAR — photos per colour
--   * product_media.color: the colour a photo shows (one of products.colors).
--     Choosing that colour on the product page shows its photos. Null = a
--     photo shared by every colour (size chart, detail…).
-- Idempotent: safe to run several times.
-- =============================================================================

alter table public.product_media add column if not exists color text;
