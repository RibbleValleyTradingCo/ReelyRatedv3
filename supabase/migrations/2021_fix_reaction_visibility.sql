-- 2021_fix_reaction_visibility.sql
-- Purpose: Allow users to see reaction counts on catches they can view (owner/admin/public/followers).

SET search_path = public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'catch_reactions_select_viewable'
  ) THEN
    CREATE POLICY catch_reactions_select_viewable ON public.catch_reactions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.catches c
          WHERE c.id = catch_id
            AND c.deleted_at IS NULL
            AND (
              -- Catch owner can see all reactions on their catches
              c.user_id = auth.uid()
              -- Public catches are viewable by anyone authenticated
              OR c.visibility = 'public'
              -- Followers-only catches viewable if follower
              OR (
                c.visibility = 'followers'
                AND auth.uid() IS NOT NULL
                AND public.is_following(auth.uid(), c.user_id)
              )
              -- Admin override (admins see all)
              OR public.is_admin(auth.uid())
            )
        )
      );
  END IF;
END;
$$;
