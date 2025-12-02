-- Update venue RPCs to include rating aggregates from venue_stats
SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.get_venues(text, int, int);
DROP FUNCTION IF EXISTS public.get_venue_by_slug(text);

CREATE FUNCTION public.get_venues(
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
  top_species text[],
  avg_rating numeric,
  rating_count integer
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
    vs.headline_pb_unit::public.weight_unit,
    vs.headline_pb_species,
    vs.top_species,
    vs.avg_rating,
    vs.rating_count
  FROM public.venues v
  LEFT JOIN public.venue_stats vs ON vs.venue_id = v.id
  WHERE (p_search IS NULL OR v.name ILIKE '%' || p_search || '%' OR v.location ILIKE '%' || p_search || '%')
  ORDER BY v.name ASC
  LIMIT LEAST(COALESCE(p_limit, 20), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE FUNCTION public.get_venue_by_slug(
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
  top_species text[],
  avg_rating numeric,
  rating_count integer
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
    vs.headline_pb_unit::public.weight_unit,
    vs.headline_pb_species,
    vs.top_species,
    vs.avg_rating,
    vs.rating_count
  FROM public.venues v
  LEFT JOIN public.venue_stats vs ON vs.venue_id = v.id
  WHERE v.slug = p_slug
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_venues(text, int, int) IS 'List venues with metadata and aggregate stats for cards.';
COMMENT ON FUNCTION public.get_venue_by_slug(text) IS 'Get a single venue by slug with metadata and aggregate stats.';
GRANT EXECUTE ON FUNCTION public.get_venues(text, int, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_by_slug(text) TO authenticated, anon;
