-- Track how a time entry was created: automatic (timer), manual, or corrected (auto then edited)
alter table public.time_entries
  add column if not exists source text default 'manual'
  check (source in ('automatic', 'manual', 'corrected'));

comment on column public.time_entries.source is 'automatic = from timer, manual = entered by form, corrected = automatic entry later edited';
