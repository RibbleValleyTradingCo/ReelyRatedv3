-- 2048_moderation_notification_copy.sql
-- Purpose: Improve moderation notifications (user-facing clarity) and emit notification when restrictions are lifted.

SET search_path = public, extensions;

-- Redefine admin_warn_user to include richer notification metadata (severity, reason, suspension_until, new_status)
DROP FUNCTION IF EXISTS public.admin_warn_user(uuid, text, public.warning_severity, integer);

CREATE OR REPLACE FUNCTION public.admin_warn_user(
  p_user_id uuid,
  p_reason text,
  p_severity public.warning_severity DEFAULT 'warning',
  p_duration_hours integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_warning_id uuid;
  v_profile RECORD;
  v_new_status text := 'warned';
  v_new_suspension timestamptz;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT id, warn_count, moderation_status, suspension_until
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  INSERT INTO public.user_warnings (
    user_id,
    admin_id,
    reason,
    severity,
    duration_hours,
    created_at
  )
  VALUES (
    p_user_id,
    v_admin,
    p_reason,
    p_severity::text,
    p_duration_hours,
    now()
  )
  RETURNING id INTO v_warning_id;

  v_new_status := 'warned';
  v_new_suspension := NULL;

  IF p_severity = 'temporary_suspension' THEN
    v_new_status := 'suspended';
    IF p_duration_hours IS NOT NULL THEN
      v_new_suspension := now() + (p_duration_hours || ' hours')::interval;
    ELSE
      v_new_suspension := now() + interval '24 hours';
    END IF;
  ELSIF p_severity = 'permanent_ban' THEN
    v_new_status := 'banned';
    v_new_suspension := NULL;
  END IF;

  UPDATE public.profiles
  SET warn_count = COALESCE(warn_count, 0) + 1,
      moderation_status = v_new_status,
      suspension_until = v_new_suspension,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.moderation_log (
    action,
    target_type,
    target_id,
    user_id,
    catch_id,
    comment_id,
    metadata,
    created_at,
    admin_id
  )
  VALUES (
    'warn_user',
    'profile',
    p_user_id,
    p_user_id,
    NULL,
    NULL,
    jsonb_build_object(
      'reason', p_reason,
      'severity', p_severity::text,
      'duration_hours', p_duration_hours,
      'source', 'admin_action'
    ),
    now(),
    v_admin
  );

  PERFORM public.create_notification(
    p_user_id    => p_user_id,
    p_message    => 'You have received an admin warning: ' || p_reason,
    p_type       => 'admin_warning',
    p_actor_id   => v_admin,
    p_catch_id   => NULL,
    p_comment_id => NULL,
    p_extra_data => jsonb_build_object(
      'severity', p_severity::text,
      'duration_hours', p_duration_hours,
      'warning_id', v_warning_id,
      'reason', p_reason,
      'suspension_until', v_new_suspension,
      'new_status', v_new_status
    )
  );

  RETURN v_warning_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_warn_user(uuid, text, public.warning_severity, integer) TO authenticated;

-- Redefine admin_clear_moderation_status to notify the affected user
DROP FUNCTION IF EXISTS public.admin_clear_moderation_status(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_clear_moderation_status(
  p_user_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_previous_status text;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT moderation_status INTO v_previous_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  UPDATE public.profiles
  SET moderation_status = 'active',
      suspension_until = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.moderation_log (
    action,
    target_type,
    target_id,
    user_id,
    catch_id,
    comment_id,
    metadata,
    created_at,
    admin_id
  )
  VALUES (
    'clear_moderation',
    'profile',
    p_user_id,
    p_user_id,
    NULL,
    NULL,
    jsonb_build_object(
      'reason', coalesce(nullif(p_reason, ''), 'Cleared by admin'),
      'previous_status', v_previous_status
    ),
    now(),
    v_admin
  );

  PERFORM public.create_notification(
    p_user_id    => p_user_id,
    p_message    => 'Your account restrictions have been lifted',
    p_type       => 'admin_moderation',
    p_actor_id   => v_admin,
    p_catch_id   => NULL,
    p_comment_id => NULL,
    p_extra_data => jsonb_build_object(
      'action', 'clear_moderation',
      'reason', coalesce(nullif(p_reason, ''), 'Cleared by admin'),
      'previous_status', v_previous_status
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_moderation_status(uuid, text) TO authenticated;

-- Safety note:
-- This migration re-applies the moderation safety pattern (similar to 2043_fix_comment_parent_record_usage)
-- while keeping the new moderation enforcement and adds clearer notifications for warn/suspend/ban and lifted restrictions.
