-- 2075_admin_update_venue_metadata_description.sql
-- Align admin metadata RPC with owner path by adding description support.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.admin_update_venue_metadata(
  p_venue_id uuid,
  p_short_tagline text,
  p_description text,
  p_ticket_type text,
  p_price_from text,
  p_best_for_tags text[],
  p_facilities text[],
  p_website_url text,
  p_booking_url text,
  p_contact_phone text,
  p_notes_for_rr_team text
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

  UPDATE public.venues
  SET
    short_tagline      = p_short_tagline,
    description        = p_description,
    ticket_type        = p_ticket_type,
    price_from         = p_price_from,
    best_for_tags      = p_best_for_tags,
    facilities         = p_facilities,
    website_url        = p_website_url,
    booking_url        = p_booking_url,
    contact_phone      = p_contact_phone,
    notes_for_rr_team  = p_notes_for_rr_team,
    updated_at         = now()
  WHERE id = p_venue_id;
END;
$$;

COMMENT ON FUNCTION public.admin_update_venue_metadata(uuid, text, text, text, text, text[], text[], text, text, text, text) IS
  'Admin-only RPC to update venue metadata fields (short_tagline, description, ticket_type, price, tags, facilities, URLs, contact, notes). Checks admin_users internally.';
GRANT EXECUTE ON FUNCTION public.admin_update_venue_metadata(uuid, text, text, text, text, text[], text[], text, text, text, text) TO authenticated;
