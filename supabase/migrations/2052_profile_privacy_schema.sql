-- 2052_profile_privacy_schema.sql
-- Adds profile privacy flag (is_private) per docs/FEATURE-ROADMAP.md Phase 2.2

SET search_path = public, extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_private IS 'Profile privacy flag (private vs public) — see docs/FEATURE-ROADMAP.md Phase 2.2.';

CREATE INDEX IF NOT EXISTS idx_profiles_is_private ON public.profiles (is_private);
