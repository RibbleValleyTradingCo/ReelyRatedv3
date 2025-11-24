-- 1004_policies_and_grants.sql
-- Covers: RLS enables/policies, key grants from MAIN.

SET search_path = public, extensions;

-- Enable RLS
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catch_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catch_reactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_follows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_types       ENABLE ROW LEVEL SECURITY;

-- Policies
DO $policies$
BEGIN
  -- Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_all') THEN
    CREATE POLICY profiles_select_all ON public.profiles
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_self') THEN
    CREATE POLICY profiles_update_self ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  -- Sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_select_own') THEN
    CREATE POLICY sessions_select_own ON public.sessions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_modify_own') THEN
    CREATE POLICY sessions_modify_own ON public.sessions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Catches
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catches_public_read') THEN
    CREATE POLICY catches_public_read ON public.catches
      FOR SELECT USING (deleted_at IS NULL AND visibility = 'public');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catches_owner_all') THEN
    CREATE POLICY catches_owner_all ON public.catches
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Comments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_public_read') THEN
    CREATE POLICY catch_comments_public_read ON public.catch_comments
      FOR SELECT USING (deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_comments_owner_all') THEN
    CREATE POLICY catch_comments_owner_all ON public.catch_comments
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Reactions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'catch_reactions_owner_all') THEN
    CREATE POLICY catch_reactions_owner_all ON public.catch_reactions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Ratings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ratings_owner_all') THEN
    CREATE POLICY ratings_owner_all ON public.ratings
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Follows
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profile_follows_owner_all') THEN
    CREATE POLICY profile_follows_owner_all ON public.profile_follows
      FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);
  END IF;

  -- Notifications
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_recipient_only') THEN
    CREATE POLICY notifications_recipient_only ON public.notifications
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reports_owner_all') THEN
    CREATE POLICY reports_owner_all ON public.reports
      FOR ALL USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);
  END IF;

  -- Rate limits
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rate_limits_owner_all') THEN
    CREATE POLICY rate_limits_owner_all ON public.rate_limits
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Lookups (readable by all)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'baits_select_all') THEN
    CREATE POLICY baits_select_all ON public.baits FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tags_select_all') THEN
    CREATE POLICY tags_select_all ON public.tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'water_types_select_all') THEN
    CREATE POLICY water_types_select_all ON public.water_types FOR SELECT USING (true);
  END IF;
END;
$policies$;

-- Storage: catches bucket with public read and owner-only write
INSERT INTO storage.buckets (id, name, public)
VALUES ('catches', 'catches', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read objects in the catches bucket
DROP POLICY IF EXISTS "Public read access to catches" ON storage.objects;
CREATE POLICY "Public read access to catches"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'catches');

-- Authenticated users can manage only their own objects in the catches bucket
DROP POLICY IF EXISTS "Users can manage own catches" ON storage.objects;
CREATE POLICY "Users can manage own catches"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'catches' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'catches');

-- Grants (idempotent)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.sessions, public.catches, public.catch_comments, public.catch_reactions,
  public.ratings, public.profile_follows, public.notifications, public.reports,
  public.rate_limits TO authenticated;
GRANT SELECT ON public.baits, public.tags, public.water_types TO anon, authenticated;

-- handle_new_user grants
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
