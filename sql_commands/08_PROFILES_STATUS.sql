-- ==========================================
-- 08_PROFILES_STATUS.sql
-- User Management active / idle / archive status.
-- Safe to re-run on existing projects.
-- ==========================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'status'
  ) then
    alter table public.profiles
      add column status text not null default 'active';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'idle', 'archive'));
  end if;
end $$;

-- Align with existing is_active flag
update public.profiles
set status = 'archive'
where coalesce(is_active, true) = false
  and status <> 'archive';

create index if not exists idx_profiles_status
  on public.profiles (status);
