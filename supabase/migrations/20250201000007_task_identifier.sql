-- Per-project task number for identifiers like TASK-001
alter table public.tasks
  add column if not exists task_number integer;

-- Backfill: assign 1, 2, 3... per project by created_at
with numbered as (
  select id, row_number() over (partition by project_id order by created_at) as rn
  from public.tasks
  where task_number is null
)
update public.tasks t
set task_number = numbered.rn
from numbered
where t.id = numbered.id;

-- Default for new rows (will be set by app; fallback for manual inserts)
alter table public.tasks
  alter column task_number set default 1;

-- Unique per project
create unique index if not exists idx_tasks_project_task_number
  on public.tasks(project_id, task_number);
