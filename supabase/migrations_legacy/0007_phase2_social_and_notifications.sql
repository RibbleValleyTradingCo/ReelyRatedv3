-- Phase 2 social + notifications tables

----------------------------
-- profile_follows
----------------------------
CREATE TABLE IF NOT EXISTS public.profile_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profile_follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_follows_follower ON public.profile_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_profile_follows_following ON public.profile_follows (following_id);

ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follow relationships are viewable by authenticated users"
    ON public.profile_follows
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create follow relationships"
    ON public.profile_follows
    FOR INSERT
    TO authenticated
    WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can remove their own follow relationships"
    ON public.profile_follows
    FOR DELETE
    TO authenticated
    USING (follower_id = auth.uid());

CREATE POLICY "Admins can manage all follow relationships"
    ON public.profile_follows
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.profile_follows TO authenticated;

----------------------------
-- catch_comments
----------------------------
CREATE TABLE IF NOT EXISTS public.catch_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID NULL REFERENCES public.catch_comments(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_catch_comments_catch_created ON public.catch_comments (catch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_catch_comments_user ON public.catch_comments (user_id);

CREATE TRIGGER trg_catch_comments_set_updated_at
    BEFORE UPDATE ON public.catch_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.catch_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by authenticated users"
    ON public.catch_comments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create comments"
    ON public.catch_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments"
    ON public.catch_comments
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
    ON public.catch_comments
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all comments"
    ON public.catch_comments
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catch_comments TO authenticated;

----------------------------
-- catch_reactions
----------------------------
CREATE TABLE IF NOT EXISTS public.catch_reactions (
    catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction public.reaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (catch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_catch_reactions_catch ON public.catch_reactions (catch_id);
CREATE INDEX IF NOT EXISTS idx_catch_reactions_user ON public.catch_reactions (user_id);

ALTER TABLE public.catch_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are viewable by authenticated users"
    ON public.catch_reactions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can add reactions"
    ON public.catch_reactions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their reactions"
    ON public.catch_reactions
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all reactions"
    ON public.catch_reactions
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.catch_reactions TO authenticated;

----------------------------
-- ratings
----------------------------
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ratings_unique UNIQUE (catch_id, user_id),
    CONSTRAINT ratings_value CHECK (rating >= 1 AND rating <= 10)
);

CREATE INDEX IF NOT EXISTS idx_ratings_catch ON public.ratings (catch_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON public.ratings (user_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by authenticated users"
    ON public.ratings
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage their ratings"
    ON public.ratings
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all ratings"
    ON public.ratings
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;

----------------------------
-- notifications
----------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    type public.notification_type NOT NULL,
    message TEXT NOT NULL,
    catch_id UUID NULL REFERENCES public.catches(id) ON DELETE CASCADE,
    comment_id UUID NULL REFERENCES public.catch_comments(id) ON DELETE CASCADE,
    extra_data JSONB NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_catch ON public.notifications (catch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_comment ON public.notifications (comment_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
