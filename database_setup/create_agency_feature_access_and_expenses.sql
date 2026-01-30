-- Feature access settings per agency
create table if not exists public.agency_feature_access (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies(id) on delete cascade,
  enable_time_tracking_odometer boolean not null default false,
  enable_fuel_expenses boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  updated_by uuid null references public.profiles(id)
);

create index if not exists agency_feature_access_agency_id_idx
  on public.agency_feature_access(agency_id);

-- Odometer log for time tracking clock-in
create table if not exists public.time_tracking_odometer_entries (
  id uuid primary key default gen_random_uuid(),
  time_tracking_id uuid not null references public.time_tracking(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  odometer_km numeric not null,
  photo_url text not null,
  photo_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists time_tracking_odometer_entries_tracking_idx
  on public.time_tracking_odometer_entries(time_tracking_id);

create index if not exists time_tracking_odometer_entries_agency_idx
  on public.time_tracking_odometer_entries(agency_id);

-- Fuel recharge logs
create table if not exists public.fuel_recharges (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  odometer_km numeric not null,
  bill_photo_url text not null,
  bill_photo_path text not null,
  occurred_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists fuel_recharges_agency_idx
  on public.fuel_recharges(agency_id);

-- Other expense logs
create table if not exists public.agency_expenses (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  category text not null,
  amount numeric not null,
  bill_photo_url text not null,
  bill_photo_path text not null,
  occurred_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists agency_expenses_agency_idx
  on public.agency_expenses(agency_id);
