-- Core helper functions/triggers present in MAIN but missing from numbered migrations.

SET search_path = public, extensions;

-- Generic updated_at helpers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = COALESCE(NEW.updated_at, now());
  RETURN NEW;
END;
$$;

-- Normalise catch location
CREATE OR REPLACE FUNCTION public.set_normalized_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    NEW.location := NULLIF(lower(NEW.location), '');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catches_normalized_location') THEN
    CREATE TRIGGER trg_catches_normalized_location
    BEFORE INSERT OR UPDATE ON public.catches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_normalized_location();
  END IF;
END;
$$;

-- Leaderboard refresher (matches MAIN intent; no behaviour change)
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'leaderboard_scores_detailed'
  ) THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_scores_detailed';
  END IF;
END;
$$;
