-- 2060_update_venue_rpcs_add_venues.sql
-- Update venue RPCs to include structured venue data in results (slug/name), relying on existing RLS.

SET search_path = public, extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venue_recent_catches'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venue_recent_catches(uuid, int, int);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venue_top_catches'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venue_top_catches(uuid, int);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_venue_recent_catches(
  p_venue_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  user_id uuid,
  location text,
  species text,
  weight numeric,
  weight_unit public.weight_unit,
  visibility public.visibility_type,
  hide_exact_spot boolean,
  conditions jsonb,
  created_at timestamptz,
  profiles jsonb,
  ratings jsonb,
  comments jsonb,
  reactions jsonb,
  venues jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit int := LEAST(COALESCE(p_limit, 20), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.image_url,
    c.user_id,
    c.location,
    c.species,
    c.weight,
    c.weight_unit,
    c.visibility,
    c.hide_exact_spot,
    c.conditions,
    c.created_at,
    (
      SELECT to_jsonb(p_sub.*)
      FROM (
        SELECT p.username, p.avatar_path, p.avatar_url
        FROM public.profiles p
        WHERE p.id = c.user_id
      ) AS p_sub
    ) AS profiles,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('rating', r.rating)), '[]'::jsonb)
      FROM public.ratings r
      WHERE r.catch_id = c.id
    ) AS ratings,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', cc.id)), '[]'::jsonb)
      FROM public.catch_comments cc
      WHERE cc.catch_id = c.id AND cc.deleted_at IS NULL
    ) AS comments,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', cr.user_id)), '[]'::jsonb)
      FROM public.catch_reactions cr
      WHERE cr.catch_id = c.id
    ) AS reactions,
    (
      SELECT to_jsonb(v_sub.*)
      FROM (
        SELECT v.id, v.slug, v.name
        FROM public.venues v
        WHERE v.id = c.venue_id
      ) AS v_sub
    ) AS venues
  FROM public.catches c
  WHERE c.venue_id = p_venue_id
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_venue_top_catches(
  p_venue_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  user_id uuid,
  location text,
  species text,
  weight numeric,
  weight_unit public.weight_unit,
  visibility public.visibility_type,
  hide_exact_spot boolean,
  conditions jsonb,
  created_at timestamptz,
  profiles jsonb,
  ratings jsonb,
  comments jsonb,
  reactions jsonb,
  venues jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit int := LEAST(COALESCE(p_limit, 10), 100);
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.image_url,
    c.user_id,
    c.location,
    c.species,
    c.weight,
    c.weight_unit,
    c.visibility,
    c.hide_exact_spot,
    c.conditions,
    c.created_at,
    (
      SELECT to_jsonb(p_sub.*)
      FROM (
        SELECT p.username, p.avatar_path, p.avatar_url
        FROM public.profiles p
        WHERE p.id = c.user_id
      ) AS p_sub
    ) AS profiles,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('rating', r.rating)), '[]'::jsonb)
      FROM public.ratings r
      WHERE r.catch_id = c.id
    ) AS ratings,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', cc.id)), '[]'::jsonb)
      FROM public.catch_comments cc
      WHERE cc.catch_id = c.id AND cc.deleted_at IS NULL
    ) AS comments,
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', cr.user_id)), '[]'::jsonb)
      FROM public.catch_reactions cr
      WHERE cr.catch_id = c.id
    ) AS reactions,
    (
      SELECT to_jsonb(v_sub.*)
      FROM (
        SELECT v.id, v.slug, v.name
        FROM public.venues v
        WHERE v.id = c.venue_id
      ) AS v_sub
    ) AS venues
  FROM public.catches c
  WHERE c.venue_id = p_venue_id
    AND c.deleted_at IS NULL
  ORDER BY c.weight DESC NULLS LAST, c.created_at DESC
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.get_venue_recent_catches(uuid, int, int) IS 'Recent catches for a venue (privacy enforced by RLS). Includes venue metadata. See docs/VENUE-PAGES-DESIGN.md.';
COMMENT ON FUNCTION public.get_venue_top_catches(uuid, int) IS 'Top catches for a venue (weight-first), privacy via RLS. Includes venue metadata. See docs/VENUE-PAGES-DESIGN.md.';
