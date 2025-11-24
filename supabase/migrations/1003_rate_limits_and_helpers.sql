-- 1003_rate_limits_and_helpers.sql
-- Covers: rate_limits table, helper functions, enforcement triggers (matches MAIN).

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_created
  ON public.rate_limits (user_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - make_interval(mins => p_window_minutes);
  attempts INTEGER;
BEGIN
  SELECT count(*) INTO attempts
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= cutoff;

  RETURN attempts < p_max_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rate_limit_status(
  p_user_id UUID,
  p_action TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  used INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - make_interval(mins => p_window_minutes);
BEGIN
  RETURN QUERY
  WITH attempts AS (
    SELECT count(*) AS used
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at >= cutoff
  )
  SELECT
    (p_max_attempts - used) > 0 AS allowed,
    used,
    GREATEST(p_max_attempts - used, 0) AS remaining,
    cutoff + make_interval(mins => p_window_minutes) AS reset_at
  FROM attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_rate_limits()
RETURNS TABLE (
  action TEXT,
  count INTEGER,
  oldest_attempt TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT action, count(*), MIN(created_at)
  FROM public.rate_limits
  GROUP BY action;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '2 days'
  RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

-- Enforcement triggers
CREATE OR REPLACE FUNCTION public.enforce_catch_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT check_rate_limit(auth.uid(), 'catches', 10, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: catches – max 10 per hour';
  END IF;
  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (auth.uid(), 'catches', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT check_rate_limit(auth.uid(), 'comments', 20, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
  END IF;
  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (auth.uid(), 'comments', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT check_rate_limit(auth.uid(), 'reports', 5, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: reports – max 5 per hour';
  END IF;
  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (auth.uid(), 'reports', now());
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_catch_rate_limit_trigger') THEN
    CREATE TRIGGER enforce_catch_rate_limit_trigger
    BEFORE INSERT ON public.catches
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_catch_rate_limit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_comment_rate_limit_trigger') THEN
    CREATE TRIGGER enforce_comment_rate_limit_trigger
    BEFORE INSERT ON public.catch_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_comment_rate_limit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_report_rate_limit_trigger') THEN
    CREATE TRIGGER enforce_report_rate_limit_trigger
    BEFORE INSERT ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_report_rate_limit();
  END IF;
END;
$$;
