create table budget_checks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  threshold_amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index budget_checks_trip_idx on budget_checks(trip_id);

-- At most one open ask per member at a time — a fresh cost re-estimate
-- shouldn't pile up a second "are you ok to stretch?" on top of one they
-- haven't answered yet.
create unique index budget_checks_one_pending_per_member on budget_checks(trip_id, member_id) where status = 'pending';

alter table budget_checks enable row level security;

create policy "admin reads own trip budget checks" on budget_checks
  for select using (exists (select 1 from trips where trips.id = budget_checks.trip_id and trips.admin_user_id = auth.uid()));
