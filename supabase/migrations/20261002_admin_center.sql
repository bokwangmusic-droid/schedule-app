-- FitModu admin center
create table if not exists public.app_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

grant select on table public.app_admins to authenticated;

drop policy if exists app_admins_self_select on public.app_admins;
create policy app_admins_self_select
on public.app_admins
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists trainers_admin_select on public.trainers;
create policy trainers_admin_select
on public.trainers
for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins a
    where a.auth_user_id = auth.uid()
  )
);

drop policy if exists trainers_admin_update on public.trainers;
create policy trainers_admin_update
on public.trainers
for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins a
    where a.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.app_admins a
    where a.auth_user_id = auth.uid()
  )
);

drop policy if exists trainer_verification_admin_select on storage.objects;
create policy trainer_verification_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trainer-verification'
  and exists (
    select 1
    from public.app_admins a
    where a.auth_user_id = auth.uid()
  )
);
