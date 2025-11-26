-- 2026_wire_comment_notifications_from_rpc.sql
-- Purpose: ensure each new comment/reply triggers its own notification (new_comment), while keeping existing visibility/rate-limit logic intact.

SET search_path = public, extensions;

-- Recreate create_comment_with_rate_limit with notification dispatch to catch owner
CREATE OR REPLACE FUNCTION public.create_comment_with_rate_limit(
  p_catch_id uuid,
  p_body text,
  p_parent_comment_id uuid DEFAULT NULL
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
  v_is_admin boolean := public.is_admin(v_user_id);
  v_is_follower boolean := false;
  v_parent RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, visibility, deleted_at
  INTO v_catch
  FROM public.catches
  WHERE id = p_catch_id;

  IF NOT FOUND OR v_catch.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Catch is not accessible';
  END IF;

  IF NOT v_is_admin THEN
    IF v_catch.user_id = v_user_id THEN
      NULL;
    ELSIF v_catch.visibility = 'public' THEN
      NULL;
    ELSIF v_catch.visibility = 'followers' THEN
      v_is_follower := public.is_following(v_user_id, v_catch.user_id);
      IF NOT v_is_follower THEN
        RAISE EXCEPTION 'Catch is not accessible';
      END IF;
    ELSE
      RAISE EXCEPTION 'Catch is not accessible';
    END IF;
  END IF;

  IF p_parent_comment_id IS NOT NULL THEN
    SELECT id, catch_id, deleted_at
    INTO v_parent
    FROM public.catch_comments
    WHERE id = p_parent_comment_id;

    IF NOT FOUND OR v_parent.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;

    IF v_parent.catch_id <> p_catch_id THEN
      RAISE EXCEPTION 'Parent comment belongs to a different catch';
    END IF;
  END IF;

  IF v_body = '' THEN
    RAISE EXCEPTION 'Comment body is required';
  END IF;

  IF NOT public.check_rate_limit(v_user_id, 'comments', 20, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
  END IF;

  INSERT INTO public.catch_comments (catch_id, user_id, body, parent_comment_id, created_at)
  VALUES (p_catch_id, v_user_id, v_body, p_parent_comment_id, now())
  RETURNING id INTO v_id;

  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (v_user_id, 'comments', now());

  -- Notify catch owner for new comments (skip self-comments, skip if catch is soft-deleted)
  IF v_catch.user_id IS NOT NULL AND v_catch.user_id <> v_user_id AND v_catch.deleted_at IS NULL THEN
    PERFORM public.create_notification(
      p_user_id := v_catch.user_id,
      p_message := 'Someone commented on your catch',
      p_type := 'new_comment'::public.notification_type,
      p_actor_id := v_user_id,
      p_catch_id := p_catch_id,
      p_comment_id := v_id,
      p_extra_data := jsonb_build_object('catch_id', p_catch_id, 'comment_id', v_id)
    );
  END IF;

  RETURN v_id;
END;
$$;
