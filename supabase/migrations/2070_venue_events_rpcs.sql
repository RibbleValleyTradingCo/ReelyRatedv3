-- 2070_venue_events_rpcs.sql
-- RPCs for venue events (public read + admin CRUD). See docs/VENUE-PAGES-DESIGN.md §7.

SET search_path = public, extensions;

-- Drop old versions if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venue_upcoming_events'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venue_upcoming_events(uuid, timestamptz, int);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_venue_past_events'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.get_venue_past_events(uuid, timestamptz, int, int);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_create_venue_event'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.admin_create_venue_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_update_venue_event'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.admin_update_venue_event(uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_delete_venue_event'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.admin_delete_venue_event(uuid);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_get_venue_events'
      AND n.nspname = 'public'
  ) THEN
    DROP FUNCTION public.admin_get_venue_events(uuid);
  END IF;
END;
$$;

-- Public read: upcoming events
CREATE OR REPLACE FUNCTION public.get_venue_upcoming_events(
  p_venue_id uuid,
  p_now timestamptz DEFAULT now(),
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  venue_id uuid,
  title text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  ticket_info text,
  website_url text,
  booking_url text,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.venue_id,
    e.title,
    e.event_type,
    e.starts_at,
    e.ends_at,
    e.description,
    e.ticket_info,
    e.website_url,
    e.booking_url,
    e.is_published,
    e.created_at,
    e.updated_at
  FROM public.venue_events e
  WHERE e.venue_id = p_venue_id
    AND e.is_published = true
    AND e.starts_at >= p_now
  ORDER BY e.starts_at ASC
  LIMIT LEAST(COALESCE(p_limit, 10), 50);
$$;

COMMENT ON FUNCTION public.get_venue_upcoming_events(uuid, timestamptz, int) IS 'Published upcoming events for a venue (Phase 3.3). Uses RLS to enforce published-only.';
GRANT EXECUTE ON FUNCTION public.get_venue_upcoming_events(uuid, timestamptz, int) TO authenticated, anon;

-- Public/admin read: past events (published)
CREATE OR REPLACE FUNCTION public.get_venue_past_events(
  p_venue_id uuid,
  p_now timestamptz DEFAULT now(),
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  venue_id uuid,
  title text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  ticket_info text,
  website_url text,
  booking_url text,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.venue_id,
    e.title,
    e.event_type,
    e.starts_at,
    e.ends_at,
    e.description,
    e.ticket_info,
    e.website_url,
    e.booking_url,
    e.is_published,
    e.created_at,
    e.updated_at
  FROM public.venue_events e
  WHERE e.venue_id = p_venue_id
    AND e.is_published = true
    AND e.starts_at < p_now
  ORDER BY e.starts_at DESC
  LIMIT LEAST(COALESCE(p_limit, 10), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_venue_past_events(uuid, timestamptz, int, int) IS 'Published past events for a venue (Phase 3.3). Uses RLS to enforce published-only.';
GRANT EXECUTE ON FUNCTION public.get_venue_past_events(uuid, timestamptz, int, int) TO authenticated, anon;

-- Admin create
CREATE OR REPLACE FUNCTION public.admin_create_venue_event(
  p_venue_id uuid,
  p_title text,
  p_event_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_description text,
  p_ticket_info text,
  p_website_url text,
  p_booking_url text,
  p_is_published boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_user_id uuid := auth.uid();
  v_new_id uuid;
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.venue_events (
    venue_id, title, event_type, starts_at, ends_at, description, ticket_info, website_url, booking_url, is_published
  )
  VALUES (
    p_venue_id, p_title, p_event_type, p_starts_at, p_ends_at, p_description, p_ticket_info, p_website_url, p_booking_url, COALESCE(p_is_published, false)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.admin_create_venue_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean) IS 'Admin-only create for venue events; checks admin_users internally.';
GRANT EXECUTE ON FUNCTION public.admin_create_venue_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean) TO authenticated;

-- Admin update
CREATE OR REPLACE FUNCTION public.admin_update_venue_event(
  p_event_id uuid,
  p_venue_id uuid,
  p_title text,
  p_event_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_description text,
  p_ticket_info text,
  p_website_url text,
  p_booking_url text,
  p_is_published boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_user_id uuid := auth.uid();
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.venue_events
  SET
    venue_id = p_venue_id,
    title = p_title,
    event_type = p_event_type,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    description = p_description,
    ticket_info = p_ticket_info,
    website_url = p_website_url,
    booking_url = p_booking_url,
    is_published = COALESCE(p_is_published, false),
    updated_at = now()
  WHERE id = p_event_id;
END;
$$;

COMMENT ON FUNCTION public.admin_update_venue_event(uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean) IS 'Admin-only update for venue events; checks admin_users internally.';
GRANT EXECUTE ON FUNCTION public.admin_update_venue_event(uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, text, boolean) TO authenticated;

-- Admin delete
CREATE OR REPLACE FUNCTION public.admin_delete_venue_event(
  p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_user_id uuid := auth.uid();
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.venue_events WHERE id = p_event_id;
END;
$$;

COMMENT ON FUNCTION public.admin_delete_venue_event(uuid) IS 'Admin-only delete for venue events; checks admin_users internally.';
GRANT EXECUTE ON FUNCTION public.admin_delete_venue_event(uuid) TO authenticated;

-- Admin list all events (draft + published) for a venue
CREATE OR REPLACE FUNCTION public.admin_get_venue_events(
  p_venue_id uuid
)
RETURNS TABLE (
  id uuid,
  venue_id uuid,
  title text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  ticket_info text,
  website_url text,
  booking_url text,
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.venue_id,
    e.title,
    e.event_type,
    e.starts_at,
    e.ends_at,
    e.description,
    e.ticket_info,
    e.website_url,
    e.booking_url,
    e.is_published,
    e.created_at,
    e.updated_at
  FROM public.venue_events e
  WHERE e.venue_id = p_venue_id
    AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  ORDER BY e.starts_at DESC, e.created_at DESC;
$$;

COMMENT ON FUNCTION public.admin_get_venue_events(uuid) IS 'Admin-only list of all events (draft/published, past/upcoming) for a venue; checks admin_users internally.';
GRANT EXECUTE ON FUNCTION public.admin_get_venue_events(uuid) TO authenticated;
