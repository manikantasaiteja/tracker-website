-- Migration: Add Admin Approval System
-- Run this migration if you already have the base schema in place
-- This adds admin functionality and user approval workflow

-- ============================================
-- 1. Create admins table
-- ============================================

create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admins enable row level security;

create policy "Admins can read admin table"
on public.admins
for select
using (auth.uid() = id);

-- ============================================
-- 2. Add approval fields to user_profiles
-- ============================================

-- Add email column to user_profiles for easier access
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Add new columns for approval workflow
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean not null default false;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS approved_by uuid references public.admins(id);

-- ============================================
-- 3. Create function to sync email from auth.users
-- ============================================

-- Function to get email from auth.users (only callable by authenticated users for their own data or by admins)
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
BEGIN
  -- Check if caller is admin or requesting their own email
  IF NOT (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
  ) THEN
    RETURN NULL;
  END IF;
  
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN user_email;
END;
$$;

-- ============================================
-- 4. Create trigger to auto-create user profiles
-- ============================================

-- Function to automatically create user profile when user signs up
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
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. Add RLS policies for admin access
-- ============================================

-- Allow admins to read all user profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
create policy "Admins can read all profiles"
on public.user_profiles
for select
using (exists (select 1 from public.admins where id = auth.uid()));

-- Allow admins to update all user profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
create policy "Admins can update all profiles"
on public.user_profiles
for update
using (exists (select 1 from public.admins where id = auth.uid()));

-- ============================================
-- 6. Update existing user_profiles with emails
-- ============================================

-- Sync emails from auth.users to user_profiles
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND up.email IS NULL;

-- ============================================
-- 7. (Optional) Auto-approve existing users
-- ============================================

-- Uncomment the line below if you want to auto-approve all existing users
-- This prevents existing users from being locked out after migration

-- UPDATE public.user_profiles
-- SET is_approved = true, approved_at = now()
-- WHERE is_approved = false;

-- ============================================
-- 8. Verification queries
-- ============================================

-- Run these to verify the migration was successful:

-- Check if admins table exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'admins'
-- );

-- Check if new columns were added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_profiles'
-- AND column_name IN ('email', 'is_approved', 'approved_at', 'approved_by');

-- Check RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('admins', 'user_profiles')
-- ORDER BY tablename, policyname;
