-- Extend InBody records with BMI and visceral fat level.
alter table public.member_body_records
  add column if not exists bmi numeric;

alter table public.member_body_records
  add column if not exists visceral_fat_level integer;
