-- Add is_approved to profiles so you can manually approve users before they can use the app
alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- New users get is_approved = false; you can set true in Supabase dashboard or via SQL
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_approved)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

-- Backfill: existing profiles get is_approved if column was just added (no-op if already present)
-- Optionally approve your own user after running migration:
--   update public.profiles set is_approved = true where id = auth.uid();
