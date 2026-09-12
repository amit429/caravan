alter table decisions add column reminded_at timestamptz;
alter table members add column nudge_tier integer not null default 0 check (nudge_tier between 0 and 3);
alter table members add column flagged_at timestamptz;
