-- Harden notification helpers and rate-limited RPCs

DROP FUNCTION IF EXISTS public.create_notification(
    UUID,
    TEXT,
    public.notification_type,
    UUID,
    UUID,
    UUID,
    JSONB
);

DROP FUNCTION IF EXISTS public.notify_admins(TEXT, UUID);

DROP FUNCTION IF EXISTS public.create_comment_with_rate_limit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.react_to_catch_with_rate_limit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rate_catch_with_rate_limit(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.follow_profile_with_rate_limit(UUID);

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

    IF NOT v_is_admin AND p_user_id <> v_requester THEN
        RAISE EXCEPTION 'Not permitted to send this notification';
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

GRANT EXECUTE ON FUNCTION public.notify_admins(TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.create_comment_with_rate_limit(
    p_catch_id UUID,
    p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_comment_id UUID;
    v_body TEXT := trim(both FROM coalesce(p_body, ''));
    v_catch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, user_id, visibility, deleted_at
    INTO v_catch
    FROM public.catches
    WHERE id = p_catch_id;

    IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
        RAISE EXCEPTION 'Catch is not accessible';
    END IF;

    IF v_body = '' THEN
        RAISE EXCEPTION 'Comment body is required';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'comments', 20, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
    END IF;

    INSERT INTO public.catch_comments (catch_id, user_id, body)
    VALUES (p_catch_id, v_user_id, v_body)
    RETURNING id INTO v_comment_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'comments');

    RETURN v_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.react_to_catch_with_rate_limit(
    p_catch_id UUID,
    p_reaction TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reaction public.reaction_type := COALESCE(NULLIF(p_reaction, ''), 'like')::public.reaction_type;
    v_catch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, user_id, visibility, deleted_at
    INTO v_catch
    FROM public.catches
    WHERE id = p_catch_id;

    IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
        RAISE EXCEPTION 'Catch is not accessible';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'reactions', 50, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: reactions – max 50 per hour';
    END IF;

    INSERT INTO public.catch_reactions (catch_id, user_id, reaction)
    VALUES (p_catch_id, v_user_id, v_reaction);

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'reactions');

    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_catch_with_rate_limit(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_catch_with_rate_limit(
    p_catch_id UUID,
    p_rating INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rating_id UUID;
    v_catch RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, user_id, visibility, deleted_at
    INTO v_catch
    FROM public.catches
    WHERE id = p_catch_id;

    IF NOT FOUND OR v_catch.deleted_at IS NOT NULL OR (v_catch.user_id <> v_user_id AND v_catch.visibility <> 'public') THEN
        RAISE EXCEPTION 'Catch is not accessible';
    END IF;

    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 10 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 10';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'ratings', 50, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: ratings – max 50 per hour';
    END IF;

    INSERT INTO public.ratings (catch_id, user_id, rating)
    VALUES (p_catch_id, v_user_id, p_rating)
    ON CONFLICT (catch_id, user_id) DO UPDATE
        SET rating = EXCLUDED.rating
    RETURNING id INTO v_rating_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'ratings');

    RETURN v_rating_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_catch_with_rate_limit(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.follow_profile_with_rate_limit(
    p_following_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_follow_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_user_id = p_following_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'follows', 30, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: follows – max 30 per hour';
    END IF;

    INSERT INTO public.profile_follows (follower_id, following_id)
    VALUES (v_user_id, p_following_id)
    RETURNING id INTO v_follow_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'follows');

    RETURN v_follow_id;
EXCEPTION
    WHEN unique_violation THEN
        SELECT id INTO v_follow_id
        FROM public.profile_follows
        WHERE follower_id = v_user_id
          AND following_id = p_following_id;
        RETURN v_follow_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_profile_with_rate_limit(UUID) TO authenticated;
