-- 2022_fix_reaction_select_visibility.sql
-- Purpose: Allow viewing reaction counts on catches a user can view (owner/public/followers/admin), without changing insert/update/delete ownership rules.

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
              c.user_id = auth.uid() -- owner
              OR c.visibility = 'public' -- public
              OR (
                c.visibility = 'followers'
                AND auth.uid() IS NOT NULL
                AND public.is_following(auth.uid(), c.user_id)
              ) -- followers-only, follower
              OR public.is_admin(auth.uid()) -- admin override
            )
        )
      );
  END IF;
END;
$$;
