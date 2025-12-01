-- 2076_drop_old_admin_update_venue_metadata.sql
-- Remove legacy 10-arg admin_update_venue_metadata overload; keep the 11-arg version.

SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.admin_update_venue_metadata(
  uuid,
  text,
  text,
  text[],
  text[],
  text,
  text,
  text,
  text,
  text
);
