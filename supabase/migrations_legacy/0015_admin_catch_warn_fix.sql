-- 0015_admin_catch_warn_fix.sql – align admin RPCs with Phase 3 schema

DROP FUNCTION IF EXISTS public.admin_delete_catch(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_restore_catch(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_warn_user(UUID, TEXT, public.warning_severity, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_delete_catch(
    p_catch_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_catch RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
    ) THEN
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
            'delete_catch',
            v_catch.user_id,
            v_catch.id,
            NULL,
            jsonb_build_object(
                'reason', p_reason,
                'source', 'admin_action'
            ),
            now()
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_catch(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_catch(
    p_catch_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_catch RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
    ) THEN
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
            'restore_catch',
            v_catch.user_id,
            v_catch.id,
            NULL,
            jsonb_build_object(
                'reason', p_reason,
                'source', 'admin_action'
            ),
            now()
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_catch(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_warn_user(
    p_user_id UUID,
    p_reason TEXT,
    p_severity public.warning_severity DEFAULT 'warning',
    p_duration_hours INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_profile RECORD;
    v_warning_id UUID;
    v_new_status public.moderation_status;
    v_new_suspension TIMESTAMPTZ;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
    ) THEN
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
        issued_by,
        reason,
        details,
        severity,
        duration_hours
    )
    VALUES (
        p_user_id,
        auth.uid(),
        p_reason,
        p_reason,
        p_severity,
        p_duration_hours
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
        'warn_user',
        p_user_id,
        NULL,
        NULL,
        jsonb_build_object(
            'reason', p_reason,
            'severity', p_severity,
            'duration_hours', p_duration_hours,
            'source', 'admin_action'
        ),
        now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_warn_user(UUID, TEXT, public.warning_severity, INTEGER) TO authenticated;

-- Summary: recreate admin catch + warn RPCs to use Phase 3 metadata/columns
