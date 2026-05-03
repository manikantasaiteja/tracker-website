-- Fix Existing Data: Sync emails and check approval status
-- Run this if you have existing users without emails in user_profiles

-- ============================================
-- 1. Add email column if it doesn't exist
-- ============================================

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- ============================================
-- 2. Sync emails from auth.users to user_profiles
-- ============================================

UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND (up.email IS NULL OR up.email = '');

-- ============================================
-- 3. Check current approval status
-- ============================================

-- View all users and their approval status
SELECT 
  up.id,
  up.full_name,
  up.email,
  up.is_approved,
  up.approved_at,
  up.created_at,
  CASE 
    WHEN up.is_approved THEN 'Approved'
    ELSE 'Pending'
  END as status
FROM public.user_profiles up
ORDER BY up.created_at DESC;

-- ============================================
-- 4. (Optional) Auto-approve all existing users
-- ============================================

-- Uncomment to approve all users at once
-- UPDATE public.user_profiles
-- SET is_approved = true, approved_at = now()
-- WHERE is_approved = false;

-- ============================================
-- 5. Verify the fix
-- ============================================

-- Check for users without emails
SELECT COUNT(*) as users_without_email
FROM public.user_profiles
WHERE email IS NULL OR email = '';

-- Check pending vs approved users
SELECT 
  is_approved,
  COUNT(*) as count
FROM public.user_profiles
GROUP BY is_approved;
