-- Ideas were link-only (composer's explicit "Drop a link" flow). Scribe now
-- also files ideas straight out of chat — a plain-text proposal ("let's go
-- scuba diving") has no link at all, and a hotel/flight link needs a
-- category so Bookings can show it as a Stay/Travel suggestion instead of
-- just another generic idea.
alter table ideas alter column url drop not null;
alter table ideas add column category text not null default 'activity'
  check (category in ('activity', 'stay', 'travel'));
