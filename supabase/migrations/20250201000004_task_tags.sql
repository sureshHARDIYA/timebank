-- Tasks can have tags (optional, for pre-assigning tags when creating a task)
create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table public.task_tags enable row level security;

create policy "Users can manage task_tags of own projects" on public.task_tags for all using (
  exists (
    select 1 from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.id = task_tags.task_id and p.user_id = auth.uid()
  )
);

create index idx_task_tags_task_id on public.task_tags(task_id);
create index idx_task_tags_tag_id on public.task_tags(tag_id);
