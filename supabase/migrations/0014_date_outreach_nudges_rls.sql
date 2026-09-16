-- Oversight in 0013: every other table gets RLS enabled at creation time
-- (spec §10's service-role backstop pattern), this one didn't.
alter table date_outreach_nudges enable row level security;

create policy "admin reads own trip date outreach nudges" on date_outreach_nudges
  for select using (
    exists (
      select 1 from decisions join trips on trips.id = decisions.trip_id
      where decisions.id = date_outreach_nudges.decision_id and trips.admin_user_id = auth.uid()
    )
  );
