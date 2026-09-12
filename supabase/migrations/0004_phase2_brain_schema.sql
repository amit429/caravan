create table facts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  category text not null check (category in ('budget','departure_city','vibe','hard_no')),
  type text not null check (type in ('HARD','SOFT')),
  value jsonb not null,
  confidence numeric not null default 1.0,
  source text not null default 'intake' check (source in ('intake','manual')),
  superseded_by uuid references facts(id),
  created_at timestamptz not null default now()
);

create table availability (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  strength text not null check (strength in ('free','partial','blocked')),
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  type text not null check (type in ('DATES','DESTINATION','BUDGET','STAY','ACTIVITY','CUSTOM')),
  state text not null default 'OPEN' check (state in ('DRAFT','OPEN','VOTING','LOCKED','REOPENED')),
  options jsonb not null,
  quorum_rule text not null default 'simple_majority',
  deadline timestamptz,
  default_on_silence text not null default 'none' check (default_on_silence in ('none','flexible','leading_option')),
  locked_option text,
  rationale text,
  locked_by uuid references members(id),
  created_at timestamptz not null default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  option_id text not null,
  is_veto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (decision_id, member_id)
);

create index facts_trip_idx on facts(trip_id);
create index availability_trip_idx on availability(trip_id);
create index decisions_trip_idx on decisions(trip_id);
create index votes_decision_idx on votes(decision_id);

alter table facts enable row level security;
alter table availability enable row level security;
alter table decisions enable row level security;
alter table votes enable row level security;

create policy "admin reads own trip facts" on facts
  for select using (exists (select 1 from trips where trips.id = facts.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip availability" on availability
  for select using (exists (select 1 from trips where trips.id = availability.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin manages own trip decisions" on decisions
  for all
  using (exists (select 1 from trips where trips.id = decisions.trip_id and trips.admin_user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = decisions.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip votes" on votes
  for select using (exists (select 1 from decisions join trips on trips.id = decisions.trip_id where decisions.id = votes.decision_id and trips.admin_user_id = auth.uid()));

alter publication supabase_realtime add table decisions;
alter publication supabase_realtime add table votes;
