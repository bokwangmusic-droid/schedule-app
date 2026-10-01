-- 2026-10-01 Trainer public profiles
alter table public.trainers add column if not exists bio text;
alter table public.trainers add column if not exists specialties text;
alter table public.trainers add column if not exists certifications text;
alter table public.trainers add column if not exists career text;
alter table public.trainers add column if not exists education text;
alter table public.trainers add column if not exists awards text;
alter table public.trainers add column if not exists instagram text;
alter table public.trainers add column if not exists profile_photo_url text;
alter table public.trainers add column if not exists updated_at timestamptz not null default now();

drop policy if exists trainers_self_update on public.trainers;
create policy trainers_self_update on public.trainers for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists trainers_member_select on public.trainers;
create policy trainers_member_select on public.trainers for select
using (
  exists (
    select 1
    from public.members m
    join public.member_accounts a on a.member_id = m.id
    where m.trainer_user_id = trainers.auth_user_id
      and a.auth_user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('trainer-profiles', 'trainer-profiles', true)
on conflict (id) do update set public = true;

drop policy if exists trainer_profiles_insert on storage.objects;
create policy trainer_profiles_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'trainer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists trainer_profiles_update on storage.objects;
create policy trainer_profiles_update on storage.objects for update to authenticated
using (
  bucket_id = 'trainer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'trainer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);
