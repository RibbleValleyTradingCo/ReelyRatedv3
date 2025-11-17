-- Phase 3 moderation tweak: idempotent admin comment actions

CREATE OR REPLACE FUNCTION public.admin_delete_comment(
    p_comment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_comment RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    SELECT id, user_id, catch_id INTO v_comment
    FROM public.catch_comments
    WHERE id = p_comment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comment % not found', p_comment_id;
    END IF;

    UPDATE public.catch_comments
    SET deleted_at = now(),
        updated_at = now()
    WHERE id = v_comment.id
      AND deleted_at IS NULL;

    IF FOUND THEN
        INSERT INTO public.moderation_log (
            admin_id,
            action,
            user_id,
            catch_id,
            comment_id,
            metadata,
            created_at
        )
        VALUES (
            auth.uid(),
            'delete_comment',
            v_comment.user_id,
            v_comment.catch_id,
            v_comment.id,
            jsonb_build_object(
                'reason', p_reason,
                'source', 'admin_action'
            ),
            now()
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_comment(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_comment(
    p_comment_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_comment RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    SELECT id, user_id, catch_id INTO v_comment
    FROM public.catch_comments
    WHERE id = p_comment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comment % not found', p_comment_id;
    END IF;

    UPDATE public.catch_comments
    SET deleted_at = NULL,
        updated_at = now()
    WHERE id = v_comment.id
      AND deleted_at IS NOT NULL;

    IF FOUND THEN
        INSERT INTO public.moderation_log (
            admin_id,
            action,
            user_id,
            catch_id,
            comment_id,
            metadata,
            created_at
        )
        VALUES (
            auth.uid(),
            'restore_comment',
            v_comment.user_id,
            v_comment.catch_id,
            v_comment.id,
            jsonb_build_object(
                'reason', p_reason,
                'source', 'admin_action'
            ),
            now()
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_comment(UUID, TEXT) TO authenticated;

-- Summary: make admin comment delete/restore idempotent and log only state changes
