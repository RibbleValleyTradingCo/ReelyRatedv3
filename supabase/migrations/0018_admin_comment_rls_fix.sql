-- Ensure admins can update any comment for moderation RPCs

ALTER TABLE public.catch_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'catch_comments'
          AND policyname = 'Admins can update any comment'
    ) THEN
        CREATE POLICY "Admins can update any comment"
            ON public.catch_comments
            FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.admin_users au
                    WHERE au.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.admin_users au
                    WHERE au.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Summary: add explicit admin UPDATE policy on catch_comments so moderation RPCs can modify rows
