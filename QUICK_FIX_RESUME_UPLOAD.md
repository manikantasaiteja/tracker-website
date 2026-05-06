# 🚨 QUICK FIX: Resume Upload Error

## The Problem
You're seeing **"Failed to upload file"** because the storage bucket doesn't exist in Supabase.

## The Solution (Takes 2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Copy This SQL Code

```sql
-- Add resume columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS resume_file_name TEXT,
ADD COLUMN IF NOT EXISTS resume_file_url TEXT,
ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ;

-- Create the resumes bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Remove old policies if they exist
DROP POLICY IF EXISTS "Users can upload their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resume" ON storage.objects;

-- Create upload policy
CREATE POLICY "Users can upload their own resume"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create read policy
CREATE POLICY "Users can read their own resume"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create update policy
CREATE POLICY "Users can update their own resume"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create delete policy
CREATE POLICY "Users can delete their own resume"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 3: Run the Code
1. Paste the SQL code into the SQL Editor
2. Click **"Run"** (or press Ctrl+Enter)
3. Wait for "Success" message

### Step 4: Test It
1. Go back to your app: http://localhost:3000/profile
2. Scroll to the "Resume" section
3. Click "Upload Resume"
4. Select a PDF file
5. You should see **"Resume uploaded successfully!"** ✅

## Still Not Working?

### Check the Browser Console
1. Press F12 to open Developer Tools
2. Go to the "Console" tab
3. Try uploading again
4. Look for error messages
5. Share the error message for more help

### Verify in Supabase
1. Go to **Storage** in Supabase Dashboard
2. You should see a bucket named **"resumes"**
3. If not, the SQL script didn't run correctly

### Common Issues

**Error: "bucket not found"**
- The SQL script didn't create the bucket
- Try running the script again
- Check if you have permissions in Supabase

**Error: "policy violation"**
- The policies weren't created
- Run the SQL script again
- Make sure you're logged in to the app

**Error: "Invalid file type"**
- Only PDF, DOC, and DOCX files are supported
- Check your file extension

**Error: "File size exceeds 5MB"**
- Your file is too large
- Compress it or use a smaller file

## Need More Help?
Check the detailed guide: `RESUME_UPLOAD_FIX.md`
