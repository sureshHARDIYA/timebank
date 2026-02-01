-- Optional assignee per task (references profiles for display name)
alter table public.tasks
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_tasks_assignee_id on public.tasks(assignee_id);
