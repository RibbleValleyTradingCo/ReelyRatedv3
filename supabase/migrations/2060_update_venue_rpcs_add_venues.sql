-- 2060_update_venue_rpcs_add_venues.sql
-- Update venue RPCs to include structured venue data in results (slug/name), relying on existing RLS.

SET search_path = public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'venue_stats'
      AND n.nspname = 'public'
  ) THEN
    CREATE VIEW public.venue_stats AS
    SELECT
      c.venue_id,
      COUNT(*)::integer AS total_catches,
      COUNT(*) FILTER (WHERE c.created_at >= now() - interval '30 days')::integer AS recent_catches_30d,
      MAX(c.weight) AS headline_pb_weight,
      MAX(c.weight_unit) AS headline_pb_unit,
      MAX(c.species) AS headline_pb_species,
      ARRAY(SELECT DISTINCT c2.species FROM public.catches c2 WHERE c2.venue_id = c.venue_id AND c2.species IS NOT NULL) AS top_species
    FROM public.catches c
    WHERE c.venue_id IS NOT NULL
    GROUP BY c.venue_id;
  END IF;
END
$$;

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

-- Extend get_venues and get_venue_by_slug to include venue metadata and stats (Phase 3.1).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venues'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venues(text, int, int);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venue_by_slug'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venue_by_slug(text);
  END IF;
END;
$$;

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
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz,
  short_tagline text,
  ticket_type text,
  price_from text,
  best_for_tags text[],
  facilities text[],
  total_catches integer,
  recent_catches_30d integer,
  headline_pb_weight numeric,
  headline_pb_unit public.weight_unit,
  headline_pb_species text,
  top_species text[]
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    v.id,
    v.slug,
    v.name,
    v.location,
    v.description,
    v.is_published,
    v.created_at,
    v.updated_at,
    v.short_tagline,
    v.ticket_type,
    v.price_from,
    v.best_for_tags,
    v.facilities,
    vs.total_catches,
    vs.recent_catches_30d,
    vs.headline_pb_weight,
    vs.headline_pb_unit,
    vs.headline_pb_species,
    vs.top_species
  FROM public.venues v
  LEFT JOIN public.venue_stats vs ON vs.venue_id = v.id
  WHERE (p_search IS NULL OR v.name ILIKE '%' || p_search || '%' OR v.location ILIKE '%' || p_search || '%')
  ORDER BY v.name ASC
  LIMIT LEAST(COALESCE(p_limit, 20), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_venue_by_slug(
  p_slug text
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  location text,
  description text,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz,
  short_tagline text,
  ticket_type text,
  price_from text,
  best_for_tags text[],
  facilities text[],
  website_url text,
  booking_url text,
  contact_phone text,
  notes_for_rr_team text,
  total_catches integer,
  recent_catches_30d integer,
  headline_pb_weight numeric,
  headline_pb_unit public.weight_unit,
  headline_pb_species text,
  top_species text[]
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    v.id,
    v.slug,
    v.name,
    v.location,
    v.description,
    v.is_published,
    v.created_at,
    v.updated_at,
    v.short_tagline,
    v.ticket_type,
    v.price_from,
    v.best_for_tags,
    v.facilities,
    v.website_url,
    v.booking_url,
    v.contact_phone,
    v.notes_for_rr_team,
    vs.total_catches,
    vs.recent_catches_30d,
    vs.headline_pb_weight,
    vs.headline_pb_unit,
    vs.headline_pb_species,
    vs.top_species
  FROM public.venues v
  LEFT JOIN public.venue_stats vs ON vs.venue_id = v.id
  WHERE v.slug = p_slug
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_venues(text, int, int) IS 'List venues with metadata and aggregate stats for cards (Phase 3.1).';
COMMENT ON FUNCTION public.get_venue_by_slug(text) IS 'Get a single venue by slug with metadata and aggregate stats (Phase 3.1).';
GRANT EXECUTE ON FUNCTION public.get_venues(text, int, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_by_slug(text) TO authenticated, anon;
