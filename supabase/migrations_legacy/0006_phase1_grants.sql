-- Ensure anon and authenticated roles can use the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Lookup tables: world-readable
GRANT SELECT ON TABLE public.baits TO anon, authenticated;
GRANT SELECT ON TABLE public.tags TO anon, authenticated;
GRANT SELECT ON TABLE public.water_types TO anon, authenticated;

-- Profiles: readable by all, writable by authenticated users only
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- Sessions: CRUD via authenticated users (RLS enforces ownership)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;

-- Catches: CRUD via authenticated users (RLS enforces ownership/visibility)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catches TO authenticated;
