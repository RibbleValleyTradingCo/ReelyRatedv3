-- Creates/refreshes the hook that mirrors auth.users into public.profiles
-- Run this after phase1_migration.sql and the RLS migration.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_username TEXT;
  cleaned_username TEXT;
  final_username TEXT;
  suffix_counter INTEGER := 0;
  max_length CONSTANT INTEGER := 30;
  min_length CONSTANT INTEGER := 3;
BEGIN
  -- Derive a starting point from the email prefix when available
  IF NEW.email IS NOT NULL THEN
    base_username := split_part(lower(NEW.email), '@', 1);
  END IF;

  IF base_username IS NULL OR length(base_username) < min_length THEN
    base_username := 'angler';
  END IF;

  -- Keep only [a-z0-9_]
  cleaned_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');

  -- Ensure minimum length by padding with user id pieces if needed
  IF length(cleaned_username) < min_length THEN
    cleaned_username := cleaned_username || substring(NEW.id::text, 1, min_length - length(cleaned_username));
  END IF;

  -- Trim to max length
  cleaned_username := left(cleaned_username, max_length);

  final_username := cleaned_username;

  -- Ensure uniqueness; append deterministic suffixes if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix_counter := suffix_counter + 1;
    final_username :=
      left(cleaned_username, max_length - 5) || '_' ||
      substring(md5(NEW.id::text || suffix_counter::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
