alter table trips
  add column preferred_trip_days integer not null default 7
  check (preferred_trip_days in (2, 3, 5, 7, 10, 14));
