-- Fix ambiguity in upsert_venue_rating by qualifying venue_id references
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.upsert_venue_rating(
  p_venue_id uuid,
  p_rating int
)
RETURNS TABLE (
  venue_id uuid,
  avg_rating numeric,
  rating_count int,
  user_rating int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING: rating must be between 1 and 5';
  END IF;

  INSERT INTO public.venue_ratings AS vr (venue_id, user_id, rating)
  VALUES (p_venue_id, v_user_id, p_rating)
  ON CONFLICT (venue_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating,
               updated_at = now();

  SELECT
    vr.venue_id,
    avg(vr.rating)::numeric(3,2) AS avg_rating,
    count(*)::int                 AS rating_count
  INTO
    upsert_venue_rating.venue_id,
    upsert_venue_rating.avg_rating,
    upsert_venue_rating.rating_count
  FROM public.venue_ratings vr
  WHERE vr.venue_id = p_venue_id;

  SELECT vr.rating::int
  INTO upsert_venue_rating.user_rating
  FROM public.venue_ratings vr
  WHERE vr.venue_id = p_venue_id
    AND vr.user_id = v_user_id
  LIMIT 1;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_venue_rating(uuid, int) TO authenticated;
