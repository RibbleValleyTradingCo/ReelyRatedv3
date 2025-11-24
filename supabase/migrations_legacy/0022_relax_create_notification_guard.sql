-- Relax create_notification guard to allow legitimate cross-user notifications

DROP FUNCTION IF EXISTS public.create_notification(
    UUID,
    TEXT,
    public.notification_type,
    UUID,
    UUID,
    UUID,
    JSONB
);

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_message TEXT,
    p_type public.notification_type,
    p_actor_id UUID DEFAULT NULL,
    p_catch_id UUID DEFAULT NULL,
    p_comment_id UUID DEFAULT NULL,
    p_extra_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_notification_id UUID;
    v_requester UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    IF v_requester IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = v_requester
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        IF p_user_id = v_requester THEN
            -- allowed: notifying yourself
            NULL;
        ELSIF p_actor_id IS NOT NULL AND p_actor_id = v_requester THEN
            -- allowed: notifying someone else with yourself as actor
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
        extra_data
    )
    VALUES (
        p_user_id,
        p_actor_id,
        p_type,
        p_message,
        p_catch_id,
        p_comment_id,
        p_extra_data
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(
    UUID,
    TEXT,
    public.notification_type,
    UUID,
    UUID,
    UUID,
    JSONB
) TO authenticated;
