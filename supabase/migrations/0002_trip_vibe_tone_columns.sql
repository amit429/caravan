alter table trips
  add column vibe text[] not null default '{}',
  add column budget_hint text,
  add column agent_tone text not null default 'efficient' check (agent_tone in ('efficient','warm','dry'));

alter publication supabase_realtime add table members;
