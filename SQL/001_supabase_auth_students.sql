-- ==============================================
-- Supabase Auth Integration for Students
-- ==============================================
-- IMPORTANT:
-- 1) Run this in Supabase SQL Editor.
-- 2) BACKUP your current `users.password` column
--    before dropping it (not done here).
-- 3) This keeps existing `public.users` schema usable.

-- --- 1) Add auth linkage column ---
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- --- 2) (Optional but recommended) Disable legacy password usage ---
-- We are NOT dropping the password column automatically to keep backward compatibility.
-- You can drop it later after migration/testing.
-- ALTER TABLE public.users DROP COLUMN IF EXISTS password;

-- --- 3) Trigger: when an auth user is created, link to public.users profile ---
-- Expected auth metadata keys:
--   full_name, username, role, is_active
--   (set by js/admin/student-manager.js)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create/update if metadata contains username
  IF (NEW.raw_user_meta_data->>'username') IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create or update corresponding public.users row.
  -- We rely on existing unique constraint on username (if any).
  INSERT INTO public.users (
    auth_user_id,
    username,
    full_name,
    role,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
  )
  ON CONFLICT (username)
  DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    full_name    = EXCLUDED.full_name,
    role         = EXCLUDED.role,
    is_active    = EXCLUDED.is_active;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- --- 4) RLS notes ---
-- If Row Level Security is enabled on public.users, ensure policies allow:
--  - admins to manage users
--  - students to read their own profile (by auth_user_id)
-- This SQL does not create policies because it depends on your current RLS setup.

