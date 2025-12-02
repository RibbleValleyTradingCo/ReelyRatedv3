-- 2057_venue_rpcs.sql
-- Read-only venue RPCs (see docs/VENUE-PAGES-DESIGN.md / VENUE-PAGES-ROADMAP.md)

SET search_path = public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'weight_unit'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.weight_unit AS ENUM ('kg', 'lb_oz');
  END IF;
END
$$;

-- List venues (published only)
CREATE OR REPLACE FUNCTION public.get_venues(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  location text,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit int := LEAST(COALESCE(p_limit, 20), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(TRIM(COALESCE(p_search, '')), '');
BEGIN
  RETURN QUERY
  SELECT v.id, v.slug, v.name, v.location, v.description, v.created_at, v.updated_at
  FROM public.venues v
  WHERE v.is_published = TRUE
    AND (
      v_search IS NULL
      OR v.name ILIKE '%' || v_search || '%'
      OR v.location ILIKE '%' || v_search || '%'
    )
  ORDER BY v.name ASC, v.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_venues(text, int, int) IS 'List published venues (search + pagination). See docs/VENUE-PAGES-DESIGN.md.';
GRANT EXECUTE ON FUNCTION public.get_venues(text, int, int) TO authenticated;

-- Fetch a venue by slug (published only)
CREATE OR REPLACE FUNCTION public.get_venue_by_slug(
  p_slug text
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  location text,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.slug, v.name, v.location, v.description, v.created_at, v.updated_at
  FROM public.venues v
  WHERE v.is_published = TRUE
    AND v.slug = p_slug
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_venue_by_slug(text) IS 'Fetch a single published venue by slug. See docs/VENUE-PAGES-DESIGN.md.';
GRANT EXECUTE ON FUNCTION public.get_venue_by_slug(text) TO authenticated;

-- Recent catches for a venue (privacy enforced by RLS)
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
  reactions jsonb
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
    ) AS reactions
  FROM public.catches c
  WHERE c.venue_id = p_venue_id
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_venue_recent_catches(uuid, int, int) IS 'Recent catches for a venue (privacy enforced by RLS). See docs/VENUE-PAGES-DESIGN.md.';
GRANT EXECUTE ON FUNCTION public.get_venue_recent_catches(uuid, int, int) TO authenticated;

-- Top catches for a venue (privacy enforced by RLS)
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
  reactions jsonb
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
    ) AS reactions
  FROM public.catches c
  WHERE c.venue_id = p_venue_id
    AND c.deleted_at IS NULL
  ORDER BY c.weight DESC NULLS LAST, c.created_at DESC
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.get_venue_top_catches(uuid, int) IS 'Top catches for a venue (weight-first), privacy via RLS. See docs/VENUE-PAGES-DESIGN.md.';
GRANT EXECUTE ON FUNCTION public.get_venue_top_catches(uuid, int) TO authenticated;
