-- Debug User Profiles
-- Run this to check the current state of user profiles

-- 1. Check all users in auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check all user profiles
SELECT 
  id,
  full_name,
  email,
  phone_number,
  is_approved,
  created_at
FROM public.user_profiles
ORDER BY created_at DESC;

-- 3. Find users without profiles
SELECT 
  au.id,
  au.email,
  au.created_at,
  'Missing Profile' as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.created_at DESC;

-- 4. Check RLS policies on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- 5. Test if current user can insert (run this while logged in)
-- SELECT auth.uid() as current_user_id;

-- 6. Create missing profiles for existing users
-- Uncomment to run:
-- INSERT INTO public.user_profiles (id, full_name, email, phone_number, is_approved)
-- SELECT 
--   au.id,
--   COALESCE(au.raw_user_meta_data->>'full_name', ''),
--   au.email,
--   COALESCE(au.raw_user_meta_data->>'phone_number', ''),
--   false
-- FROM auth.users au
-- LEFT JOIN public.user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL;
