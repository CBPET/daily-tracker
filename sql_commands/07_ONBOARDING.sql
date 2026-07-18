-- ==========================================
-- 07_ONBOARDING.sql
-- Track invite vs signup path on profiles for
-- Admin Invite / email-confirmation separation.
-- Safe to re-run on existing projects.
-- ==========================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding'
  ) then
    alter table public.profiles
      add column onboarding text;

    alter table public.profiles
      add constraint profiles_onboarding_check
      check (onboarding is null or onboarding in ('invite', 'signup'));
  end if;
end $$;

create index if not exists idx_profiles_onboarding
  on public.profiles (onboarding)
  where onboarding is not null;

-- Copy onboarding from auth user_metadata on new user insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    performer_name,
    role,
    client_id,
    email_confirmed_at,
    onboarding
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'performer_name',
      split_part(coalesce(new.email, ''), '@', 1),
      'New Performer'
    ),
    'performer',
    'DEFAULT_CLIENT',
    new.email_confirmed_at,
    case
      when new.raw_user_meta_data ->> 'onboarding' in ('invite', 'signup')
        then new.raw_user_meta_data ->> 'onboarding'
      when new.invited_at is not null then 'invite'
      else 'signup'
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    performer_name = coalesce(public.profiles.performer_name, excluded.performer_name),
    email_confirmed_at = coalesce(excluded.email_confirmed_at, public.profiles.email_confirmed_at),
    onboarding = coalesce(public.profiles.onboarding, excluded.onboarding),
    updated_at = now();

  return new;
end;
$$;

-- Best-effort backfill from auth.users for pending accounts
update public.profiles p
set onboarding = case
  when u.invited_at is not null then 'invite'
  else 'signup'
end,
updated_at = now()
from auth.users u
where u.id = p.id
  and p.onboarding is null
  and p.email_confirmed_at is null;
