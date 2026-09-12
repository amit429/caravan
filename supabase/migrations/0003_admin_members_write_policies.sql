-- Admin routes moved off the service-role client onto the session-scoped
-- (RLS-enforced) client. Trips already has a full FOR ALL policy; members only
-- had SELECT for admins. Add the write policies needed for trip creation
-- (mirroring the admin as a member) and member removal.

create policy "admin adds members to own trips" on members
  for insert
  with check (exists (select 1 from trips where trips.id = members.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin updates members in own trips" on members
  for update
  using (exists (select 1 from trips where trips.id = members.trip_id and trips.admin_user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = members.trip_id and trips.admin_user_id = auth.uid()));
