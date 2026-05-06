-- Setup Resume Storage for Profile Page
-- Run this script in your Supabase SQL Editor if resume uploads are not working

-- 1. Add resume fields to user_profiles table (if not exists)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS resume_file_name TEXT,
ADD COLUMN IF NOT EXISTS resume_file_url TEXT,
ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ;

-- 2. Create storage bucket for user resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resume" ON storage.objects;

-- 4. Create storage policies for resumes
CREATE POLICY "Users can upload their own resume"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own resume"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own resume"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own resume"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Verify setup
SELECT 
  'Bucket created' as status,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'resumes';

SELECT 
  'Policies created' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%resume%';
