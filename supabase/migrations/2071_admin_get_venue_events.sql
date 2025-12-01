-- 2071_admin_get_venue_events.sql
-- Recreate admin_get_venue_events function for admin event listing (draft + published).

SET search_path = public, extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_get_venue_events'
      AND n.nspname = 'public'
      AND p.pronargs = 1
  ) THEN
    DROP FUNCTION public.admin_get_venue_events(uuid);
  END IF;
END;
$$;

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

COMMENT ON FUNCTION public.admin_get_venue_events(uuid) IS 'Admin-only list of all events (draft and published, past and upcoming) for a venue; checks admin_users.';
GRANT EXECUTE ON FUNCTION public.admin_get_venue_events(uuid) TO authenticated;
