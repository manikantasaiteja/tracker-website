create extension if not exists "pgcrypto";

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
  notes text,
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
