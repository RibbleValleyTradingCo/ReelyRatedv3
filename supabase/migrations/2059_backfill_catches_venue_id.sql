-- 2059_backfill_catches_venue_id.sql
-- Backfill venue_id on catches where location matches seeded venues (root cause: previous catches only stored free-text venue)

SET search_path = public, extensions;

UPDATE public.catches c
SET venue_id = v.id
FROM public.venues v
WHERE c.venue_id IS NULL
  AND c.location IS NOT NULL
  AND lower(trim(c.location)) = lower(trim(v.name));
