


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."length_unit" AS ENUM (
    'cm',
    'in'
);


ALTER TYPE "public"."length_unit" OWNER TO "postgres";


CREATE TYPE "public"."mod_action" AS ENUM (
    'delete_catch',
    'delete_comment',
    'restore_catch',
    'restore_comment',
    'warn_user',
    'suspend_user'
);


ALTER TYPE "public"."mod_action" OWNER TO "postgres";


CREATE TYPE "public"."moderation_status" AS ENUM (
    'active',
    'warned',
    'suspended',
    'banned'
);


ALTER TYPE "public"."moderation_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'new_follower',
    'new_comment',
    'new_rating',
    'new_reaction',
    'mention',
    'admin_report',
    'admin_warning',
    'admin_moderation'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."reaction_type" AS ENUM (
    'like',
    'love',
    'fire'
);


ALTER TYPE "public"."reaction_type" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'open',
    'resolved',
    'dismissed'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."report_target_type" AS ENUM (
    'catch',
    'comment',
    'profile'
);


ALTER TYPE "public"."report_target_type" OWNER TO "postgres";


CREATE TYPE "public"."time_of_day" AS ENUM (
    'morning',
    'afternoon',
    'evening',
    'night'
);


ALTER TYPE "public"."time_of_day" OWNER TO "postgres";


CREATE TYPE "public"."visibility_type" AS ENUM (
    'public',
    'followers',
    'private'
);


ALTER TYPE "public"."visibility_type" OWNER TO "postgres";


CREATE TYPE "public"."warning_severity" AS ENUM (
    'warning',
    'temporary_suspension',
    'permanent_ban'
);


ALTER TYPE "public"."warning_severity" OWNER TO "postgres";


CREATE TYPE "public"."weight_unit" AS ENUM (
    'lb_oz',
    'kg',
    'g'
);


