-- 2019_phase1c_notification_dedupe.sql
-- Purpose: Phase 1C – Dedupe like/follow notifications to prevent spam and use a table constraint.
-- Applies to notification types: new_reaction (likes) and new_follower.

SET search_path = public, extensions;

-- Clean up existing duplicate like/follow notifications before adding uniqueness
DELETE FROM public.notifications n
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, actor_id, type
        ORDER BY created_at, id
      ) AS rn
    FROM public.notifications
    WHERE type IN ('new_reaction', 'new_follower')
  ) t
  WHERE t.rn > 1
) d
WHERE n.ctid = d.ctid;

-- Drop old index if it exists (in case of prior runs) and add a UNIQUE CONSTRAINT instead
DROP INDEX IF EXISTS public.uq_notifications_like_follow_once;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_notifications_like_follow_once'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT uq_notifications_like_follow_once
      UNIQUE (user_id, actor_id, type);
  END IF;
END;
$$;

-- Replace create_notification to upsert for like/follow notifications (update created_at/message/extra_data).
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
