alter table facts drop constraint facts_source_check;
alter table facts add constraint facts_source_check check (source in ('intake','manual','extract'));
alter table facts add column source_message_id uuid references messages(id);
