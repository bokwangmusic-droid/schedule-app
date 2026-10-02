-- Trainer cloud snapshot for multi-device restore/sync
create table if not exists public.trainer_data_snapshots (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.trainer_data_snapshots enable row level security;

grant select, insert, update on table public.trainer_data_snapshots to authenticated;

drop policy if exists trainer_data_snapshots_self_all on public.trainer_data_snapshots;
create policy trainer_data_snapshots_self_all
on public.trainer_data_snapshots
for all
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
