-- Trainer auth table privileges + self-select policy
grant select, insert, update on table public.trainers to authenticated;

alter table public.trainers enable row level security;

drop policy if exists trainers_self_select on public.trainers;
create policy trainers_self_select
on public.trainers
for select
to authenticated
using (auth.uid() = auth_user_id);
