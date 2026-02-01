-- Invoices: snapshot of time/amount for a project over a period; track sent/paid
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_minutes numeric(12, 2) not null,
  amount_usd numeric(12, 2) not null,
  is_sent boolean not null default false,
  sent_at timestamptz,
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.invoices enable row level security;

create policy "Users can manage invoices for own projects"
  on public.invoices for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.user_id = auth.uid()
    )
  );

create index idx_invoices_project_id on public.invoices(project_id);
create index idx_invoices_period on public.invoices(project_id, period_start, period_end);
