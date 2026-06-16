-- ==============================================
-- Migrate existing students (legacy password users table)
-- into Supabase Auth users.
-- ==============================================
-- REQUIREMENTS / LIMITATIONS:
-- - Supabase Auth is managed via RPC/admin API; plain SQL cannot create auth.users
--   using only SQL in the standard Supabase setup.
-- - However, Supabase provides an auth.admin API (service role) via SQL functions
--   only in certain configurations.
--
-- This script provides a safe, practical migration approach:
-- 1) Create a temporary mapping table (optional).
-- 2) Export students and create auth users via external script.
--
-- Because this environment is GitHub Pages (client-side),
-- the real migration must be done server-side or with Supabase service role.
--
-- If you want a purely-SQL solution, you must enable a trusted function
-- that can call auth.admin API.

-- --- Step A: Ensure auth_user_id column exists ---
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- --- Step B: (Recommended) Mark legacy accounts for migration ---
-- No-op by default.
--
-- SELECT id, username FROM public.users WHERE role='student';

-- --- Step C: Create a view for migration ---
CREATE OR REPLACE VIEW public.v_students_for_auth_migration AS
SELECT
  id as legacy_user_id,
  username,
  full_name,
  is_active,
  -- WARNING: password is legacy plaintext. Backup before doing anything.
  password AS legacy_password
FROM public.users
WHERE role = 'student';

-- --- Step D: Migration using external script (recommended) ---
-- Use Supabase Admin SDK with a service role key to:
--  - iterate over v_students_for_auth_migration
--  - call auth.admin.createUser({ email, password, user_metadata })
--  - set user_metadata: { full_name, username, role:'student', is_active }
--  - rely on trigger public.handle_new_user() to populate public.users
--
-- After creating auth users, you can optionally:
--  - clear legacy passwords after confirming login works
--  - drop the password column

-- --- Step E: Quick sanity checks ---
-- SELECT COUNT(*) FROM auth.users WHERE raw_app_meta_data->>'role'='student';
-- SELECT COUNT(*) FROM public.users WHERE auth_user_id IS NOT NULL;

