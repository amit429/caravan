-- Threads-lite (PRD §18 D8): the agent's 1:1 intake becomes a real thread
-- with one member, instead of the group lane. One thread per (trip, member),
-- lazily created on first visit — see lib/threads/ensure-thread.ts.
create table threads (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, member_id)
);

create index threads_trip_member_idx on threads(trip_id, member_id);

alter table messages add column thread_id uuid references threads(id) on delete cascade;
create index messages_thread_idx on messages(thread_id);

alter table messages drop constraint messages_lane_check;
alter table messages add constraint messages_lane_check check (lane in ('group', 'thread'));

alter table threads enable row level security;

-- Same backstop pattern as every other member-write table (spec §10): reads/
-- writes go through the service-role client after resolveCaller() confirms
-- the caller *is* the thread's member; this RLS policy only covers the admin
-- session directly querying Postgres. A thread is visible only to its one
-- participant (D8) — the admin has no broader read access here, unlike
-- every other trip table, since thread content is explicitly private.
create policy "admin reads own trip threads" on threads
  for select using (exists (select 1 from trips where trips.id = threads.trip_id and trips.admin_user_id = auth.uid()));
