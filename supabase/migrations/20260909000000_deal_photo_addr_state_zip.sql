-- Deal create/edit: persist City/State/ZIP overrides and the main photo.
-- Live deals table (2026-09-09) had addr_city but no addr_state / addr_zip / photo_url,
-- and no Storage buckets. Apply in the Supabase SQL editor if the CLI is not wired:
-- https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS addr_state text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS addr_zip text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-photos', 'deal-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon read deal photos" ON storage.objects;
DROP POLICY IF EXISTS "anon insert deal photos" ON storage.objects;
DROP POLICY IF EXISTS "anon update deal photos" ON storage.objects;

CREATE POLICY "anon read deal photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'deal-photos');

CREATE POLICY "anon insert deal photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'deal-photos');

CREATE POLICY "anon update deal photos"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'deal-photos')
  WITH CHECK (bucket_id = 'deal-photos');
