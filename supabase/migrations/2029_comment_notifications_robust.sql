-- 2029_comment_notifications_robust.sql
-- Purpose: make comment notifications non-blocking and ensure actor->owner notifications succeed.

SET search_path = public, extensions;

-- Recreate create_comment_with_rate_limit with guarded notification dispatch.
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

  -- Notify catch owner (skip self-comments, skip soft-deleted catches); failures here must not block comment creation.
  IF v_catch.user_id IS NOT NULL AND v_catch.user_id <> v_user_id AND v_catch.deleted_at IS NULL THEN
    BEGIN
      PERFORM public.create_notification(
        p_user_id := v_catch.user_id,
        p_message := 'Someone commented on your catch',
        p_type := 'new_comment'::public.notification_type,
        p_actor_id := v_user_id,
        p_catch_id := p_catch_id,
        p_comment_id := v_id,
        p_extra_data := jsonb_build_object('catch_id', p_catch_id, 'comment_id', v_id)
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Do not block comment creation if notification fails.
        NULL;
    END;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(uuid, text, uuid) TO authenticated;

-- Recreate create_notification to explicitly allow actor->recipient (commenter -> catch owner) and keep dedupe scope.
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

  -- Allow if admin OR requester is the actor OR requester is the recipient (self). Otherwise reject.
  IF NOT v_is_admin THEN
    IF v_requester = p_user_id THEN
      NULL;
    ELSIF p_actor_id IS NOT NULL AND p_actor_id = v_requester THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Not permitted to send this notification';
    END IF;
  END IF;

  IF p_type IN ('new_reaction', 'new_follower') THEN
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
    ON CONFLICT ON CONSTRAINT uq_notifications_like_follow_once
    DO UPDATE
      SET message = EXCLUDED.message,
          extra_data = EXCLUDED.extra_data,
          created_at = now(),
          deleted_at = NULL,
          is_read = FALSE
    RETURNING id INTO v_id;
  ELSE
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
  END IF;

  RETURN v_id;
END;
$$;
