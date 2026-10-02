-- 2026-10-02 Member self check-in
create table if not exists public.member_self_checks (
  member_id text not null references public.members(id) on delete cascade,
  date date not null,
  activity_level text,
  cardio_treadmill text,
  cardio_bike text,
  cardio_stepmill text,
  updated_at timestamptz not null default now(),
  primary key (member_id, date)
);

alter table public.member_self_checks enable row level security;

drop policy if exists self_checks_member_all on public.member_self_checks;
create policy self_checks_member_all on public.member_self_checks for all
using (
  exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid()
      and a.member_id = member_self_checks.member_id
  )
)
with check (
  exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid()
      and a.member_id = member_self_checks.member_id
  )
);

drop policy if exists self_checks_trainer_select on public.member_self_checks;
create policy self_checks_trainer_select on public.member_self_checks for select
using (
  exists (
    select 1 from public.members m
    where m.id = member_self_checks.member_id
      and m.trainer_user_id = auth.uid()
  )
);
