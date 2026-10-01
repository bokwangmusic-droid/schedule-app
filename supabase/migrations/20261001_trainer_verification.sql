-- Trainer signup + manual verification workflow
alter table public.trainers
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists gym_name text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_document_path text,
  add column if not exists verification_document_name text,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_rejection_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trainers_verification_status_check') then
    alter table public.trainers add constraint trainers_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('trainer-verification', 'trainer-verification', false)
on conflict (id) do update set public = false;

drop policy if exists trainers_self_insert_pending on public.trainers;
create policy trainers_self_insert_pending on public.trainers for insert to authenticated
with check (auth.uid() = auth_user_id and verification_status = 'pending' and verification_reviewed_at is null);

drop policy if exists trainers_self_update_application on public.trainers;
create policy trainers_self_update_application on public.trainers for update to authenticated
using (auth.uid() = auth_user_id and verification_status in ('pending', 'rejected'))
with check (auth.uid() = auth_user_id and verification_status = 'pending' and verification_reviewed_at is null);

drop policy if exists trainer_verification_insert_own on storage.objects;
create policy trainer_verification_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'trainer-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists trainer_verification_select_own on storage.objects;
create policy trainer_verification_select_own on storage.objects for select to authenticated
using (bucket_id = 'trainer-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists trainer_verification_update_own on storage.objects;
create policy trainer_verification_update_own on storage.objects for update to authenticated
using (bucket_id = 'trainer-verification' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'trainer-verification' and (storage.foldername(name))[1] = auth.uid()::text);
