-- 2016_phase1_admin_visibility.sql
-- Purpose: Phase 1A – Admin detection + visibility overrides.
-- Addresses: BUG-ADMIN-DETECTION (admin menu missing, admin cannot see non-public catches or moderation data).

SET search_path = public, extensions;

-- Helper to check admin status centrally.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = p_user_id
  );
$$;

-- admin_users: allow a user to see their own admin row (for UI detection).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_users_self_select'
  ) THEN
    CREATE POLICY admin_users_self_select ON public.admin_users
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- catches: admin can read all (including private and soft-deleted).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'catches_admin_read_all'
  ) THEN
    CREATE POLICY catches_admin_read_all ON public.catches
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- catch_comments: admin can read all (including deleted).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_admin_read_all'
  ) THEN
    CREATE POLICY catch_comments_admin_read_all ON public.catch_comments
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- reports: admins can read/update all reports.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reports_admin_all'
  ) THEN
    CREATE POLICY reports_admin_all ON public.reports
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- user_warnings: admin can read all warnings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'user_warnings_admin_read'
  ) THEN
    CREATE POLICY user_warnings_admin_read ON public.user_warnings
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- moderation_log: admin can read audit log.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'moderation_log_admin_read'
  ) THEN
    CREATE POLICY moderation_log_admin_read ON public.moderation_log
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END;
$$;

-- notifications: allow admins to inspect for moderation context (read-only).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_admin_read'
  ) THEN
    CREATE POLICY notifications_admin_read ON public.notifications
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END;
$$;
