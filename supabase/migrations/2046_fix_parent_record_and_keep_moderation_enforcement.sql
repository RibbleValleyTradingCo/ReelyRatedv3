-- 2046_fix_parent_record_and_keep_moderation_enforcement.sql
-- Purpose: Retain moderation enforcement while avoiding unassigned v_parent errors by using a guarded parent user id.

SET search_path = public, extensions;

-- Drop old overload (idempotent).
DROP FUNCTION IF EXISTS public.create_comment_with_rate_limit(uuid, text);

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
  v_parent_user_id uuid := NULL;
  v_mention RECORD;
  v_notify_owner boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Moderation enforcement (admin bypass)
  PERFORM public.assert_moderation_allowed(v_user_id);

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
    SELECT id, catch_id, deleted_at, user_id
    INTO v_parent
    FROM public.catch_comments
    WHERE id = p_parent_comment_id;

    IF NOT FOUND OR v_parent.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;

    IF v_parent.catch_id <> p_catch_id THEN
      RAISE EXCEPTION 'Parent comment belongs to a different catch';
    END IF;

    v_parent_user_id := v_parent.user_id;
  END IF;

  IF v_body = '' THEN
    RAISE EXCEPTION 'Comment body is required';
  END IF;

  IF NOT v_is_admin THEN
    IF NOT public.check_rate_limit(v_user_id, 'comments', 20, 60) THEN
      RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
    END IF;
  END IF;

  INSERT INTO public.catch_comments (catch_id, user_id, body, parent_comment_id, created_at)
  VALUES (p_catch_id, v_user_id, v_body, p_parent_comment_id, now())
  RETURNING id INTO v_id;

  IF NOT v_is_admin THEN
    INSERT INTO public.rate_limits (user_id, action, created_at)
    VALUES (v_user_id, 'comments', now());
  END IF;

  v_notify_owner := v_catch.user_id IS NOT NULL
    AND v_catch.user_id <> v_user_id
    AND (p_parent_comment_id IS NULL OR v_parent_user_id IS NULL OR v_parent_user_id <> v_catch.user_id)
    AND v_catch.deleted_at IS NULL;

  -- Notify catch owner for new comments (skip self, skip if also parent, skip deleted catch)
  IF v_notify_owner THEN
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
        NULL;
    END;
  END IF;

  -- Reply notifications to parent author (skip self-replies)
  IF p_parent_comment_id IS NOT NULL AND v_parent_user_id IS NOT NULL AND v_parent_user_id <> v_user_id THEN
    BEGIN
      PERFORM public.create_notification(
        p_user_id := v_parent_user_id,
        p_message := 'Someone replied to your comment',
        p_type := 'comment_reply'::public.notification_type,
        p_actor_id := v_user_id,
        p_catch_id := p_catch_id,
        p_comment_id := v_id,
        p_extra_data := jsonb_build_object(
          'catch_id', p_catch_id,
          'comment_id', v_id,
          'parent_comment_id', p_parent_comment_id
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  -- Mention notifications (non-blocking)
  BEGIN
    FOR v_mention IN
      SELECT DISTINCT p.id AS mentioned_id, p.username
      FROM regexp_matches(v_body, '@([A-Za-z0-9_.]+)', 'g') m(match)
      JOIN public.profiles p ON lower(p.username) = lower(m.match[1])
    LOOP
      -- Skip self
      IF v_mention.mentioned_id = v_user_id THEN
        CONTINUE;
      END IF;
      -- Skip owner (already notified via new_comment)
      IF v_catch.user_id = v_mention.mentioned_id THEN
        CONTINUE;
      END IF;
      -- Skip parent author (already notified via comment_reply)
      IF p_parent_comment_id IS NOT NULL AND v_parent_user_id IS NOT NULL AND v_mention.mentioned_id = v_parent_user_id THEN
        CONTINUE;
      END IF;
      -- Visibility checks for mentioned user
      IF v_catch.visibility = 'followers' THEN
        IF NOT (v_catch.user_id = v_mention.mentioned_id OR public.is_admin(v_mention.mentioned_id) OR public.is_following(v_mention.mentioned_id, v_catch.user_id)) THEN
          CONTINUE;
        END IF;
      ELSIF v_catch.visibility = 'private' THEN
        IF NOT (v_catch.user_id = v_mention.mentioned_id OR public.is_admin(v_mention.mentioned_id)) THEN
          CONTINUE;
        END IF;
      END IF;

      BEGIN
        PERFORM public.create_notification(
          p_user_id := v_mention.mentioned_id,
          p_message := 'Someone mentioned you in a comment',
          p_type := 'mention'::public.notification_type,
          p_actor_id := v_user_id,
          p_catch_id := p_catch_id,
          p_comment_id := v_id,
          p_extra_data := jsonb_build_object(
            'catch_id', p_catch_id,
            'comment_id', v_id,
            'mentioned_username', v_mention.username
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(uuid, text, uuid) TO authenticated;

-- Note: This migration re-applies the safe parent handling from 2043_fix_comment_parent_record_usage.sql (using a guarded parent user id) while retaining the moderation enforcement added in 2045_moderation_enforcement.sql (assert_moderation_allowed, admin bypass, notifications, rate limits).
