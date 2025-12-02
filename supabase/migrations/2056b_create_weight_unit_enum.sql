-- 2056b_create_weight_unit_enum.sql
-- Ensure weight_unit enum exists before venue RPCs reference it

SET search_path = public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'weight_unit'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.weight_unit AS ENUM ('kg', 'lb_oz');
  END IF;
END
$$;
