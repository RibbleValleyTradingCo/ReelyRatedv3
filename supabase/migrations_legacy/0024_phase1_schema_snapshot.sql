-- Promotes the archived Phase 1 schema into a numbered migration.
-- Idempotent: only creates tables, indexes, function, and triggers if missing.

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    bio TEXT,
    avatar_path TEXT,
    avatar_url TEXT,
    location TEXT,
    website TEXT,
    status TEXT,
    warn_count INTEGER NOT NULL DEFAULT 0,
    moderation_status TEXT NOT NULL DEFAULT 'normal',
    suspension_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30)
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    venue TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON public.sessions (user_id, date);

CREATE TABLE IF NOT EXISTS public.catches (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    location TEXT,
    title TEXT NOT NULL,
    description TEXT,
    species TEXT,
    weight NUMERIC,
    weight_unit TEXT,
    length NUMERIC,
    length_unit TEXT,
    time_of_day TEXT,
    peg_or_swim TEXT,
    conditions JSONB,
    water_type TEXT,
    hide_exact_spot BOOLEAN NOT NULL DEFAULT false,
    bait_used TEXT,
    method TEXT,
    equipment_used TEXT,
    image_url TEXT NOT NULL,
    gallery_photos TEXT[],
    video_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'public',
    allow_ratings BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_catches_weight_positive CHECK (weight IS NULL OR weight > 0),
    CONSTRAINT chk_catches_length_positive CHECK (length IS NULL OR length > 0)
);

CREATE INDEX IF NOT EXISTS idx_catches_user_id ON public.catches (user_id);
CREATE INDEX IF NOT EXISTS idx_catches_session_id ON public.catches (session_id);
CREATE INDEX IF NOT EXISTS idx_catches_created_deleted_visibility ON public.catches (created_at, deleted_at, visibility);

CREATE TABLE IF NOT EXISTS public.baits (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    method_group TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.water_types (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    group_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_profiles_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_profiles_set_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_sessions_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_sessions_set_updated_at
            BEFORE UPDATE ON public.sessions
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_catches_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_catches_set_updated_at
            BEFORE UPDATE ON public.catches
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END;
$$;
