alter table messages drop constraint messages_author_type_check;
alter table messages add constraint messages_author_type_check check (author_type in ('member','agent'));
alter table messages add column agent_name text check (agent_name in ('concierge','scribe','chaser','scout','planner','quartermaster'));
alter table messages add column metadata jsonb not null default '{}'::jsonb;
alter table messages add constraint messages_agent_name_required check (
  (author_type = 'agent' and agent_name is not null) or (author_type = 'member' and agent_name is null)
);
