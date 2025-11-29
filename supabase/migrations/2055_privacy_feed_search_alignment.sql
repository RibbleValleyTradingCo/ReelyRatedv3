-- 2055_privacy_feed_search_alignment.sql
-- Align feed/search/comment visibility with profile privacy by removing legacy select policies that bypass is_private.
-- See docs/PROFILE-PRIVACY-DESIGN.md and Phase 2.2 in docs/FEATURE-ROADMAP.md

SET search_path = public, extensions;

-- Remove legacy catch SELECT policies that ignore profile privacy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catches_select_viewable' AND tablename = 'catches') THEN
    DROP POLICY catches_select_viewable ON public.catches;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catches_followers_read' AND tablename = 'catches') THEN
    DROP POLICY catches_followers_read ON public.catches;
  END IF;
END;
$$;

-- Legacy comment SELECT policies remain limited to admin/owner; primary visibility is enforced via catch_comments_public_read (2054) which mirrors catch visibility + privacy.
