-- 2056_venues_schema.sql
-- Venue schema groundwork (see docs/VENUE-PAGES-DESIGN.md and docs/VENUE-PAGES-ROADMAP.md)

SET search_path = public, extensions;

-- Venues table
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues (slug);
CREATE INDEX IF NOT EXISTS idx_venues_is_published ON public.venues (is_published);
CREATE INDEX IF NOT EXISTS idx_venues_name ON public.venues (name);

COMMENT ON TABLE public.venues IS 'Venue directory for catches (see docs/VENUE-PAGES-DESIGN.md and docs/VENUE-PAGES-ROADMAP.md).';
COMMENT ON COLUMN public.venues.slug IS 'Slug for /venues/:slug routes.';
COMMENT ON COLUMN public.venues.location IS 'Free-text location; structured fields may follow later.';

-- Link catches to venues (nullable for now)
ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues (id);

CREATE INDEX IF NOT EXISTS idx_catches_venue_created_at ON public.catches (venue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_catches_venue_weight ON public.catches (venue_id, weight);

COMMENT ON COLUMN public.catches.venue_id IS 'Structured venue link; free-text location remains as fallback (see docs/VENUE-PAGES-DESIGN.md).';

-- Future work: RLS alignment and backfill from free-text locations will be handled in later phases.
