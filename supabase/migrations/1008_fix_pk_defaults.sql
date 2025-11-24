-- 1008_fix_pk_defaults.sql
-- Align hosted DB primary key defaults for catches and sessions with ERD/frontend expectations (UUID + gen_random_uuid()).

SET search_path = public, extensions;

-- Ensure catches.id uses UUID with a default gen_random_uuid() and is NOT NULL
ALTER TABLE public.catches
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Ensure sessions.id uses UUID with a default gen_random_uuid() and is NOT NULL
ALTER TABLE public.sessions
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;
