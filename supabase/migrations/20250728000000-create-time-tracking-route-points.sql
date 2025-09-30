-- Create table for storing granular GPS points captured during active time tracking sessions
create table if not exists public.time_tracking_route_points (
  id uuid primary key default gen_random_uuid(),
  time_tracking_id uuid not null references public.time_tracking(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  created_at timestamptz not null default now()
);

-- Ensure fast lookups for map rendering and analytics
create index if not exists time_tracking_route_points_time_tracking_id_recorded_at_idx
  on public.time_tracking_route_points (time_tracking_id, recorded_at);
