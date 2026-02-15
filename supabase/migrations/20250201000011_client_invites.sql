-- Allow a client to log in: link auth user to client record
alter table public.clients
  add column if not exists invited_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists idx_clients_invited_user_id on public.clients(invited_user_id);

-- Invite tokens: owner creates invite, client accepts via link
create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.client_invites enable row level security;

create policy "Owners can manage invites for their clients"
  on public.client_invites for all
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_invites.client_id and c.user_id = auth.uid()
    )
  );

-- (Accept-invite reads/updates via API with service role or auth.uid() in app)

create index idx_client_invites_token on public.client_invites(token);
create index idx_client_invites_client_id on public.client_invites(client_id);

-- Return invite details by token (for accept page). Callable by anon so client can see invite before logging in.
create or replace function public.get_client_invite_by_token(invite_token text)
returns table (client_id uuid, client_name text, email text, expires_at timestamptz, accepted_at timestamptz)
language sql security definer set search_path = public
as $$
  select i.client_id, c.name, i.email, i.expires_at, i.accepted_at
  from public.client_invites i
  join public.clients c on c.id = i.client_id
  where i.token = invite_token;
$$;

-- Accept invite: link current user to client. Callable by authenticated user only.
create or replace function public.accept_client_invite(invite_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  inv record;
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;
  select i.id, i.client_id, i.expires_at, i.accepted_at into inv
  from public.client_invites i
  where i.token = invite_token;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  end if;
  if inv.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'Invite has expired');
  end if;
  if inv.accepted_at is not null then
    return jsonb_build_object('success', false, 'error', 'Invite already accepted');
  end if;
  update public.clients set invited_user_id = uid, updated_at = now() where id = inv.client_id;
  update public.client_invites set accepted_at = now() where id = inv.id;
  update public.profiles set is_approved = true, updated_at = now() where id = uid;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.get_client_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_client_invite(text) to authenticated;

-- RLS: invited client can read their client row
drop policy if exists "Users can manage own clients" on public.clients;
create policy "Users can manage own clients" on public.clients for all
  using (auth.uid() = user_id);
create policy "Invited client can read own client row" on public.clients for select
  using (auth.uid() = invited_user_id);

-- RLS: invited client can read projects for their client
drop policy if exists "Users can manage own projects" on public.projects;
create policy "Users can manage own projects" on public.projects for all
  using (auth.uid() = user_id);
create policy "Invited client can read projects for their client" on public.projects for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = projects.client_id and c.invited_user_id = auth.uid()
    )
  );

-- RLS: invited client can read time_entries for projects they have access to
drop policy if exists "Users can manage own time_entries" on public.time_entries;
create policy "Users can manage own time_entries" on public.time_entries for all
  using (auth.uid() = user_id);
create policy "Invited client can read time_entries for their projects" on public.time_entries for select
  using (
    exists (
      select 1 from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = time_entries.project_id and c.invited_user_id = auth.uid()
    )
  );
