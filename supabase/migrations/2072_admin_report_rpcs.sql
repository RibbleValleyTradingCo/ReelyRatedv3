-- Admin report/listing RPCs
set check_function_bodies = off;

-- Drop existing definitions if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'admin_list_reports'
  ) THEN
    DROP FUNCTION public.admin_list_reports(
      p_status text,
      p_type text,
      p_from timestamptz,
      p_to timestamptz,
      p_sort_direction text,
      p_limit int,
      p_offset int
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'admin_update_report_status'
  ) THEN
    DROP FUNCTION public.admin_update_report_status(
      p_report_id uuid,
      p_status text,
      p_resolution_notes text
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'admin_list_moderation_log'
  ) THEN
    DROP FUNCTION public.admin_list_moderation_log(
      p_user_id uuid,
      p_action text,
      p_search text,
      p_from timestamptz,
      p_to timestamptz,
      p_sort_direction text,
      p_limit int,
      p_offset int
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_reports(
  p_status text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_reported_user_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_sort_direction text DEFAULT 'desc',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  details text,
  reporter_id uuid,
  reporter_username text,
  reporter_avatar_path text,
  reporter_avatar_url text,
  reported_user_id uuid,
  reported_username text
) AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    r.details,
    rep.id AS reporter_id,
    rep.username AS reporter_username,
    rep.avatar_path AS reporter_avatar_path,
    rep.avatar_url AS reporter_avatar_url,
    tgt.id AS reported_user_id,
    tgt.username AS reported_username
  FROM public.reports r
  LEFT JOIN public.profiles rep ON rep.id = r.reporter_id
  LEFT JOIN public.catches c ON r.target_type = 'catch' AND r.target_id = c.id
  LEFT JOIN public.catch_comments cc ON r.target_type = 'comment' AND r.target_id = cc.id
  LEFT JOIN public.profiles tgt ON
    (r.target_type = 'profile' AND r.target_id = tgt.id)
    OR (r.target_type = 'catch' AND c.user_id = tgt.id)
    OR (r.target_type = 'comment' AND cc.user_id = tgt.id)
  WHERE (p_status IS NULL OR r.status = p_status)
    AND (p_type IS NULL OR r.target_type = p_type)
    AND (p_reported_user_id IS NULL OR tgt.id = p_reported_user_id)
    AND (p_from IS NULL OR r.created_at >= p_from)
    AND (p_to IS NULL OR r.created_at <= p_to)
  ORDER BY
    CASE WHEN lower(p_sort_direction) = 'asc' THEN r.created_at END ASC,
    CASE WHEN lower(p_sort_direction) <> 'asc' THEN r.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.admin_list_reports(
  p_status text,
  p_type text,
  p_reported_user_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_sort_direction text,
  p_limit int,
  p_offset int
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_report_status(
  p_report_id uuid,
  p_status text,
  p_resolution_notes text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_notes text := NULLIF(trim(both FROM p_resolution_notes), '');
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.reports
  SET status = p_status,
      reviewed_by = v_admin,
      reviewed_at = now(),
      resolution_notes = v_notes
  WHERE id = p_report_id;

  INSERT INTO public.moderation_log (
    action,
    target_type,
    target_id,
    metadata,
    created_at,
    admin_id
  )
  VALUES (
    'update_report_status',
    'report',
    p_report_id,
    jsonb_build_object(
      'new_status', p_status,
      'resolution_notes', v_notes
    ),
    now(),
    v_admin
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.admin_update_report_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_moderation_log(
  p_user_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_sort_direction text DEFAULT 'desc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  action text,
  target_type text,
  target_id uuid,
  user_id uuid,
  catch_id uuid,
  comment_id uuid,
  metadata jsonb,
  created_at timestamptz,
  admin_id uuid,
  admin_username text
) AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    ml.id,
    ml.action,
    ml.target_type,
    ml.target_id,
    ml.user_id,
    ml.catch_id,
    ml.comment_id,
    ml.metadata,
    ml.created_at,
    adm.id AS admin_id,
    adm.username AS admin_username
  FROM public.moderation_log ml
  LEFT JOIN public.profiles adm ON adm.id = ml.admin_id
  WHERE (p_user_id IS NULL OR ml.user_id = p_user_id OR ml.target_id = p_user_id)
    AND (p_action IS NULL OR ml.action = p_action)
    AND (p_from IS NULL OR ml.created_at >= p_from)
    AND (p_to IS NULL OR ml.created_at <= p_to)
    AND (p_search IS NULL OR ml.metadata::text ILIKE '%' || p_search || '%' OR adm.username ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN lower(p_sort_direction) = 'asc' THEN ml.created_at END ASC,
    CASE WHEN lower(p_sort_direction) <> 'asc' THEN ml.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.admin_list_moderation_log(
  p_user_id uuid,
  p_action text,
  p_search text,
  p_from timestamptz,
  p_to timestamptz,
  p_sort_direction text,
  p_limit int,
  p_offset int
) TO authenticated;
