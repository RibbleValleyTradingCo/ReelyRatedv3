-- 2026_fix_comment_notifications_no_dedupe.sql
-- Purpose: allow one notification per comment (no dedupe), while keeping dedupe for likes/follows only.
-- Updates the unique constraint and recreate create_notification accordingly.

SET search_path = public, extensions;

-- Clean up duplicates on the new dedupe key (user, actor, type, catch, comment)
DELETE FROM public.notifications n
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (
        PARTITION BY
          user_id,
          actor_id,
          type,
          COALESCE(catch_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(comment_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ORDER BY created_at, id
      ) AS rn
    FROM public.notifications
  ) t
  WHERE t.rn > 1
) d
WHERE n.ctid = d.ctid;

-- Drop existing constraint/index safely, then add the new constraint scoped by catch/comment
DO $$
BEGIN
  -- Drop constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_notifications_like_follow_once'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT uq_notifications_like_follow_once;
  END IF;

  -- Drop index with the same name if it exists as a standalone index
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_notifications_like_follow_once'
  ) THEN
    EXECUTE 'DROP INDEX public.uq_notifications_like_follow_once';
  END IF;

  -- Add new unique constraint that includes catch_id/comment_id to avoid deduping comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_notifications_like_follow_once'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT uq_notifications_like_follow_once
      UNIQUE (user_id, actor_id, type, catch_id, comment_id);
  END IF;
END;
$$;

-- Recreate create_notification: dedupe only for new_reaction/new_follower; comments always insert new rows
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
