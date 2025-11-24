-- Phase 1 RLS policies based on ERD.md

-- Enable Row Level Security on core and lookup tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_types ENABLE ROW LEVEL SECURITY;

-- Helper expression is inlined for each policy:
-- EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admin users policies
CREATE POLICY "Admins can view their own admin row"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can view admin users"
    ON public.admin_users
    FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Service role manages admin users"
    ON public.admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Sessions policies (owner-only CRUD)
CREATE POLICY "Users can view their own sessions"
    ON public.sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own sessions"
    ON public.sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
    ON public.sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
    ON public.sessions
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Catches policies
CREATE POLICY "Users can view their own catches"
    ON public.catches
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Public catches are viewable by others"
    ON public.catches
    FOR SELECT
    TO public
    USING (deleted_at IS NULL AND visibility IN ('public', 'followers'));

CREATE POLICY "Admins can view all catches"
    ON public.catches
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Users can insert their own catches"
    ON public.catches
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own catches"
    ON public.catches
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all catches"
    ON public.catches
    FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Users can delete their own catches"
    ON public.catches
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can delete any catch"
    ON public.catches
    FOR DELETE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Lookup tables are world-readable; writes are locked to service role
CREATE POLICY "Baits are readable by everyone"
    ON public.baits
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Tags are readable by everyone"
    ON public.tags
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Water types are readable by everyone"
    ON public.water_types
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Service role manages baits"
    ON public.baits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role manages tags"
    ON public.tags
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role manages water types"
    ON public.water_types
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
