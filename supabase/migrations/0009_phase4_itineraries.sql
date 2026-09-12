create table itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade unique,
  destination text not null,
  days jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table itineraries enable row level security;

create policy "admin reads own trip itinerary" on itineraries
  for select using (exists (select 1 from trips where trips.id = itineraries.trip_id and trips.admin_user_id = auth.uid()));
