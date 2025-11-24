-- 2010_core_align_with_erd.sql
-- Phase A: Core schema alignment with ERD.md (new fields and triggers only; no RLS/enum changes here).

SET search_path = public, extensions;

-- ------------------------------------------------------------------
-- sessions: add venue_name_manual (nullable) per ERD.md
-- ------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS venue_name_manual TEXT;

-- ------------------------------------------------------------------
-- catches: add custom_species (nullable) per ERD.md
-- ------------------------------------------------------------------
ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS custom_species TEXT;

-- ------------------------------------------------------------------
-- catch_comments: threading + updated_at
-- - parent_comment_id (self-FK)
-- - updated_at with trigger using public.set_updated_at()
-- ------------------------------------------------------------------
ALTER TABLE public.catch_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID;

DO $$
BEGIN
  -- Add FK constraint if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catch_comments_parent_comment_id_fkey'
  ) THEN
    ALTER TABLE public.catch_comments
      ADD CONSTRAINT catch_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES public.catch_comments(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.catch_comments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catch_comments_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_catch_comments_set_updated_at
    BEFORE UPDATE ON public.catch_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ------------------------------------------------------------------
-- notifications: soft delete support
-- ------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ------------------------------------------------------------------
-- user_warnings: add details; note admin_id aligns with ERD issued_by (kept for compatibility)
-- ------------------------------------------------------------------
ALTER TABLE public.user_warnings
  ADD COLUMN IF NOT EXISTS details TEXT;

-- ------------------------------------------------------------------
-- PK defaults sanity note: catches.id and sessions.id are UUID NOT NULL DEFAULT gen_random_uuid()
-- (set in earlier migrations; no change applied here)
-- ------------------------------------------------------------------
