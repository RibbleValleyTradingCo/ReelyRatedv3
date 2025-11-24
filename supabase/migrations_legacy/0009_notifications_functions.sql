-- Notifications helper functions (create_notification + notify_admins)

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
BEGIN
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
    p_user_id UUID,
    p_message TEXT,
    p_type public.notification_type,
    p_actor_id UUID,
    p_catch_id UUID,
    p_comment_id UUID,
    p_extra_data JSONB
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins(
    p_message TEXT,
    p_report_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    admin_record RECORD;
BEGIN
    FOR admin_record IN
        SELECT user_id
        FROM public.admin_users
        WHERE user_id IS NOT NULL
    LOOP
        PERFORM public.create_notification(
            p_user_id   => admin_record.user_id,
            p_actor_id  => NULL,
            p_type      => 'admin_report',
            p_message   => COALESCE(p_message, 'New admin notification'),
            p_catch_id  => NULL,
            p_comment_id => NULL,
            p_extra_data => CASE
                WHEN p_report_id IS NULL THEN NULL
                ELSE jsonb_build_object('report_id', p_report_id)
            END
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins(
    p_message TEXT,
    p_report_id UUID
) TO anon, authenticated;

-- Summary: ensure notifications are created via SECURITY DEFINER functions
