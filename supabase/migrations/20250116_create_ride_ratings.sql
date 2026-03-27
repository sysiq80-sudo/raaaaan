-- Create ride_ratings table for collecting driver and ride feedback
create table if not exists public.ride_ratings (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  rider_id uuid default auth.uid(),
  
  -- Rating data
  rating integer not null check (rating >= 1 and rating <= 5),
  tags text[] default null, -- JSON array of tag IDs
  comment text default null,
  
  -- Metadata
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  
  -- Unique constraint
  constraint unique_ride_rating unique(ride_id)
);

-- Create indexes separately
create index if not exists idx_ride_ratings_driver on public.ride_ratings(driver_id);
create index if not exists idx_ride_ratings_rider on public.ride_ratings(rider_id);
create index if not exists idx_ride_ratings_created on public.ride_ratings(created_at desc);

-- Enable RLS
alter table public.ride_ratings enable row level security;

-- RLS Policies
-- Riders can only view their own ratings
create policy "riders_view_own_ratings" on public.ride_ratings
  for select using (
    rider_id = auth.uid()
  );

-- Riders can insert their own ratings
create policy "riders_insert_ratings" on public.ride_ratings
  for insert with check (
    rider_id = auth.uid()
  );

-- Riders can update their own ratings (within 24 hours)
create policy "riders_update_own_ratings" on public.ride_ratings
  for update using (
    rider_id = auth.uid() and 
    created_at > now() - interval '24 hours'
  );

-- Drivers can view ratings for their rides
create policy "drivers_view_own_ratings" on public.ride_ratings
  for select using (
    driver_id = auth.uid()
  );

-- Create function to update driver average rating
create or replace function update_driver_rating()
returns trigger as $$
begin
  update public.drivers
  set 
    rating = (
      select round(avg(rating)::numeric, 1)
      from public.ride_ratings
      where driver_id = new.driver_id
    ),
    total_ratings = (
      select count(*)
      from public.ride_ratings
      where driver_id = new.driver_id
    )
  where user_id = new.driver_id;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically update driver rating
create trigger update_driver_rating_trigger
after insert or update on public.ride_ratings
for each row
execute function update_driver_rating();
