-- 1005_views_indexes_and_hardening.sql
-- Covers: leaderboard view and final hardening passes.

SET search_path = public, extensions;

-- Leaderboard view (matches live definition)
CREATE OR REPLACE VIEW public.leaderboard_scores_detailed AS
SELECT
  c.id,
  c.user_id,
  p.username AS owner_username,
  c.title,
  COALESCE(c.species_slug, c.species) AS species_slug,
  c.species AS species,
  c.weight,
  c.weight_unit,
  c.length,
  c.length_unit,
  c.image_url,
  COALESCE(AVG(r.rating), 0)::numeric AS avg_rating,
  COUNT(r.id)::integer AS rating_count,
  (COALESCE(AVG(r.rating), 0)::numeric * 10 + COALESCE(c.weight, 0)::numeric) AS total_score,
  c.created_at,
  COALESCE(c.location_label, c.location) AS location_label,
  c.location AS location,
  COALESCE(c.method_tag, c.method) AS method_tag,
  c.method AS method,
  c.water_type_code,
  c.description,
  c.gallery_photos,
  c.tags,
  c.video_url,
  c.conditions,
  c.caught_at
FROM public.catches c
LEFT JOIN public.profiles p ON p.id = c.user_id
LEFT JOIN public.ratings r ON r.catch_id = c.id
WHERE c.deleted_at IS NULL
  AND c.visibility = 'public'
GROUP BY
  c.id,
  c.user_id,
  p.username,
  c.title,
  c.species_slug,
  c.species,
  c.weight,
  c.weight_unit,
  c.length,
  c.length_unit,
  c.image_url,
  c.created_at,
  c.location_label,
  c.location,
  c.method_tag,
  c.method,
  c.water_type_code,
  c.description,
  c.gallery_photos,
  c.tags,
  c.video_url,
  c.conditions,
  c.caught_at;

GRANT SELECT ON public.leaderboard_scores_detailed TO anon, authenticated;

-- Additional hardening: ensure helper functions have explicit search_path
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS regproc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at','update_updated_at_column','set_normalized_location',
        'refresh_leaderboard','check_rate_limit','get_rate_limit_status',
        'user_rate_limits','cleanup_rate_limits',
        'enforce_catch_rate_limit','enforce_comment_rate_limit','enforce_report_rate_limit',
        'handle_new_user'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn.regproc);
  END LOOP;
END;
$$;
