# Fix: Resume Upload Not Working in Profile Section

## Problem
Users cannot upload PDF resumes in the Profile section.

## Root Cause
The "resumes" storage bucket and its policies may not be set up in your Supabase database.

## Solution

### Option 1: Run SQL Script (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Setup Script**
   - Copy the entire contents of `supabase/setup-resume-storage.sql`
   - Paste it into the SQL Editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify Success**
   - You should see results showing:
     - "Bucket created" with bucket details
     - "Policies created" with policy count (should be 4)

### Option 2: Manual Setup via Supabase UI

1. **Create Storage Bucket**
   - Go to "Storage" in Supabase Dashboard
   - Click "Create a new bucket"
   - Name: `resumes`
   - Public: `OFF` (unchecked)
   - Click "Create bucket"

2. **Set Up Policies**
   - Click on the "resumes" bucket
   - Go to "Policies" tab
   - Click "New Policy"
   - Create 4 policies with these settings:

   **Policy 1: Upload**
   - Name: `Users can upload their own resume`
   - Allowed operation: `INSERT`
   - Policy definition:
     ```sql
     bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]
     ```

   **Policy 2: Read**
   - Name: `Users can read their own resume`
   - Allowed operation: `SELECT`
   - Policy definition:
     ```sql
     bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]
     ```

   **Policy 3: Update**
   - Name: `Users can update their own resume`
   - Allowed operation: `UPDATE`
   - Policy definition:
     ```sql
     bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]
     ```

   **Policy 4: Delete**
   - Name: `Users can delete their own resume`
   - Allowed operation: `DELETE`
   - Policy definition:
     ```sql
     bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]
     ```

3. **Add Database Columns**
   - Go to "SQL Editor"
   - Run this query:
     ```sql
     ALTER TABLE public.user_profiles
     ADD COLUMN IF NOT EXISTS resume_file_name TEXT,
     ADD COLUMN IF NOT EXISTS resume_file_url TEXT,
     ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ;
     ```

## Testing

1. **Go to Profile Page**
   - Navigate to http://localhost:3000/profile
   - Scroll to the "Resume" section

2. **Upload a Resume**
   - Click "Upload Resume" button
   - Select a PDF, DOC, or DOCX file (max 5MB)
   - You should see "Resume uploaded successfully!" message

3. **Verify Upload**
   - The filename should appear in the Resume section
   - Click "Download" to verify the file was uploaded correctly
   - Check Supabase Storage to see the file in the `resumes` bucket

## Troubleshooting

### Error: "Failed to upload file"
- Check that the "resumes" bucket exists in Supabase Storage
- Verify the bucket policies are correctly set up
- Check browser console for detailed error messages

### Error: "Invalid file type"
- Only PDF, DOC, and DOCX files are supported
- Check the file extension matches the actual file type

### Error: "File size exceeds 5MB limit"
- Compress your resume file to under 5MB
- Consider using PDF format which is usually smaller

### Error: "No authorization header" or "Unauthorized"
- Try logging out and logging back in
- Clear browser cache and cookies
- Check that your session hasn't expired

## File Locations

- **SQL Setup Script**: `supabase/setup-resume-storage.sql`
- **Migration File**: `supabase/migrations/add-resume-storage.sql`
- **Upload API**: `app/api/resume/upload/route.ts`
- **Download API**: `app/api/resume/download/route.ts`
- **Delete API**: `app/api/resume/delete/route.ts`
- **Profile Page**: `app/profile/page.tsx`

## Additional Notes

- Resumes are stored in a private bucket (not publicly accessible)
- Each user can only access their own resume files
- Uploading a new resume automatically deletes the old one
- Supported formats: PDF, DOC, DOCX
- Maximum file size: 5MB
