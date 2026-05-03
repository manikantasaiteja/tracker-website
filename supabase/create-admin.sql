-- Create Admin User Script
-- 
-- Instructions:
-- 1. First, create a user account through the normal registration flow
-- 2. Get the user's UUID from Supabase Dashboard > Authentication > Users
-- 3. Replace 'USER_UUID_HERE' and 'admin@example.com' below with actual values
-- 4. Run this script in Supabase SQL Editor

-- Add user to admins table
INSERT INTO public.admins (id, email)
VALUES ('USER_UUID_HERE', 'admin@example.com')
ON CONFLICT (id) DO NOTHING;

-- Approve the admin user so they can access the platform
UPDATE public.user_profiles
SET 
  is_approved = true,
  approved_at = now()
WHERE id = 'USER_UUID_HERE';

-- Verify the admin was created successfully
SELECT 
  a.id,
  a.email,
  up.full_name,
  up.is_approved,
  up.approved_at
FROM public.admins a
LEFT JOIN public.user_profiles up ON a.id = up.id
WHERE a.id = 'USER_UUID_HERE';
