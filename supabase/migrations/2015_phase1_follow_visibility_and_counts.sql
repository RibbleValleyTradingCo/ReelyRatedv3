-- 2015_phase1_follow_visibility_and_counts.sql
-- Purpose: Phase 1 fixes for follower visibility and follower counts.
-- Addresses: BUG-FOLLOWERS-VISIBILITY, BUG-FOLLOWER-COUNT-DESYNC.

SET search_path = public, extensions;

-- Helper: check if a user follows another.
CREATE OR REPLACE FUNCTION public.is_following(p_follower uuid, p_following uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_follows pf
    WHERE pf.follower_id = p_follower
      AND pf.following_id = p_following
  );
$$;

-- RLS: allow followers to read follower-only catches (owner policy remains in place for self/private).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'catches_followers_read'
  ) THEN
    CREATE POLICY catches_followers_read ON public.catches
      FOR SELECT
      USING (
        deleted_at IS NULL
        AND visibility = 'followers'
        AND auth.uid() IS NOT NULL
        AND public.is_following(auth.uid(), user_id)
      );
  END IF;
END;
$$;

-- RLS: allow users to SELECT follow rows where they are the follower or the followed (for counts/lists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profile_follows_select_related'
  ) THEN
    CREATE POLICY profile_follows_select_related ON public.profile_follows
      FOR SELECT
      USING (auth.uid() = follower_id OR auth.uid() = following_id);
  END IF;
END;
$$;

-- Helper: follower count RPC (bypasses RLS to return accurate counts for any viewer).
CREATE OR REPLACE FUNCTION public.get_follower_count(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.profile_follows pf
  WHERE pf.following_id = p_profile_id;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_follower_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_follower_count(uuid) TO anon;
