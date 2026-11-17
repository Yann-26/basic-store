-- =============================================================================
-- Real-time 3D: a piece can have a GLB model, shown on its page and turned by
-- the visitor; its colours switch the model's look.
--
--   * products.model_3d: the model's URL and how the shop shows it (colour
--     looks, detail points, starting angle). Null: no 3D.
--   * storage bucket "models": the GLB files, uploaded by the back-office
--     straight to Storage with a one-time signed URL issued by the API
--     (a model is bigger than what a serverless request accepts).
-- Idempotent.
-- =============================================================================
alter table public.products
  add column if not exists model_3d jsonb;

comment on column public.products.model_3d is 'Real-time 3D model (GLB URL in the models bucket) and its display settings; null without 3D.';

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('models', 'models', true, 31457280, array['model/gltf-binary', 'application/octet-stream'])
    on conflict (id) do update
      set public = true, file_size_limit = 31457280, allowed_mime_types = array['model/gltf-binary', 'application/octet-stream'];
  end if;
end $$;
