-- 2024_phase2_comments_threading_enhancements.sql
-- Purpose: Tighten comment RLS (insert ownership), ensure admin visibility, and support threaded comments with updated RPCs.

SET search_path = public, extensions;

-- Ensure parent FK exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catch_comments_parent_comment_id_fkey'
      AND conrelid = 'public.catch_comments'::regclass
  ) THEN
    ALTER TABLE public.catch_comments
      ADD CONSTRAINT catch_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES public.catch_comments(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Index to support threaded fetches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_catch_comments_catch_parent_created'
  ) THEN
    CREATE INDEX idx_catch_comments_catch_parent_created
      ON public.catch_comments (catch_id, parent_comment_id, created_at);
  END IF;
END;
$$;

-- Drop legacy FOR ALL policy if present (redundant/conflicting)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_owner_all' AND tablename = 'catch_comments'
  ) THEN
    DROP POLICY catch_comments_owner_all ON public.catch_comments;
  END IF;
END;
$$;

-- SELECT: viewable comments (hide deleted for normal users). Admin read-all handled in 2016_phase1_admin_visibility.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_select_viewable') THEN
    DROP POLICY catch_comments_select_viewable ON public.catch_comments;
  END IF;

  CREATE POLICY catch_comments_select_viewable ON public.catch_comments
    FOR SELECT
    USING (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.catches c
        WHERE c.id = catch_id
          AND c.deleted_at IS NULL
          AND (
            c.user_id = auth.uid()
            OR c.visibility = 'public'
            OR (
              c.visibility = 'followers'
              AND auth.uid() IS NOT NULL
              AND public.is_following(auth.uid(), c.user_id)
            )
            OR public.is_admin(auth.uid())
          )
      )
    );
END;
$$;

-- INSERT: only on catches user can view AND (user_id = auth.uid() OR admin)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_insert_viewable') THEN
    DROP POLICY catch_comments_insert_viewable ON public.catch_comments;
  END IF;

  CREATE POLICY catch_comments_insert_viewable ON public.catch_comments
    FOR INSERT
    WITH CHECK (
      (user_id = auth.uid() OR public.is_admin(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM public.catches c
        WHERE c.id = catch_id
          AND c.deleted_at IS NULL
          AND (
            c.user_id = auth.uid()
            OR c.visibility = 'public'
            OR (
              c.visibility = 'followers'
              AND auth.uid() IS NOT NULL
              AND public.is_following(auth.uid(), c.user_id)
            )
            OR public.is_admin(auth.uid())
          )
      )
    );
END;
$$;

-- UPDATE: owner-only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_update_owner') THEN
    DROP POLICY catch_comments_update_owner ON public.catch_comments;
  END IF;
  CREATE POLICY catch_comments_update_owner ON public.catch_comments
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END;
$$;

-- UPDATE: admin override
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_admin_update') THEN
    DROP POLICY catch_comments_admin_update ON public.catch_comments;
  END IF;
  CREATE POLICY catch_comments_admin_update ON public.catch_comments
    FOR UPDATE
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
END;
$$;

-- Admin SELECT of deleted comments is provided by catch_comments_admin_read_all in 2016_phase1_admin_visibility.sql.

-- Replace create_comment_with_rate_limit with threaded + visibility-aware version
DROP FUNCTION IF EXISTS public.create_comment_with_rate_limit(uuid, text);
DROP FUNCTION IF EXISTS public.create_comment_with_rate_limit(uuid, text, uuid);

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

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(uuid, text, uuid) TO authenticated;

-- Optional helper: soft delete a comment (owner or admin)
CREATE OR REPLACE FUNCTION public.soft_delete_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin(v_user_id);
  v_comment RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, user_id, deleted_at
  INTO v_comment
  FROM public.catch_comments
  WHERE id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF v_comment.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF NOT v_is_admin AND v_comment.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Not permitted to delete this comment';
  END IF;

  UPDATE public.catch_comments
  SET deleted_at = now()
  WHERE id = v_comment.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_comment(uuid) TO authenticated;
