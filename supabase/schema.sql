-- BKGYM Schedule remote schema (Supabase/Postgres)
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.trainers (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'BKGYM Trainer',
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key,
  trainer_user_id uuid not null references public.trainers(auth_user_id) on delete cascade,
  name text not null,
  phone text,
  membership_start_date date,
  membership_end_date date,
  pt_total_sessions integer,
  pt_remaining_sessions integer,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  member_id text not null unique references public.members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id text primary key,
  trainer_user_id uuid not null references public.trainers(auth_user_id) on delete cascade,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  memo text,
  color text,
  member_id text references public.members(id) on delete set null,
  is_all_day boolean not null default false,
  is_completed boolean not null default false,
  attendance_status text,
  session_note text,
  signature_json text,
  signed_at timestamptz,
  pt_consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_training_logs (
  id text primary key,
  trainer_user_id uuid not null references public.trainers(auth_user_id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  schedule_id text references public.schedules(id) on delete set null,
  date date not null,
  body_part text,
  sleep_quality text,
  condition_level text,
  activity_level text,
  diet_control boolean not null default false,
  hydration boolean not null default false,
  cardio_treadmill text,
  cardio_bike text,
  cardio_stepmill text,
  breakfast_carbs text,
  breakfast_protein text,
  breakfast_fat text,
  lunch_carbs text,
  lunch_protein text,
  lunch_fat text,
  dinner_carbs text,
  dinner_protein text,
  dinner_fat text,
  snack text,
  summary text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_training_exercises (
  id text primary key,
  log_id text not null references public.member_training_logs(id) on delete cascade,
  exercise_order integer not null default 0,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_training_sets (
  id text primary key,
  exercise_id text not null references public.member_training_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric,
  reps integer,
  created_at timestamptz not null default now()
);

create table if not exists public.member_body_records (
  id text primary key,
  trainer_user_id uuid not null references public.trainers(auth_user_id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  measured_date date not null,
  weight numeric,
  skeletal_muscle numeric,
  body_fat numeric,
  body_fat_percentage numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_remote_members_trainer on public.members(trainer_user_id);
create index if not exists idx_remote_schedules_member_date on public.schedules(member_id, date);
create index if not exists idx_remote_logs_member_date on public.member_training_logs(member_id, date);
create index if not exists idx_remote_body_member_date on public.member_body_records(member_id, measured_date);

alter table public.trainers enable row level security;
alter table public.members enable row level security;
alter table public.member_accounts enable row level security;
alter table public.schedules enable row level security;
alter table public.member_training_logs enable row level security;
alter table public.member_training_exercises enable row level security;
alter table public.member_training_sets enable row level security;
alter table public.member_body_records enable row level security;

drop policy if exists trainers_self_select on public.trainers;
create policy trainers_self_select on public.trainers for select using (auth.uid() = auth_user_id);

drop policy if exists member_accounts_self_select on public.member_accounts;
create policy member_accounts_self_select on public.member_accounts for select using (auth.uid() = auth_user_id);

drop policy if exists members_trainer_all on public.members;
create policy members_trainer_all on public.members for all
using (trainer_user_id = auth.uid())
with check (trainer_user_id = auth.uid());

drop policy if exists members_member_select on public.members;
create policy members_member_select on public.members for select
using (
  exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid() and a.member_id = members.id
  )
);

drop policy if exists schedules_trainer_all on public.schedules;
create policy schedules_trainer_all on public.schedules for all
using (trainer_user_id = auth.uid())
with check (trainer_user_id = auth.uid());

drop policy if exists schedules_member_select on public.schedules;
create policy schedules_member_select on public.schedules for select
using (
  member_id is not null and exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid() and a.member_id = schedules.member_id
  )
);

drop policy if exists logs_trainer_all on public.member_training_logs;
create policy logs_trainer_all on public.member_training_logs for all
using (trainer_user_id = auth.uid())
with check (trainer_user_id = auth.uid());

drop policy if exists logs_member_select on public.member_training_logs;
create policy logs_member_select on public.member_training_logs for select
using (
  exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid() and a.member_id = member_training_logs.member_id
  )
);

drop policy if exists exercises_trainer_all on public.member_training_exercises;
create policy exercises_trainer_all on public.member_training_exercises for all
using (
  exists (
    select 1 from public.member_training_logs l
    where l.id = member_training_exercises.log_id and l.trainer_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.member_training_logs l
    where l.id = member_training_exercises.log_id and l.trainer_user_id = auth.uid()
  )
);

drop policy if exists exercises_member_select on public.member_training_exercises;
create policy exercises_member_select on public.member_training_exercises for select
using (
  exists (
    select 1
    from public.member_training_logs l
    join public.member_accounts a on a.member_id = l.member_id
    where l.id = member_training_exercises.log_id and a.auth_user_id = auth.uid()
  )
);

drop policy if exists sets_trainer_all on public.member_training_sets;
create policy sets_trainer_all on public.member_training_sets for all
using (
  exists (
    select 1
    from public.member_training_exercises e
    join public.member_training_logs l on l.id = e.log_id
    where e.id = member_training_sets.exercise_id and l.trainer_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.member_training_exercises e
    join public.member_training_logs l on l.id = e.log_id
    where e.id = member_training_sets.exercise_id and l.trainer_user_id = auth.uid()
  )
);

drop policy if exists sets_member_select on public.member_training_sets;
create policy sets_member_select on public.member_training_sets for select
using (
  exists (
    select 1
    from public.member_training_exercises e
    join public.member_training_logs l on l.id = e.log_id
    join public.member_accounts a on a.member_id = l.member_id
    where e.id = member_training_sets.exercise_id and a.auth_user_id = auth.uid()
  )
);

drop policy if exists body_trainer_all on public.member_body_records;
create policy body_trainer_all on public.member_body_records for all
using (trainer_user_id = auth.uid())
with check (trainer_user_id = auth.uid());

drop policy if exists body_member_select on public.member_body_records;
create policy body_member_select on public.member_body_records for select
using (
  exists (
    select 1 from public.member_accounts a
    where a.auth_user_id = auth.uid() and a.member_id = member_body_records.member_id
  )
);