ALTER TYPE "public"."weight_unit" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_catch"("p_catch_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

        PERFORM public.create_notification(
            p_user_id     => v_catch.user_id,
            p_message     => 'An admin has moderated your catch: ' || p_reason,
            p_type        => 'admin_moderation',
            p_actor_id    => auth.uid(),
            p_catch_id    => v_catch.id,
            p_comment_id  => NULL,
            p_extra_data  => jsonb_build_object(
                'action', 'delete_catch',
                'catch_id', v_catch.id,
                'reason', p_reason
            )
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."admin_delete_catch"("p_catch_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_comment"("p_comment_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

        PERFORM public.create_notification(
            p_user_id     => v_comment.user_id,
            p_message     => 'An admin has moderated your comment: ' || p_reason,
            p_type        => 'admin_moderation',
            p_actor_id    => auth.uid(),
            p_catch_id    => v_comment.catch_id,
            p_comment_id  => v_comment.id,
            p_extra_data  => jsonb_build_object(
                'action', 'delete_comment',
                'comment_id', v_comment.id,
                'catch_id', v_comment.catch_id,
                'reason', p_reason
            )
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."admin_delete_comment"("p_comment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_restore_catch"("p_catch_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

        PERFORM public.create_notification(
            p_user_id     => v_catch.user_id,
            p_message     => 'An admin has restored your catch: ' || p_reason,
            p_type        => 'admin_moderation',
            p_actor_id    => auth.uid(),
            p_catch_id    => v_catch.id,
            p_comment_id  => NULL,
            p_extra_data  => jsonb_build_object(
                'action', 'restore_catch',
                'catch_id', v_catch.id,
                'reason', p_reason
            )
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."admin_restore_catch"("p_catch_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_restore_comment"("p_comment_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

        PERFORM public.create_notification(
            p_user_id     => v_comment.user_id,
            p_message     => 'An admin has restored your comment: ' || p_reason,
            p_type        => 'admin_moderation',
            p_actor_id    => auth.uid(),
            p_catch_id    => v_comment.catch_id,
            p_comment_id  => v_comment.id,
            p_extra_data  => jsonb_build_object(
                'action', 'restore_comment',
                'comment_id', v_comment.id,
                'catch_id', v_comment.catch_id,
                'reason', p_reason
            )
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."admin_restore_comment"("p_comment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_warn_user"("p_user_id" "uuid", "p_reason" "text", "p_severity" "public"."warning_severity" DEFAULT 'warning'::"public"."warning_severity", "p_duration_hours" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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

    PERFORM public.create_notification(
        p_user_id     => p_user_id,
        p_message     => 'You have received an admin warning: ' || p_reason,
        p_type        => 'admin_warning',
        p_actor_id    => auth.uid(),
        p_catch_id    => NULL,
        p_comment_id  => NULL,
        p_extra_data  => jsonb_build_object(
            'severity', p_severity,
            'duration_hours', p_duration_hours,
            'warning_id', v_warning_id
        )
    );
END;
$$;


ALTER FUNCTION "public"."admin_warn_user"("p_user_id" "uuid", "p_reason" "text", "p_severity" "public"."warning_severity", "p_duration_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users WHERE email = p_email
    );
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_email_exists"("p_email" "text") IS 'Check if an email is already registered';



CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Count attempts in window
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at >= v_window_start;

    IF v_count >= p_max_attempts THEN
        RETURN false; -- Rate limit exceeded
    END IF;

    -- Record this attempt
    INSERT INTO rate_limits (user_id, action)
    VALUES (p_user_id, p_action);

    RETURN true; -- Allowed
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) IS 'Check and record rate limit. Returns false if limit exceeded.';



CREATE OR REPLACE FUNCTION "public"."cleanup_rate_limits"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limits
    WHERE created_at < NOW() - INTERVAL '2 hours';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_rate_limits"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_rate_limits"() IS 'Clean up rate limit records older than 2 hours. Returns count of deleted rows.';



CREATE OR REPLACE FUNCTION "public"."create_comment_with_rate_limit"("p_catch_id" "uuid", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."create_comment_with_rate_limit"("p_catch_id" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_message" "text", "p_type" "public"."notification_type", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_catch_id" "uuid" DEFAULT NULL::"uuid", "p_comment_id" "uuid" DEFAULT NULL::"uuid", "p_extra_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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
            NULL; -- self notifications allowed
        ELSIF p_actor_id IS NOT NULL AND p_actor_id = v_requester THEN
            NULL; -- cross-user notifications allowed when actor matches caller
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


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_message" "text", "p_type" "public"."notification_type", "p_actor_id" "uuid", "p_catch_id" "uuid", "p_comment_id" "uuid", "p_extra_data" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "public"."report_target_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "public"."report_status" DEFAULT 'open'::"public"."report_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_report_with_rate_limit"("p_target_type" "public"."report_target_type", "p_target_id" "uuid", "p_reason" "text", "p_details" "text" DEFAULT NULL::"text") RETURNS "public"."reports"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_report public.reports%ROWTYPE;
    v_reason TEXT := trim(both FROM coalesce(p_reason, ''));
    v_details TEXT := NULLIF(trim(both FROM p_details), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_reason = '' THEN
        RAISE EXCEPTION 'Report reason is required';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'reports', 5, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: reports – max 5 per hour';
    END IF;

    INSERT INTO public.reports (reporter_id, target_type, target_id, reason, details)
    VALUES (v_user_id, p_target_type, p_target_id, v_reason, v_details)
    RETURNING * INTO v_report;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'reports');

    RETURN v_report;
END;
$$;


ALTER FUNCTION "public"."create_report_with_rate_limit"("p_target_type" "public"."report_target_type", "p_target_id" "uuid", "p_reason" "text", "p_details" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_catch_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NOT check_rate_limit(NEW.user_id, 'catch_creation', 10, 60) THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 10 catches per hour';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_catch_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_comment_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NOT check_rate_limit(NEW.user_id, 'comment_creation', 30, 60) THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 30 comments per hour';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_comment_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_report_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NOT check_rate_limit(NEW.reporter_id, 'report_creation', 5, 60) THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 reports per hour';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_report_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."follow_profile_with_rate_limit"("p_following_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."follow_profile_with_rate_limit"("p_following_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rate_limit_status"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) RETURNS TABLE("allowed" integer, "used" integer, "remaining" integer, "reset_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_used INTEGER;
    v_oldest_attempt TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Count attempts in window
    SELECT COUNT(*), MIN(created_at)
    INTO v_used, v_oldest_attempt
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at >= v_window_start;

    RETURN QUERY SELECT
        p_max_attempts AS allowed,
        COALESCE(v_used, 0) AS used,
        GREATEST(0, p_max_attempts - COALESCE(v_used, 0)) AS remaining,
        COALESCE(v_oldest_attempt + (p_window_minutes || ' minutes')::INTERVAL, NOW()) AS reset_at;
END;
$$;


ALTER FUNCTION "public"."get_rate_limit_status"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_rate_limit_status"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) IS 'Get rate limit status for display (allowed, used, remaining, reset_at)';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  base_username TEXT;
  cleaned_username TEXT;
  final_username TEXT;
  suffix_counter INTEGER := 0;
  max_length CONSTANT INTEGER := 30;
  min_length CONSTANT INTEGER := 3;
BEGIN
  -- Derive a starting point from the email prefix when available
  IF NEW.email IS NOT NULL THEN
    base_username := split_part(lower(NEW.email), '@', 1);
  END IF;

  IF base_username IS NULL OR length(base_username) < min_length THEN
    base_username := 'angler';
  END IF;

  -- Keep only [a-z0-9_]
  cleaned_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');

  -- Ensure minimum length by padding with user id pieces if needed
  IF length(cleaned_username) < min_length THEN
    cleaned_username := cleaned_username || substring(NEW.id::text, 1, min_length - length(cleaned_username));
  END IF;

  -- Trim to max length
  cleaned_username := left(cleaned_username, max_length);

  final_username := cleaned_username;

  -- Ensure uniqueness; append deterministic suffixes if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix_counter := suffix_counter + 1;
    final_username :=
      left(cleaned_username, max_length - 5) || '_' ||
      substring(md5(NEW.id::text || suffix_counter::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins"("p_message" "text", "p_report_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."notify_admins"("p_message" "text", "p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins"("p_report_id" "uuid", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_admin RECORD;
BEGIN
    FOR v_admin IN
        SELECT user_id FROM admin_users
    LOOP
        PERFORM create_notification(
            p_user_id := v_admin.user_id,
            p_type := 'admin_report',
            p_message := p_message,
            p_extra_data := jsonb_build_object('report_id', p_report_id)
        );
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_admins"("p_report_id" "uuid", "p_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_admins"("p_report_id" "uuid", "p_message" "text") IS 'Send notification to all admin users';



CREATE OR REPLACE FUNCTION "public"."rate_catch_with_rate_limit"("p_catch_id" "uuid", "p_rating" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."rate_catch_with_rate_limit"("p_catch_id" "uuid", "p_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."react_to_catch_with_rate_limit"("p_catch_id" "uuid", "p_reaction" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."react_to_catch_with_rate_limit"("p_catch_id" "uuid", "p_reaction" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_leaderboard"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_scores_mv;
END;
$$;


ALTER FUNCTION "public"."refresh_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_normalized_location"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.location_label IS NOT NULL THEN
        NEW.normalized_location = LOWER(NEW.location_label);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_normalized_location"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_rate_limits"() RETURNS TABLE("action" "text", "count" integer, "oldest_attempt" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        rl.action,
        COUNT(*)::INTEGER,
        MIN(rl.created_at)
    FROM rate_limits rl
    WHERE rl.user_id = auth.uid()
      AND rl.created_at >= NOW() - INTERVAL '2 hours'
    GROUP BY rl.action;
END;
$$;


ALTER FUNCTION "public"."user_rate_limits"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_rate_limits"() IS 'Get current user rate limit summary (last 2 hours)';



CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baits" (
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."baits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catch_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."catch_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catch_reactions" (
    "catch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "public"."reaction_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catch_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "location" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "species" "text",
    "weight" numeric,
    "weight_unit" "text",
    "length" numeric,
    "length_unit" "text",
    "time_of_day" "text",
    "peg_or_swim" "text",
    "conditions" "jsonb",
    "water_type" "text",
    "hide_exact_spot" boolean DEFAULT false NOT NULL,
    "bait_used" "text",
    "method" "text",
    "equipment_used" "text",
    "image_url" "text" NOT NULL,
    "gallery_photos" "text"[],
    "video_url" "text",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "allow_ratings" boolean DEFAULT true NOT NULL,
    "tags" "text"[],
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "caught_at" "date",
    "location_label" "text",
    "species_slug" "text",
    "custom_species" "text",
    "water_type_code" "text",
    "method_tag" "text",
    CONSTRAINT "chk_catches_length_positive" CHECK ((("length" IS NULL) OR ("length" > (0)::numeric))),
    CONSTRAINT "chk_catches_weight_positive" CHECK ((("weight" IS NULL) OR ("weight" > (0)::numeric)))
);


ALTER TABLE "public"."catches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text",
    "bio" "text",
    "avatar_path" "text",
    "avatar_url" "text",
    "location" "text",
    "website" "text",
    "status" "text",
    "warn_count" integer DEFAULT 0 NOT NULL,
    "moderation_status" "text" DEFAULT 'normal'::"text" NOT NULL,
    "suspension_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_profiles_username_length" CHECK ((("char_length"("username") >= 3) AND ("char_length"("username") <= 30)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ratings_value" CHECK ((("rating" >= (1)::numeric) AND ("rating" <= (10)::numeric)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_scores_detailed" AS
 SELECT "c"."id",
    "c"."user_id",
    "p"."username" AS "owner_username",
    "c"."title",
    COALESCE("c"."species_slug", "c"."species") AS "species_slug",
    "c"."species",
    "c"."weight",
    "c"."weight_unit",
    "c"."length",
    "c"."length_unit",
    "c"."image_url",
    COALESCE("avg"("r"."rating"), (0)::numeric) AS "avg_rating",
    ("count"("r"."id"))::integer AS "rating_count",
    ((COALESCE("avg"("r"."rating"), (0)::numeric) * (10)::numeric) + COALESCE("c"."weight", (0)::numeric)) AS "total_score",
    "c"."created_at",
    COALESCE("c"."location_label", "c"."location") AS "location_label",
    "c"."location",
    COALESCE("c"."method_tag", "c"."method") AS "method_tag",
    "c"."method",
    "c"."water_type_code",
    "c"."description",
    "c"."gallery_photos",
    "c"."tags",
    "c"."video_url",
    "c"."conditions",
    "c"."caught_at"
   FROM (("public"."catches" "c"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "c"."user_id")))
     LEFT JOIN "public"."ratings" "r" ON (("r"."catch_id" = "c"."id")))
  WHERE (("c"."deleted_at" IS NULL) AND ("c"."visibility" = 'public'::"text"))
  GROUP BY "c"."id", "c"."user_id", "p"."username", "c"."title", "c"."species_slug", "c"."species", "c"."weight", "c"."weight_unit", "c"."length", "c"."length_unit", "c"."image_url", "c"."created_at", "c"."location_label", "c"."location", "c"."method_tag", "c"."method", "c"."water_type_code", "c"."description", "c"."gallery_photos", "c"."tags", "c"."video_url", "c"."conditions", "c"."caught_at";


ALTER VIEW "public"."leaderboard_scores_detailed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action" "public"."mod_action" NOT NULL,
    "user_id" "uuid",
    "catch_id" "uuid",
    "comment_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."moderation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "public"."notification_type" NOT NULL,
    "message" "text" NOT NULL,
    "catch_id" "uuid",
    "comment_id" "uuid",
    "extra_data" "jsonb",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "venue" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "venue_name_manual" "text"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "method_group" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_warnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "issued_by" "uuid",
    "severity" "public"."warning_severity" DEFAULT 'warning'::"public"."warning_severity" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "duration_hours" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_warnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."water_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "group_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."water_types" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."baits"
    ADD CONSTRAINT "baits_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."catch_comments"
    ADD CONSTRAINT "catch_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catch_reactions"
    ADD CONSTRAINT "catch_reactions_pkey" PRIMARY KEY ("catch_id", "user_id");



ALTER TABLE ONLY "public"."catches"
    ADD CONSTRAINT "catches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_log"
    ADD CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_follows"
    ADD CONSTRAINT "profile_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_follows"
    ADD CONSTRAINT "profile_follows_unique" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_unique" UNIQUE ("catch_id", "user_id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."user_warnings"
    ADD CONSTRAINT "user_warnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."water_types"
    ADD CONSTRAINT "water_types_pkey" PRIMARY KEY ("code");



CREATE INDEX "idx_catch_comments_catch_created" ON "public"."catch_comments" USING "btree" ("catch_id", "created_at");



CREATE INDEX "idx_catch_comments_user" ON "public"."catch_comments" USING "btree" ("user_id");



CREATE INDEX "idx_catch_reactions_catch" ON "public"."catch_reactions" USING "btree" ("catch_id");



CREATE INDEX "idx_catch_reactions_user" ON "public"."catch_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_catches_created_deleted_visibility" ON "public"."catches" USING "btree" ("created_at", "deleted_at", "visibility");



CREATE INDEX "idx_catches_session_id" ON "public"."catches" USING "btree" ("session_id");



CREATE INDEX "idx_catches_user_id" ON "public"."catches" USING "btree" ("user_id");



CREATE INDEX "idx_moderation_log_catch_created" ON "public"."moderation_log" USING "btree" ("catch_id", "created_at" DESC);



CREATE INDEX "idx_moderation_log_created" ON "public"."moderation_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_moderation_log_user_created" ON "public"."moderation_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_catch" ON "public"."notifications" USING "btree" ("catch_id");



CREATE INDEX "idx_notifications_comment" ON "public"."notifications" USING "btree" ("comment_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_profile_follows_follower" ON "public"."profile_follows" USING "btree" ("follower_id");



CREATE INDEX "idx_profile_follows_following" ON "public"."profile_follows" USING "btree" ("following_id");



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "idx_rate_limits_user_action_created" ON "public"."rate_limits" USING "btree" ("user_id", "action", "created_at" DESC);



CREATE INDEX "idx_ratings_catch" ON "public"."ratings" USING "btree" ("catch_id");



CREATE INDEX "idx_ratings_user" ON "public"."ratings" USING "btree" ("user_id");



CREATE INDEX "idx_reports_reporter_created" ON "public"."reports" USING "btree" ("reporter_id", "created_at" DESC);



CREATE INDEX "idx_reports_status_created" ON "public"."reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_reports_target" ON "public"."reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_sessions_user_date" ON "public"."sessions" USING "btree" ("user_id", "date");



CREATE INDEX "idx_user_warnings_issuer_created" ON "public"."user_warnings" USING "btree" ("issued_by", "created_at" DESC);



CREATE INDEX "idx_user_warnings_user_created" ON "public"."user_warnings" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "trg_catch_comments_set_updated_at" BEFORE UPDATE ON "public"."catch_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_catches_set_updated_at" BEFORE UPDATE ON "public"."catches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sessions_set_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catch_comments"
    ADD CONSTRAINT "catch_comments_catch_id_fkey" FOREIGN KEY ("catch_id") REFERENCES "public"."catches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catch_comments"
    ADD CONSTRAINT "catch_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."catch_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catch_comments"
    ADD CONSTRAINT "catch_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catch_reactions"
    ADD CONSTRAINT "catch_reactions_catch_id_fkey" FOREIGN KEY ("catch_id") REFERENCES "public"."catches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catch_reactions"
    ADD CONSTRAINT "catch_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catches"
    ADD CONSTRAINT "catches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catches"
    ADD CONSTRAINT "catches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_log"
    ADD CONSTRAINT "moderation_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_log"
    ADD CONSTRAINT "moderation_log_catch_id_fkey" FOREIGN KEY ("catch_id") REFERENCES "public"."catches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_log"
    ADD CONSTRAINT "moderation_log_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."catch_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."moderation_log"
    ADD CONSTRAINT "moderation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_catch_id_fkey" FOREIGN KEY ("catch_id") REFERENCES "public"."catches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."catch_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_follows"
    ADD CONSTRAINT "profile_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_follows"
    ADD CONSTRAINT "profile_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_catch_id_fkey" FOREIGN KEY ("catch_id") REFERENCES "public"."catches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_warnings"
    ADD CONSTRAINT "user_warnings_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_warnings"
    ADD CONSTRAINT "user_warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete any catch" ON "public"."catches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can insert moderation log" ON "public"."moderation_log" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage all catches" ON "public"."catches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage all comments" ON "public"."catch_comments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage all follow relationships" ON "public"."profile_follows" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage all ratings" ON "public"."ratings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage all reactions" ON "public"."catch_reactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can update all reports" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can update any comment" ON "public"."catch_comments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view all catches" ON "public"."catches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view all rate limits" ON "public"."rate_limits" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view all reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view moderation log" ON "public"."moderation_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view their own admin row" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Admins manage user warnings" ON "public"."user_warnings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."user_id" = "auth"."uid"()))));



CREATE POLICY "Baits are readable by everyone" ON "public"."baits" FOR SELECT USING (true);



CREATE POLICY "Comments are viewable by authenticated users" ON "public"."catch_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Follow relationships are viewable by authenticated users" ON "public"."profile_follows" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Profiles are viewable by anyone" ON "public"."profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public catches are viewable by others" ON "public"."catches" FOR SELECT USING ((("deleted_at" IS NULL) AND ("visibility" = ANY (ARRAY['public'::"text", 'followers'::"text"]))));



CREATE POLICY "Ratings are viewable by authenticated users" ON "public"."ratings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Reactions are viewable by authenticated users" ON "public"."catch_reactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can view admin users" ON "public"."admin_users" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role manages admin users" ON "public"."admin_users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages baits" ON "public"."baits" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages tags" ON "public"."tags" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages water types" ON "public"."water_types" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Tags are readable by everyone" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "Users can add reactions" ON "public"."catch_reactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create comments" ON "public"."catch_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create follow relationships" ON "public"."profile_follows" FOR INSERT TO "authenticated" WITH CHECK (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own catches" ON "public"."catches" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own comments" ON "public"."catch_comments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own sessions" ON "public"."sessions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own catches" ON "public"."catches" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own sessions" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their rate limits" ON "public"."rate_limits" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their ratings" ON "public"."ratings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can remove their own follow relationships" ON "public"."profile_follows" FOR DELETE TO "authenticated" USING (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can remove their reactions" ON "public"."catch_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can submit reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "Users can update their notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own catches" ON "public"."catches" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own comments" ON "public"."catch_comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their own sessions" ON "public"."sessions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own catches" ON "public"."catches" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their rate limits" ON "public"."rate_limits" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their reports" ON "public"."reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



CREATE POLICY "Users can view their warnings" ON "public"."user_warnings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Water types are readable by everyone" ON "public"."water_types" FOR SELECT USING (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."baits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catch_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catch_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_warnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."water_types" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."admin_delete_catch"("p_catch_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_catch"("p_catch_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_delete_comment"("p_comment_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_comment"("p_comment_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_restore_catch"("p_catch_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_restore_catch"("p_catch_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_restore_comment"("p_comment_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_restore_comment"("p_comment_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_warn_user"("p_user_id" "uuid", "p_reason" "text", "p_severity" "public"."warning_severity", "p_duration_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_warn_user"("p_user_id" "uuid", "p_reason" "text", "p_severity" "public"."warning_severity", "p_duration_hours" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."cleanup_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rate_limits"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_comment_with_rate_limit"("p_catch_id" "uuid", "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_comment_with_rate_limit"("p_catch_id" "uuid", "p_body" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_message" "text", "p_type" "public"."notification_type", "p_actor_id" "uuid", "p_catch_id" "uuid", "p_comment_id" "uuid", "p_extra_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_message" "text", "p_type" "public"."notification_type", "p_actor_id" "uuid", "p_catch_id" "uuid", "p_comment_id" "uuid", "p_extra_data" "jsonb") TO "authenticated";



GRANT SELECT ON TABLE "public"."reports" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."reports" TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_report_with_rate_limit"("p_target_type" "public"."report_target_type", "p_target_id" "uuid", "p_reason" "text", "p_details" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_report_with_rate_limit"("p_target_type" "public"."report_target_type", "p_target_id" "uuid", "p_reason" "text", "p_details" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."enforce_catch_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_catch_rate_limit"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."enforce_comment_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_comment_rate_limit"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."enforce_report_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_report_rate_limit"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."follow_profile_with_rate_limit"("p_following_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."follow_profile_with_rate_limit"("p_following_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_rate_limit_status"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_rate_limit_status"("p_user_id" "uuid", "p_action" "text", "p_max_attempts" integer, "p_window_minutes" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."notify_admins"("p_message" "text", "p_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins"("p_message" "text", "p_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_admins"("p_message" "text", "p_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_admins"("p_report_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_admins"("p_report_id" "uuid", "p_message" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rate_catch_with_rate_limit"("p_catch_id" "uuid", "p_rating" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rate_catch_with_rate_limit"("p_catch_id" "uuid", "p_rating" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."react_to_catch_with_rate_limit"("p_catch_id" "uuid", "p_reaction" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."react_to_catch_with_rate_limit"("p_catch_id" "uuid", "p_reaction" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_normalized_location"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_normalized_location"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_normalized_location"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_rate_limits"() TO "authenticated";


















GRANT SELECT ON TABLE "public"."admin_users" TO "anon";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";



GRANT SELECT ON TABLE "public"."baits" TO "anon";
GRANT SELECT ON TABLE "public"."baits" TO "authenticated";



GRANT SELECT ON TABLE "public"."catch_comments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."catch_comments" TO "authenticated";



GRANT SELECT ON TABLE "public"."catch_reactions" TO "anon";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."catch_reactions" TO "authenticated";



GRANT SELECT ON TABLE "public"."catches" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."catches" TO "authenticated";



GRANT SELECT ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT ON TABLE "public"."ratings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ratings" TO "authenticated";



GRANT SELECT ON TABLE "public"."leaderboard_scores_detailed" TO "anon";
GRANT SELECT ON TABLE "public"."leaderboard_scores_detailed" TO "authenticated";



GRANT SELECT ON TABLE "public"."moderation_log" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."moderation_log" TO "authenticated";



GRANT SELECT ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,DELETE,UPDATE ON TABLE "public"."notifications" TO "authenticated";



GRANT SELECT ON TABLE "public"."profile_follows" TO "anon";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."profile_follows" TO "authenticated";



GRANT SELECT ON TABLE "public"."rate_limits" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."rate_limits" TO "authenticated";



GRANT SELECT ON TABLE "public"."sessions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sessions" TO "authenticated";



GRANT SELECT ON TABLE "public"."tags" TO "anon";
GRANT SELECT ON TABLE "public"."tags" TO "authenticated";



GRANT SELECT ON TABLE "public"."user_warnings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_warnings" TO "authenticated";



GRANT SELECT ON TABLE "public"."water_types" TO "anon";
GRANT SELECT ON TABLE "public"."water_types" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "authenticated";




























