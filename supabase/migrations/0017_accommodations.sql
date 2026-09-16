create table accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  name text not null,
  url text,
  price text,
  area text,
  image_url text,
  source text not null default 'manual' check (source in ('chat', 'manual')),
  locked boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create index accommodations_trip_idx on accommodations(trip_id);

create table accommodation_votes (
  id uuid primary key default gen_random_uuid(),
  accommodation_id uuid not null references accommodations(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (accommodation_id, member_id)
);

alter table accommodations enable row level security;
alter table accommodation_votes enable row level security;

create policy "admin reads own trip accommodations" on accommodations
  for select using (exists (select 1 from trips where trips.id = accommodations.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip accommodation votes" on accommodation_votes
  for select using (
    exists (
      select 1 from accommodations join trips on trips.id = accommodations.trip_id
      where accommodations.id = accommodation_votes.accommodation_id and trips.admin_user_id = auth.uid()
    )
  );
