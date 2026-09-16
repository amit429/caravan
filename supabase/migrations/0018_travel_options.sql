create table travel_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('air', 'road', 'water')),
  timing text,
  price text,
  url text,
  source text not null default 'manual' check (source in ('chat', 'manual')),
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index travel_options_trip_idx on travel_options(trip_id);

create table travel_option_votes (
  id uuid primary key default gen_random_uuid(),
  travel_option_id uuid not null references travel_options(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (travel_option_id, member_id)
);

-- Who's actually on this flight/bus/car — many-to-many since a person can
-- be on more than one leg (e.g. flight there, train back), unlike
-- accommodations where everyone's assumed to be together.
create table travel_option_members (
  id uuid primary key default gen_random_uuid(),
  travel_option_id uuid not null references travel_options(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (travel_option_id, member_id)
);

alter table travel_options enable row level security;
alter table travel_option_votes enable row level security;
alter table travel_option_members enable row level security;

create policy "admin reads own trip travel options" on travel_options
  for select using (exists (select 1 from trips where trips.id = travel_options.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip travel option votes" on travel_option_votes
  for select using (
    exists (
      select 1 from travel_options join trips on trips.id = travel_options.trip_id
      where travel_options.id = travel_option_votes.travel_option_id and trips.admin_user_id = auth.uid()
    )
  );

create policy "admin reads own trip travel option members" on travel_option_members
  for select using (
    exists (
      select 1 from travel_options join trips on trips.id = travel_options.trip_id
      where travel_options.id = travel_option_members.travel_option_id and trips.admin_user_id = auth.uid()
    )
  );
