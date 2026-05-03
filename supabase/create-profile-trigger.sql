-- Create Database Trigger to Auto-Create User Profiles
-- This trigger automatically creates a user_profiles entry when a new user signs up

-- ============================================
-- 1. Create the trigger function
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new profile for the user
  INSERT INTO public.user_profiles (
    id,
    full_name,
    email,
    phone_number,
    is_approved,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    false,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Create the trigger
-- ============================================

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. Verification
-- ============================================

-- Check if the trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';

-- ============================================
-- 4. Test the trigger (optional)
-- ============================================

-- To test, create a test user through Supabase Auth
-- Then check if the profile was created:
-- SELECT * FROM public.user_profiles ORDER BY created_at DESC LIMIT 1;

-- ============================================
-- 5. Create profiles for existing users (if needed)
-- ============================================

-- Uncomment to create profiles for users that don't have one yet:
-- INSERT INTO public.user_profiles (id, full_name, email, phone_number, is_approved, created_at, updated_at)
-- SELECT 
--   au.id,
--   COALESCE(au.raw_user_meta_data->>'full_name', ''),
--   au.email,
--   COALESCE(au.raw_user_meta_data->>'phone_number', ''),
--   false,
--   au.created_at,
--   NOW()
-- FROM auth.users au
-- LEFT JOIN public.user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL;
