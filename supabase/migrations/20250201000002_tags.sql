-- Tag IDs on active timer (so we can save tags when stopping)
alter table public.active_timers add column tag_ids uuid[] default '{}';

-- Tags per project (create new or use existing within project)
create table public.project_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text default '#3ECF8E',
  created_at timestamptz default now(),
  unique(project_id, name)
);

-- Time entry <-> tag (many-to-many)
create table public.time_entry_tags (
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  tag_id uuid not null references public.project_tags(id) on delete cascade,
  primary key (time_entry_id, tag_id)
);

-- RLS
alter table public.project_tags enable row level security;
alter table public.time_entry_tags enable row level security;

create policy "Users can manage project_tags of own projects" on public.project_tags for all using (
  exists (select 1 from public.projects p where p.id = project_tags.project_id and p.user_id = auth.uid())
);

create policy "Users can manage time_entry_tags for own time_entries" on public.time_entry_tags for all using (
  exists (select 1 from public.time_entries te where te.id = time_entry_tags.time_entry_id and te.user_id = auth.uid())
);

-- Indexes
create index idx_project_tags_project_id on public.project_tags(project_id);
create index idx_time_entry_tags_time_entry_id on public.time_entry_tags(time_entry_id);
create index idx_time_entry_tags_tag_id on public.time_entry_tags(tag_id);
