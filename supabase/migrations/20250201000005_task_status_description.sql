-- Kanban: task status (backlog, todo, progress, done) and optional description
alter table public.tasks
  add column if not exists status text default 'backlog'
    check (status in ('backlog', 'todo', 'progress', 'done')),
  add column if not exists description text;

-- Backfill existing rows: completed -> done, else todo (only rows still with default)
update public.tasks
set status = case when completed then 'done' else 'todo' end
where status = 'backlog';

create index if not exists idx_tasks_status on public.tasks(project_id, status);
