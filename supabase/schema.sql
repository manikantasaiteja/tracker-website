create extension if not exists "pgcrypto";

-- Store user profile data including phone number
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_number text,
  country_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles enable row level security;

create policy "Users can read their own profile"
on public.user_profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.user_profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.user_profiles
for update
using (auth.uid() = id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  status text not null check (
    status in ('Applied', 'Interview', 'Offer', 'Rejected', 'Ghosted', 'Withdrawn')
  ),
  date_applied date not null,
  location text,
  job_url text,
  cv_file_name text,
  cv_file_url text,
  cover_letter_file_name text,
  cover_letter_file_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at
before update on public.applications
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.applications enable row level security;

create policy "Users can read their own applications"
on public.applications
for select
using (auth.uid() = user_id);

create policy "Users can insert their own applications"
on public.applications
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own applications"
on public.applications
for update
using (auth.uid() = user_id);

create policy "Users can delete their own applications"
on public.applications
for delete
using (auth.uid() = user_id);


-- Create storage bucket for application documents
insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;

-- Storage policies for application documents
create policy "Users can upload their own documents"
on storage.objects
for insert
with check (
  bucket_id = 'application-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can read their own documents"
on storage.objects
for select
using (
  bucket_id = 'application-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own documents"
on storage.objects
for update
using (
  bucket_id = 'application-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own documents"
on storage.objects
for delete
using (
  bucket_id = 'application-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
