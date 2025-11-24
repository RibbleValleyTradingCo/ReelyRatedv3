-- Add admin moderation notification types

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'notification_type'
          AND e.enumlabel = 'admin_warning'
    ) THEN
        ALTER TYPE public.notification_type ADD VALUE 'admin_warning';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'notification_type'
          AND e.enumlabel = 'admin_moderation'
    ) THEN
        ALTER TYPE public.notification_type ADD VALUE 'admin_moderation';
    END IF;
END $$;

-- Summary: extend notification_type enum with admin_warning/admin_moderation
