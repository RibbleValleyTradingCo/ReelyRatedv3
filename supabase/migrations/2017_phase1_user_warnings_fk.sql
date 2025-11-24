-- 2017_phase1_user_warnings_fk.sql
-- Purpose: Restore issued_by on user_warnings and add FK to profiles for admin nested select.

SET search_path = public, extensions;

-- Ensure issued_by column exists.
ALTER TABLE public.user_warnings
  ADD COLUMN IF NOT EXISTS issued_by uuid;

-- Backfill issued_by from legacy admin_id where missing.
UPDATE public.user_warnings
SET issued_by = admin_id
WHERE issued_by IS NULL;

-- Add FK to profiles(id) if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_warnings_issued_by_fkey'
      AND conrelid = 'public.user_warnings'::regclass
  ) THEN
    ALTER TABLE public.user_warnings
      ADD CONSTRAINT user_warnings_issued_by_fkey
      FOREIGN KEY (issued_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;
