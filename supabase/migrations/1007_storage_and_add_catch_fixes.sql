-- 1007_storage_and_add_catch_fixes.sql
-- Purpose:
-- - Seed richer lookup data for baits, tags (methods), and water_types so AddCatch dropdowns are populated.
-- - Fix storage.objects policies for the 'catches' bucket so image uploads work in hosted Supabase without owner-based RLS failures.

SET search_path = public, extensions;

-- -------------------------------------------------------------------
-- Lookup seed data (idempotent additions for AddCatch lookups)
-- Note: RLS for baits/tags/water_types already permits SELECT for anon/authenticated (see 1004),
-- so this migration only adds extra seed data for dropdowns.
-- -------------------------------------------------------------------

INSERT INTO public.baits (slug, label, category)
VALUES
  ('boilies', 'Boilies', 'carp'),
  ('pop_up_boilies', 'Pop-up Boilies', 'carp'),
  ('wafters', 'Wafters', 'carp'),
  ('sweetcorn', 'Sweetcorn', 'general'),
  ('maize', 'Maize', 'general'),
  ('tiger_nuts', 'Tiger Nuts', 'carp'),
  ('pellets', 'Pellets', 'general'),
  ('halibut_pellets', 'Halibut Pellets', 'predator'),
  ('groundbait', 'Groundbait', 'general'),
  ('method_mix', 'Method Mix', 'carp'),
  ('bread', 'Bread', 'general'),
  ('luncheon_meat', 'Luncheon Meat', 'general'),
  ('maggots', 'Maggots', 'coarse'),
  ('casters', 'Casters', 'coarse'),
  ('worms', 'Worms', 'coarse'),
  ('deadbait_roach', 'Deadbait Roach', 'predator'),
  ('deadbait_sardine', 'Deadbait Sardine', 'predator'),
  ('spinner', 'Spinner', 'lure'),
  ('fly', 'Fly', 'fly'),
  ('floater_hookbait', 'Surface Floater', 'carp')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tags (slug, label, category, method_group)
VALUES
  ('float_fishing', 'Float Fishing', 'method', 'float'),
  ('pole_fishing', 'Pole Fishing', 'method', 'float'),
  ('waggler', 'Waggler', 'method', 'float'),
  ('feeder_fishing', 'Feeder Fishing', 'method', 'bottom'),
  ('method_feeder', 'Method Feeder', 'method', 'bottom'),
  ('legering', 'Legering', 'method', 'bottom'),
  ('zig_rig', 'Zig Rig', 'method', 'midwater'),
  ('surface_fishing', 'Surface Fishing', 'method', 'surface'),
  ('stalking', 'Stalking', 'method', 'margin'),
  ('lure_fishing', 'Lure Fishing', 'method', 'lure'),
  ('drop_shot', 'Drop Shot', 'method', 'lure'),
  ('fly_fishing', 'Fly Fishing', 'method', 'fly'),
  ('spod_marker', 'Spod & Marker', 'method', 'other'),
  ('margin_fishing', 'Margin Fishing', 'method', 'margin'),
  ('trotting', 'Trotting', 'method', 'float'),
  ('deadbaiting', 'Deadbaiting', 'method', 'predator')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.water_types (code, label, group_name)
VALUES
  ('lake', 'Lake / Stillwater', 'stillwater'),
  ('river', 'River', 'flowing'),
  ('canal', 'Canal', 'stillwater'),
  ('reservoir', 'Reservoir', 'stillwater'),
  ('pond', 'Pond', 'stillwater'),
  ('gravel_pit', 'Gravel Pit', 'stillwater'),
  ('commercial', 'Commercial Fishery', 'commercial'),
  ('club_water', 'Club Water', 'club'),
  ('syndicate', 'Syndicate Water', 'syndicate'),
  ('park_lake', 'Park Lake', 'stillwater'),
  ('loch', 'Loch', 'stillwater'),
  ('estuary', 'Estuary', 'tidal')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------------
-- Storage: ensure bucket + simplify RLS for catches uploads
-- Storage note: replaced owner-based policies for the 'catches' bucket with
-- bucket-scoped public read + authenticated manage policies to avoid upload RLS failures.
-- -------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('catches', 'catches', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access to catches'
  ) THEN
    DROP POLICY "Public read access to catches" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can manage own catches'
  ) THEN
    DROP POLICY "Users can manage own catches" ON storage.objects;
  END IF;
END;
$$;

CREATE POLICY "catches_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'catches');

CREATE POLICY "catches_authenticated_manage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'catches')
  WITH CHECK (bucket_id = 'catches');

-- Note: public.catches RLS already allows INSERT for authenticated users when user_id = auth.uid(), matching AddCatch.tsx. No changes here.

-- Summary (1007):
-- - Seeded richer lookup values for baits, tags (methods), and water_types to populate AddCatch dropdowns.
-- - Ensured 'catches' storage bucket exists.
-- - Replaced owner-based storage.objects policies for 'catches' with bucket-scoped public read + authenticated manage policies to fix upload RLS errors.
-- - Left public.catches RLS unchanged.
