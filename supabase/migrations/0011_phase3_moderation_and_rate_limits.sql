-- Phase 3 moderation/reporting tables and rate limit log

----------------------------
-- reports
----------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type public.report_target_type NOT NULL,
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NULL,
    status public.report_status NOT NULL DEFAULT 'open',
    reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports (target_type, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports"
    ON public.reports
    FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view their reports"
    ON public.reports
    FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports"
    ON public.reports
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Admins can update all reports"
    ON public.reports
    FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;

----------------------------
-- user_warnings
----------------------------
CREATE TABLE IF NOT EXISTS public.user_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    severity public.warning_severity NOT NULL DEFAULT 'warning',
    reason TEXT NOT NULL,
    details TEXT NULL,
    duration_hours INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user_created ON public.user_warnings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_warnings_issuer_created ON public.user_warnings (issued_by, created_at DESC);

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user warnings"
    ON public.user_warnings
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Users can view their warnings"
    ON public.user_warnings
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_warnings TO authenticated;

----------------------------
-- moderation_log
----------------------------
CREATE TABLE IF NOT EXISTS public.moderation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action public.mod_action NOT NULL,
    user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    catch_id UUID NULL REFERENCES public.catches(id) ON DELETE SET NULL,
    comment_id UUID NULL REFERENCES public.catch_comments(id) ON DELETE SET NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON public.moderation_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_user_created ON public.moderation_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_catch_created ON public.moderation_log (catch_id, created_at DESC);

ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation log"
    ON public.moderation_log
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Admins can insert moderation log"
    ON public.moderation_log
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT ON public.moderation_log TO authenticated;

----------------------------
-- rate_limits
----------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_created
    ON public.rate_limits (user_id, action, created_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their rate limits"
    ON public.rate_limits
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all rate limits"
    ON public.rate_limits
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT ON public.rate_limits TO authenticated;

-- Summary: Phase 3 moderation tables (reports, warnings, mod log, rate limits) with RLS
