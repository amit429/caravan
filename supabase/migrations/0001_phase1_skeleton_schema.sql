create extension if not exists pgcrypto;

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rough_intent text,
  admin_user_id uuid not null references auth.users(id),
  invite_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby','active','closed')),
  joining_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  display_name text not null,
  email text not null,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','removed')),
  device_token_hash text,
  joined_at timestamptz not null default now(),
  unique (trip_id, email)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  lane text not null default 'group' check (lane = 'group'),
  author_type text not null check (author_type = 'member'),
  author_id uuid references members(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_trip_created_idx on messages(trip_id, created_at);
create index members_trip_idx on members(trip_id);

alter table trips enable row level security;
alter table members enable row level security;
alter table messages enable row level security;

create policy "admin manages own trips" on trips
  for all
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid());

create policy "admin reads own trip members" on members
  for select
  using (exists (select 1 from trips where trips.id = members.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip messages" on messages
  for select
  using (exists (select 1 from trips where trips.id = messages.trip_id and trips.admin_user_id = auth.uid()));

alter publication supabase_realtime add table messages;
