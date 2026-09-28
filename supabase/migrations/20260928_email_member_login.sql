-- Switch member login identity from SMS phone OTP to email OTP.
-- Run once in the existing Supabase project SQL Editor.

alter table public.members
  add column if not exists email text;

create unique index if not exists idx_remote_members_email_unique
  on public.members (lower(email))
  where email is not null and length(trim(email)) > 0;

create or replace function public.claim_member_account_by_email()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_member_id text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_email = '' then
    raise exception 'Authenticated email is missing';
  end if;

  select id
    into v_member_id
  from public.members
  where lower(email) = v_email
  limit 1;

  if v_member_id is null then
    raise exception 'No member matches this email';
  end if;

  insert into public.member_accounts (auth_user_id, member_id)
  values (auth.uid(), v_member_id)
  on conflict (auth_user_id)
  do update set member_id = excluded.member_id;

  return v_member_id;
end;
$$;

revoke all on function public.claim_member_account_by_email() from public;
grant execute on function public.claim_member_account_by_email() to authenticated;
