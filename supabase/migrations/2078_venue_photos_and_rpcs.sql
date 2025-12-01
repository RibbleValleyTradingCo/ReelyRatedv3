-- 2078_venue_photos_and_rpcs.sql
-- Venue photos table + admin/owner RPCs.

SET search_path = public, extensions;

CREATE TABLE public.venue_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.venue_photos ENABLE ROW LEVEL SECURITY;

-- Select: allow public for published venues, or admin/owner.
CREATE POLICY venue_photos_select ON public.venue_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.venues v
    WHERE v.id = venue_id
      AND (v.is_published OR public.is_venue_admin_or_owner(v.id))
  )
);

-- Insert: only admins/owners.
CREATE POLICY venue_photos_insert ON public.venue_photos
FOR INSERT
TO authenticated
WITH CHECK (public.is_venue_admin_or_owner(venue_id));

-- Delete: only admins/owners of the venue.
CREATE POLICY venue_photos_delete ON public.venue_photos
FOR DELETE
TO authenticated
USING (public.is_venue_admin_or_owner(venue_id));

GRANT SELECT ON public.venue_photos TO anon, authenticated;
GRANT INSERT, DELETE ON public.venue_photos TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_add_venue_photo(
  p_venue_id uuid,
  p_image_path text,
  p_caption text DEFAULT NULL
)
RETURNS public.venue_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_allowed boolean;
  v_row public.venue_photos;
BEGIN
  v_allowed := public.is_venue_admin_or_owner(p_venue_id);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to add photos for this venue';
  END IF;

  INSERT INTO public.venue_photos (venue_id, image_path, caption, created_by)
  VALUES (p_venue_id, p_image_path, p_caption, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_delete_venue_photo(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  SELECT venue_id INTO v_venue_id FROM public.venue_photos WHERE id = p_id;
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Photo not found';
  END IF;

  IF NOT public.is_venue_admin_or_owner(v_venue_id) THEN
    RAISE EXCEPTION 'Not authorized to delete this photo';
  END IF;

  DELETE FROM public.venue_photos WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_venue_photos(
  p_venue_id uuid,
  p_limit int DEFAULT 12,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.venue_photos
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT *
  FROM public.venue_photos
  WHERE venue_id = p_venue_id
  ORDER BY created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON TABLE public.venue_photos IS 'Photos uploaded by venue owners/admins for venue pages.';
COMMENT ON FUNCTION public.owner_add_venue_photo(uuid, text, text) IS 'Owner/Admin: add a venue photo (stores storage path + optional caption).';
COMMENT ON FUNCTION public.owner_delete_venue_photo(uuid) IS 'Owner/Admin: delete a venue photo if you manage the venue.';
COMMENT ON FUNCTION public.get_venue_photos(uuid, int, int) IS 'Public: list venue photos for a given venue (ordered newest first).';

GRANT EXECUTE ON FUNCTION public.owner_add_venue_photo(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_venue_photo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_photos(uuid, int, int) TO anon, authenticated;
