-- Quick Fix: Add email column to user_profiles
-- Run this in Supabase SQL Editor NOW to fix the error

-- Add email column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Sync emails from auth.users to user_profiles for existing users
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND (up.email IS NULL OR up.email = '');

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'email';

-- Check if emails were synced
SELECT id, full_name, email, is_approved
FROM public.user_profiles
LIMIT 5;
