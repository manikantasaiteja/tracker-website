-- Add resume fields to user_profiles table
alter table public.user_profiles
add column if not exists resume_file_name text,
add column if not exists resume_file_url text,
add column if not exists resume_uploaded_at timestamptz;

-- Create storage bucket for user resumes
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Storage policies for resumes
create policy "Users can upload their own resume"
on storage.objects
for insert
with check (
  bucket_id = 'resumes' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can read their own resume"
on storage.objects
for select
using (
  bucket_id = 'resumes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own resume"
on storage.objects
for update
using (
  bucket_id = 'resumes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own resume"
on storage.objects
for delete
using (
  bucket_id = 'resumes'
  and auth.uid()::text = (storage.foldername(name))[1]
);
