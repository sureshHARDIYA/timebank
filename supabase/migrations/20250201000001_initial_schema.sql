-- Profiles (extends auth.users for app-specific data)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Clients: one per user, each can have hourly rate
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  hourly_rate_usd numeric(10, 2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects: each belongs to one client
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tasks (todos) per project
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Time entries: manual or from timer
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_name text,
  start_time timestamptz not null,
  end_time timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Active timer (single row per user when timer is running)
create table public.active_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_name text,
  started_at timestamptz not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.active_timers enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can manage own clients" on public.clients for all using (auth.uid() = user_id);
create policy "Users can manage own projects" on public.projects for all using (auth.uid() = user_id);
create policy "Users can manage tasks of own projects" on public.tasks for all using (
  exists (select 1 from public.projects p where p.id = tasks.project_id and p.user_id = auth.uid())
);
create policy "Users can manage own time_entries" on public.time_entries for all using (auth.uid() = user_id);
create policy "Users can manage own active_timers" on public.active_timers for all using (auth.uid() = user_id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index idx_clients_user_id on public.clients(user_id);
create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_client_id on public.projects(client_id);
create index idx_tasks_project_id on public.tasks(project_id);
create index idx_time_entries_user_id on public.time_entries(user_id);
create index idx_time_entries_project_id on public.time_entries(project_id);
create index idx_time_entries_start_time on public.time_entries(start_time);
