-- 1001_core_schema.sql
-- Covers: base tables and helpers from phase 1 (phase1_migration.sql / full-main-dump)
--         handle_new_user trigger, updated_at helpers.

-- Extensions (idempotent)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "citext"       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_graphql"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA extensions;

SET search_path = public, extensions;

-- Enum types used by catches
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weight_unit') THEN
    CREATE TYPE weight_unit AS ENUM ('lb_oz', 'kg', 'g');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'length_unit') THEN
    CREATE TYPE length_unit AS ENUM ('cm', 'in');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_type') THEN
    CREATE TYPE visibility_type AS ENUM ('public', 'followers', 'private');
  END IF;
END;
$$;

-- Base tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  bio TEXT,
  avatar_path TEXT,
  avatar_url TEXT,
  location TEXT,
  website TEXT,
  status TEXT,
  warn_count INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'normal',
  suspension_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30)
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  venue TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON public.sessions (user_id, date);

CREATE TABLE IF NOT EXISTS public.catches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  location TEXT,
  location_label TEXT,
  title TEXT NOT NULL,
  description TEXT,
  species TEXT,
  species_slug TEXT,
  weight NUMERIC,
  weight_unit weight_unit,
  length NUMERIC,
  length_unit length_unit,
  time_of_day TEXT,
  peg_or_swim TEXT,
  conditions JSONB,
  water_type TEXT,
  water_type_code TEXT,
  hide_exact_spot BOOLEAN NOT NULL DEFAULT false,
  bait_used TEXT,
  method TEXT,
  method_tag TEXT,
  equipment_used TEXT,
  image_url TEXT NOT NULL,
  gallery_photos TEXT[],
  video_url TEXT,
  visibility visibility_type NOT NULL DEFAULT 'public',
  allow_ratings BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[],
  caught_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_catches_weight_positive CHECK (weight IS NULL OR weight > 0),
  CONSTRAINT chk_catches_length_positive CHECK (length IS NULL OR length > 0)
);
CREATE INDEX IF NOT EXISTS idx_catches_user_id ON public.catches (user_id);
CREATE INDEX IF NOT EXISTS idx_catches_session_id ON public.catches (session_id);
CREATE INDEX IF NOT EXISTS idx_catches_created_deleted_visibility ON public.catches (created_at, deleted_at, visibility);

-- Ensure additional columns exist (safety for running on existing DBs)
ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS species_slug TEXT,
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS method_tag TEXT,
  ADD COLUMN IF NOT EXISTS water_type_code TEXT,
  ADD COLUMN IF NOT EXISTS caught_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.baits (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  method_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.water_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed lookup tables (idempotent defaults for fresh environments)
INSERT INTO public.baits (slug, label, category)
VALUES
  ('boilies', 'Boilies', 'general'),
  ('corn', 'Sweetcorn', 'general'),
  ('pellets', 'Pellets', 'general'),
  ('maggots', 'Maggots', 'general')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tags (slug, label, category, method_group)
VALUES
  ('float', 'Float', 'method', 'float'),
  ('ledger', 'Ledger', 'method', 'bottom'),
  ('surface', 'Surface', 'method', 'surface'),
  ('zig', 'Zig', 'method', 'midwater')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.water_types (code, label, group_name)
VALUES
  ('lake', 'Lake / Stillwater', 'stillwater'),
  ('river', 'River', 'flowing'),
  ('canal', 'Canal', 'stillwater')
ON CONFLICT (code) DO NOTHING;

-- updated_at helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_set_updated_at') THEN
    CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_set_updated_at') THEN
    CREATE TRIGGER trg_sessions_set_updated_at BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catches_set_updated_at') THEN
    CREATE TRIGGER trg_catches_set_updated_at BEFORE UPDATE ON public.catches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- handle_new_user trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_username TEXT;
  cleaned_username TEXT;
  final_username TEXT;
  suffix_counter INTEGER := 0;
  max_length CONSTANT INTEGER := 30;
  min_length CONSTANT INTEGER := 3;
BEGIN
  IF NEW.email IS NOT NULL THEN
    base_username := split_part(lower(NEW.email), '@', 1);
  END IF;
  IF base_username IS NULL OR length(base_username) < min_length THEN
    base_username := 'angler';
  END IF;
  cleaned_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  IF length(cleaned_username) < min_length THEN
    cleaned_username := cleaned_username || substring(NEW.id::text, 1, min_length - length(cleaned_username));
  END IF;
  cleaned_username := left(cleaned_username, max_length);
  final_username := cleaned_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix_counter := suffix_counter + 1;
    final_username :=
      left(cleaned_username, max_length - 5) || '_' ||
      substring(md5(NEW.id::text || suffix_counter::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Ensure UUID defaults for IDs even if tables already exist
ALTER TABLE public.catches
  ALTER COLUMN id SET DATA TYPE uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.sessions
  ALTER COLUMN id SET DATA TYPE uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;
