-- Global tags (user-level, not per project)
-- Drop old project-scoped tags and recreate as user-level

drop table if exists public.time_entry_tags;
drop table if exists public.project_tags;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#3ECF8E',
  created_at timestamptz default now(),
  unique(user_id, name)
);

create table public.time_entry_tags (
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (time_entry_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.time_entry_tags enable row level security;

create policy "Users can manage own tags" on public.tags for all using (auth.uid() = user_id);

create policy "Users can manage time_entry_tags for own time_entries" on public.time_entry_tags for all using (
  exists (select 1 from public.time_entries te where te.id = time_entry_tags.time_entry_id and te.user_id = auth.uid())
);

create index idx_tags_user_id on public.tags(user_id);
create index idx_time_entry_tags_time_entry_id on public.time_entry_tags(time_entry_id);
create index idx_time_entry_tags_tag_id on public.time_entry_tags(tag_id);
