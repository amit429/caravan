-- F12 idea inbox
create table ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  url text not null,
  title text,
  note text,
  image_url text,
  created_at timestamptz not null default now()
);

create table idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, member_id)
);

-- F13 prep checklist (Quartermaster)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null,
  category text not null check (category in ('docs', 'booking', 'packing', 'other')),
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- F14 booking tracker
create table bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  item text not null,
  deadline date,
  created_at timestamptz not null default now()
);

create table booking_status (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  booked boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (booking_id, member_id)
);

-- F15 cost estimator
create table cost_estimates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references trips(id) on delete cascade,
  destination text not null,
  min_per_head integer not null,
  max_per_head integer not null,
  currency text not null default 'INR',
  assumptions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_trip_idx on ideas(trip_id);
create index idea_votes_idea_idx on idea_votes(idea_id);
create index tasks_trip_idx on tasks(trip_id);
create index bookings_trip_idx on bookings(trip_id);
create index booking_status_booking_idx on booking_status(booking_id);

alter table ideas enable row level security;
alter table idea_votes enable row level security;
alter table tasks enable row level security;
alter table bookings enable row level security;
alter table booking_status enable row level security;
alter table cost_estimates enable row level security;

-- Members have no auth.uid() (spec §10) — writes from either audience go
-- through the service-role client after an app-level resolveCaller() check,
-- same pattern as facts/decisions/votes. These policies are the admin-facing
-- RLS backstop, not the primary gate.
create policy "admin reads own trip ideas" on ideas
  for select using (exists (select 1 from trips where trips.id = ideas.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip idea votes" on idea_votes
  for select using (exists (select 1 from ideas join trips on trips.id = ideas.trip_id where ideas.id = idea_votes.idea_id and trips.admin_user_id = auth.uid()));

create policy "admin manages own trip tasks" on tasks
  for all
  using (exists (select 1 from trips where trips.id = tasks.trip_id and trips.admin_user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = tasks.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin manages own trip bookings" on bookings
  for all
  using (exists (select 1 from trips where trips.id = bookings.trip_id and trips.admin_user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = bookings.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip booking status" on booking_status
  for select using (exists (select 1 from bookings join trips on trips.id = bookings.trip_id where bookings.id = booking_status.booking_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip cost estimates" on cost_estimates
  for select using (exists (select 1 from trips where trips.id = cost_estimates.trip_id and trips.admin_user_id = auth.uid()));

alter publication supabase_realtime add table ideas;
alter publication supabase_realtime add table idea_votes;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table booking_status;
