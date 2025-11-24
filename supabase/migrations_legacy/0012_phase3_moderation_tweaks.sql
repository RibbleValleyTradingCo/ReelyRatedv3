-- Phase 3 moderation tweaks: preserve admin references + report index

----------------------------
-- moderation_log admin reference
----------------------------
ALTER TABLE public.moderation_log
    DROP CONSTRAINT IF EXISTS moderation_log_admin_id_fkey;

ALTER TABLE public.moderation_log
    ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.moderation_log
    ADD CONSTRAINT moderation_log_admin_id_fkey
        FOREIGN KEY (admin_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL;

----------------------------
-- user_warnings issued_by reference
----------------------------
ALTER TABLE public.user_warnings
    DROP CONSTRAINT IF EXISTS user_warnings_issued_by_fkey;

ALTER TABLE public.user_warnings
    ALTER COLUMN issued_by DROP NOT NULL;

ALTER TABLE public.user_warnings
    ADD CONSTRAINT user_warnings_issued_by_fkey
        FOREIGN KEY (issued_by)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL;

----------------------------
-- reports reporter index for "my reports" queries
----------------------------
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
    ON public.reports (reporter_id, created_at DESC);

-- Summary: make admin references nullable with ON DELETE SET NULL and add reports index
