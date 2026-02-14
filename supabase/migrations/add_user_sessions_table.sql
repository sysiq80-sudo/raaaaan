-- Add user_sessions table for device tracking
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  last_activity timestamp with time zone default now(),
  
  unique(user_id, device_id)
);

-- Enable RLS
alter table public.user_sessions enable row level security;

-- Drop policies if they exist
drop policy if exists "Users can see their own sessions" on public.user_sessions;
drop policy if exists "Users can update their own sessions" on public.user_sessions;

-- Policies
create policy "Users can see their own sessions"
  on public.user_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.user_sessions
  for update
  using (auth.uid() = user_id);

-- Index
create index if not exists user_sessions_user_id_idx on public.user_sessions(user_id);
create index if not exists user_sessions_device_id_idx on public.user_sessions(device_id);

-- Add onboarding_completed flag to riders table if exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'riders' and table_schema = 'public') then
    alter table public.riders
    add column if not exists onboarding_completed boolean default false;
    
    alter table public.riders
    add column if not exists location_enabled boolean default false;
  end if;
end $$;

-- Comment
comment on table public.user_sessions is 'Tracks user sessions across devices for security and multi-device prevention';
