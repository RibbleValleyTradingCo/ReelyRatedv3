-- 2018_phase1b_ratings.sql
-- Purpose: Phase 1B – Fix ratings scale (1–10), block self-rating, align visibility/allow_ratings in RPC.
-- Addresses: BUG-RATING-SELF, BUG-RATING-FLAKY.

SET search_path = public, extensions;

-- Ensure ratings use a 1–10 integer scale.
ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS ratings_rating_check;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rating_between_1_10 CHECK (rating BETWEEN 1 AND 10);

-- Update rate_catch_with_rate_limit to enforce visibility, self-rating block, and allow_ratings.
CREATE OR REPLACE FUNCTION public.rate_catch_with_rate_limit(
  p_catch_id uuid,
  p_rating int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_catch RECORD;
  v_is_admin boolean := public.is_admin(v_user_id);
  v_is_follower boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, visibility, deleted_at, allow_ratings
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF v_catch.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF v_catch.allow_ratings IS FALSE THEN
    RAISE EXCEPTION 'Ratings are disabled for this catch';
  END IF;

  IF v_catch.user_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot rate your own catch';
  END IF;

  IF NOT v_is_admin THEN
    IF v_catch.visibility = 'public' THEN
      NULL;
    ELSIF v_catch.visibility = 'followers' THEN
      v_is_follower := public.is_following(v_user_id, v_catch.user_id);
      IF NOT v_is_follower THEN
        RAISE EXCEPTION 'Catch is not accessible';
      END IF;
    ELSIF v_catch.visibility = 'private' THEN
      -- Only owner or admin can view; owner already blocked above, so non-admin cannot rate private.
      RAISE EXCEPTION 'Catch is not accessible';
    ELSE
      RAISE EXCEPTION 'Catch is not accessible';
    END IF;
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 10 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 10';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'ratings', 50, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: ratings – max 50 per hour';
  END IF;

  INSERT INTO public.ratings (catch_id, user_id, rating, created_at)
  VALUES (p_catch_id, v_user_id, p_rating, now())
  ON CONFLICT (user_id, catch_id) DO UPDATE
    SET rating = EXCLUDED.rating, created_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'ratings', now());

  RETURN v_id;
END;
$$;
