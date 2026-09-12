create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  agent text not null check (agent in ('scribe','concierge','chaser','scout','planner','quartermaster')),
  trigger text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost numeric not null default 0,
  latency_ms integer not null default 0,
  outcome text not null check (outcome in ('success','error','skipped')),
  error_message text,
  created_at timestamptz not null default now()
);

create index agent_runs_trip_idx on agent_runs(trip_id);

alter table agent_runs enable row level security;

create policy "admin reads own trip agent runs" on agent_runs
  for select using (exists (select 1 from trips where trips.id = agent_runs.trip_id and trips.admin_user_id = auth.uid()));
