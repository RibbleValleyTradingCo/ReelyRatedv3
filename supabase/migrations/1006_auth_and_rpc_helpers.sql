-- 1006_auth_and_rpc_helpers.sql
-- Reintroduces RPCs used by the current frontend (auth helper, notifications, rate-limited actions, admin moderation) plus required enums.

SET search_path = public, extensions;

----------------------------------------------------------------------
-- Enum definitions (idempotent)
----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.reaction_type AS ENUM ('like', 'love', 'fire');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.notification_type AS ENUM (
      'new_follower',
      'new_comment',
      'new_rating',
      'new_reaction',
      'mention',
      'admin_report',
      'admin_warning',
      'admin_moderation'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_target_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.report_target_type AS ENUM ('catch', 'comment', 'profile');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warning_severity' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.warning_severity AS ENUM ('warning', 'temporary_suspension', 'permanent_ban');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mod_action' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.mod_action AS ENUM (
      'delete_catch',
      'delete_comment',
      'restore_catch',
      'restore_comment',
      'warn_user',
      'suspend_user'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.time_of_day AS ENUM ('morning', 'afternoon', 'evening', 'night');
  END IF;
END;
$$;

----------------------------------------------------------------------
-- A) Auth / helper
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(email_to_check)
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

----------------------------------------------------------------------
-- B) Notifications
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_message text,
  p_type public.notification_type,
  p_actor_id uuid DEFAULT NULL,
  p_catch_id uuid DEFAULT NULL,
  p_comment_id uuid DEFAULT NULL,
  p_extra_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_requester uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = v_requester
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    IF p_user_id = v_requester THEN
      NULL;
    ELSIF p_actor_id IS NOT NULL AND p_actor_id = v_requester THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Not permitted to send this notification';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    message,
    catch_id,
    comment_id,
    extra_data,
    is_read,
    created_at
  )
  VALUES (
    p_user_id,
    p_actor_id,
    p_type::text,
    p_message,
    p_catch_id,
    p_comment_id,
    p_extra_data,
    false,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

----------------------------------------------------------------------
-- C) User-facing rate-limited RPCs
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_comment_with_rate_limit(
  p_catch_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_body text := trim(both FROM coalesce(p_body, ''));
  v_catch RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, visibility, deleted_at
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id;

  IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF v_body = '' THEN
    RAISE EXCEPTION 'Comment body is required';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'comments', 20, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
  END IF;

  INSERT INTO public.catch_comments (catch_id, user_id, body, created_at)
  VALUES (p_catch_id, v_user_id, v_body, now())
  RETURNING id INTO v_id;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'comments', now());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_report_with_rate_limit(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_report public.reports;
  v_reason text := trim(both FROM coalesce(p_reason, ''));
  v_details text := NULLIF(trim(both FROM p_details), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Report reason is required';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'reports', 5, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: reports – max 5 per hour';
  END IF;

  INSERT INTO public.reports (reporter_id, target_type, target_id, reason, details, status, created_at)
  VALUES (v_user_id, p_target_type::text, p_target_id, v_reason, v_details, 'open', now())
  RETURNING * INTO v_report;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'reports', now());

  RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION public.react_to_catch_with_rate_limit(
  p_catch_id uuid,
  p_reaction text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reaction public.reaction_type := COALESCE(NULLIF(p_reaction, ''), 'like')::public.reaction_type;
  v_catch RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, visibility, deleted_at
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id;

  IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'reactions', 50, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: reactions – max 50 per hour';
  END IF;

  INSERT INTO public.catch_reactions (catch_id, user_id, reaction, created_at)
  VALUES (p_catch_id, v_user_id, v_reaction::text, now())
  ON CONFLICT (user_id, catch_id) DO UPDATE
    SET reaction = EXCLUDED.reaction, created_at = now();

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'reactions', now());

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_catch_with_rate_limit(
  p_catch_id uuid,
  p_rating int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_catch RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, visibility, deleted_at
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id;

  IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 10 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 10';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'ratings', 50, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: ratings – max 50 per hour';
  END IF;

  INSERT INTO public.ratings (catch_id, user_id, rating, created_at)
  VALUES (p_catch_id, v_user_id, p_rating, now())
  ON CONFLICT (user_id, catch_id) DO UPDATE
    SET rating = EXCLUDED.rating, created_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'ratings', now());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.follow_profile_with_rate_limit(
  p_following_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_follow_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_user_id = p_following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'follows', 30, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: follows – max 30 per hour';
  END IF;

  INSERT INTO public.profile_follows (follower_id, following_id, created_at)
  VALUES (v_user_id, p_following_id, now())
  ON CONFLICT (follower_id, following_id) DO NOTHING
  RETURNING id INTO v_follow_id;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'follows', now());

  RETURN COALESCE(
    v_follow_id,
    (SELECT id FROM public.profile_follows WHERE follower_id = v_user_id AND following_id = p_following_id)
  );
END;
$$;

----------------------------------------------------------------------
-- D) Admin / moderation RPCs
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_catch(
  p_catch_id uuid,
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
  v_catch RECORD;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT id, user_id
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catch % not found', p_catch_id;
  END IF;

  UPDATE public.catches
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = v_catch.id
    AND deleted_at IS NULL;

  IF FOUND THEN
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
      'delete_catch',
      'catch',
      v_catch.id,
      v_catch.user_id,
      v_catch.id,
      NULL,
      jsonb_build_object('reason', p_reason, 'source', 'admin_action'),
      now(),
      v_admin
    );

    PERFORM public.create_notification(
      p_user_id    => v_catch.user_id,
      p_message    => 'An admin has moderated your catch: ' || p_reason,
      p_type       => 'admin_moderation',
      p_actor_id   => v_admin,
      p_catch_id   => v_catch.id,
      p_comment_id => NULL,
      p_extra_data => jsonb_build_object(
        'action', 'delete_catch',
        'catch_id', v_catch.id,
        'reason', p_reason
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_catch(
  p_catch_id uuid,
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
  v_catch RECORD;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT id, user_id
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catch % not found', p_catch_id;
  END IF;

  UPDATE public.catches
  SET deleted_at = NULL,
      updated_at = now()
  WHERE id = v_catch.id
    AND deleted_at IS NOT NULL;

  IF FOUND THEN
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
      'restore_catch',
      'catch',
      v_catch.id,
      v_catch.user_id,
      v_catch.id,
      NULL,
      jsonb_build_object('reason', p_reason, 'source', 'admin_action'),
      now(),
      v_admin
    );

    PERFORM public.create_notification(
      p_user_id    => v_catch.user_id,
      p_message    => 'An admin has restored your catch: ' || p_reason,
      p_type       => 'admin_moderation',
      p_actor_id   => v_admin,
      p_catch_id   => v_catch.id,
      p_comment_id => NULL,
      p_extra_data => jsonb_build_object(
        'action', 'restore_catch',
        'catch_id', v_catch.id,
        'reason', p_reason
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_comment(
  p_comment_id uuid,
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
  v_comment RECORD;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT id, user_id, catch_id
  INTO v_comment
  FROM public.catch_comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment % not found', p_comment_id;
  END IF;

  UPDATE public.catch_comments
  SET deleted_at = now()
  WHERE id = v_comment.id
    AND deleted_at IS NULL;

  IF FOUND THEN
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
      'delete_comment',
      'comment',
      v_comment.id,
      v_comment.user_id,
      v_comment.catch_id,
      v_comment.id,
      jsonb_build_object('reason', p_reason, 'source', 'admin_action'),
      now(),
      v_admin
    );

    PERFORM public.create_notification(
      p_user_id    => v_comment.user_id,
      p_message    => 'An admin has moderated your comment: ' || p_reason,
      p_type       => 'admin_moderation',
      p_actor_id   => v_admin,
      p_catch_id   => v_comment.catch_id,
      p_comment_id => v_comment.id,
      p_extra_data => jsonb_build_object(
        'action', 'delete_comment',
        'comment_id', v_comment.id,
        'catch_id', v_comment.catch_id,
        'reason', p_reason
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_comment(
  p_comment_id uuid,
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
  v_comment RECORD;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_admin) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT id, user_id, catch_id
  INTO v_comment
  FROM public.catch_comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment % not found', p_comment_id;
  END IF;

  UPDATE public.catch_comments
  SET deleted_at = NULL
  WHERE id = v_comment.id
    AND deleted_at IS NOT NULL;

  IF FOUND THEN
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
      'restore_comment',
      'comment',
      v_comment.id,
      v_comment.user_id,
      v_comment.catch_id,
      v_comment.id,
      jsonb_build_object('reason', p_reason, 'source', 'admin_action'),
      now(),
      v_admin
    );

    PERFORM public.create_notification(
      p_user_id    => v_comment.user_id,
      p_message    => 'An admin has restored your comment: ' || p_reason,
      p_type       => 'admin_moderation',
      p_actor_id   => v_admin,
      p_catch_id   => v_comment.catch_id,
      p_comment_id => v_comment.id,
      p_extra_data => jsonb_build_object(
        'action', 'restore_comment',
        'comment_id', v_comment.id,
        'catch_id', v_comment.catch_id,
        'reason', p_reason
      )
    );
  END IF;
END;
$$;

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
      'warning_id', v_warning_id
    )
  );

  RETURN v_warning_id;
END;
$$;

----------------------------------------------------------------------
-- Grants (idempotent; safe to repeat)
----------------------------------------------------------------------
-- Auth/helper
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;

-- Notifications
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, public.notification_type, uuid, uuid, uuid, jsonb) TO authenticated;

-- User-facing rate-limited RPCs
GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_report_with_rate_limit(public.report_target_type, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.react_to_catch_with_rate_limit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_catch_with_rate_limit(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.follow_profile_with_rate_limit(uuid) TO authenticated;

-- Admin/moderation RPCs
GRANT EXECUTE ON FUNCTION public.admin_delete_catch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_catch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_warn_user(uuid, text, public.warning_severity, integer) TO authenticated;
