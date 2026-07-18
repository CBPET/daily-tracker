-- ==========================================
-- CBPET Daily Tracker - Fresh Supabase Setup (core)
-- Brand-new Supabase projects ONLY.
-- Do NOT run on production databases that already have data.
-- Apply order: see sql_commands/fresh/README.md
-- ==========================================

begin;

create extension if not exists pgcrypto;

-- ==========================================
-- 1. ROLE TYPE (six active roles; no assistant_manager)
-- ==========================================
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'user_role'
  ) then
    create type public.user_role as enum (
      'super_admin',
      'general_manager',
      'manager',
      'group_lead',
      'team_lead',
      'performer'
    );
  end if;
end
$$;

-- ==========================================
-- 2. CORE TABLES
-- ==========================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  manager_id uuid references auth.users (id) on delete set null,
  parent_team_id uuid references public.teams (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  performer_name text not null default 'New Performer',
  role public.user_role not null default 'performer',
  team_id uuid references public.teams (id) on delete set null,
  department text,
  reports_to uuid references auth.users (id) on delete set null,
  client_id text not null default 'DEFAULT_CLIENT',
  is_active boolean not null default true,
  email_confirmed_at timestamptz,
  onboarding text check (onboarding is null or onboarding in ('invite', 'signup')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (user_id, workflow_id)
);

create table if not exists public.status_entries (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow_id uuid references public.workflows (id) on delete set null,
  client_id text not null default 'DEFAULT_CLIENT',
  date date not null,
  "performerName" text not null,
  "titleName" text not null,
  "completedPages" numeric not null default 0,
  "taskType" text not null,
  "estimatedTime" numeric not null default 0,
  "takenTime" numeric not null default 0,
  "timeAchieved" numeric not null default 0,
  "targetAchieved" numeric not null default 0,
  status text not null default 'Keep Trying!',
  created_at timestamptz not null default now(),
  constraint status_entries_completed_pages_nonnegative check ("completedPages" >= 0),
  constraint status_entries_estimated_time_nonnegative check ("estimatedTime" >= 0),
  constraint status_entries_taken_time_nonnegative check ("takenTime" >= 0),
  constraint status_entries_misc_estimated_time_range check (
    "taskType" <> 'Miscellaneous'
    or ("estimatedTime" >= 1 and "estimatedTime" <= 4)
  ),
  constraint status_entries_misc_taken_time_range check (
    "taskType" <> 'Miscellaneous'
    or ("takenTime" >= 1 and "takenTime" <= 4)
  )
);

create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,
  month date not null,
  year integer not null,
  total_pages numeric not null default 0,
  tasks_completed integer not null default 0,
  target_achieved numeric not null default 0,
  time_efficiency numeric not null default 0,
  quality_score numeric not null default 0,
  rank_monthly integer,
  rank_quarterly integer,
  rank_yearly integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric_date)
);

-- ==========================================
-- 3. INDEXES
-- ==========================================
create index if not exists idx_teams_manager_id on public.teams (manager_id);
create index if not exists idx_teams_parent_team_id on public.teams (parent_team_id);
create index if not exists idx_teams_active on public.teams (is_active) where is_active = true;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_team_id on public.profiles (team_id);
create index if not exists idx_profiles_reports_to on public.profiles (reports_to);
create index if not exists idx_profiles_active on public.profiles (is_active) where is_active = true;

create index if not exists idx_workflow_assignments_user_id on public.workflow_assignments (user_id);
create index if not exists idx_workflow_assignments_workflow_id on public.workflow_assignments (workflow_id);
create index if not exists idx_workflows_active on public.workflows (is_active) where is_active = true;

create index if not exists idx_status_entries_user_date on public.status_entries (user_id, date desc);
create index if not exists idx_status_entries_client_date on public.status_entries (client_id, date desc);
create index if not exists idx_status_entries_workflow_id on public.status_entries (workflow_id);
create index if not exists idx_status_entries_date on public.status_entries (date desc);

create index if not exists idx_performance_metrics_user_date on public.performance_metrics (user_id, metric_date desc);
create index if not exists idx_performance_metrics_month on public.performance_metrics (month);
create index if not exists idx_performance_metrics_year on public.performance_metrics (year);

-- ==========================================
-- 4. TIMESTAMP HELPERS
-- ==========================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_teams on public.teams;
create trigger set_updated_at_teams
before update on public.teams
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_workflows on public.workflows;
create trigger set_updated_at_workflows
before update on public.workflows
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_performance_metrics on public.performance_metrics;
create trigger set_updated_at_performance_metrics
before update on public.performance_metrics
for each row
execute function public.set_updated_at();

-- ==========================================
-- 5. AUTH PROFILE TRIGGERS
-- ==========================================
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
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'performer_name', split_part(coalesce(new.email, ''), '@', 1), 'New Performer'),
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

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    email_confirmed_at = new.email_confirmed_at,
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email, email_confirmed_at on auth.users
for each row
execute function public.sync_profile_email();

-- ==========================================
-- 6. METRIC REFRESH
-- ==========================================
create or replace function public.refresh_performance_metrics_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.performance_metrics
  where user_id = p_user_id;

  insert into public.performance_metrics (
    user_id,
    metric_date,
    month,
    year,
    total_pages,
    tasks_completed,
    target_achieved,
    time_efficiency,
    quality_score
  )
  select
    se.user_id,
    se.date as metric_date,
    date_trunc('month', se.date)::date as month,
    extract(year from se.date)::integer as year,
    coalesce(sum(se."completedPages"), 0) as total_pages,
    count(*)::integer as tasks_completed,
    round(coalesce(avg(se."targetAchieved"), 0)::numeric, 2) as target_achieved,
    round(coalesce(avg(se."timeAchieved"), 0)::numeric, 2) as time_efficiency,
    0::numeric as quality_score
  from public.status_entries se
  where se.user_id = p_user_id
  group by se.user_id, se.date;
end;
$$;

create or replace function public.refresh_performance_metrics_for_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_performance_metrics_for_user(new.user_id);
    if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
      perform public.refresh_performance_metrics_for_user(old.user_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_performance_metrics_for_user(old.user_id);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists refresh_performance_metrics_after_status_entry on public.status_entries;
create trigger refresh_performance_metrics_after_status_entry
after insert or update or delete on public.status_entries
for each row
execute function public.refresh_performance_metrics_for_entry();

-- ==========================================
-- 7. ROW LEVEL SECURITY
-- ==========================================
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_assignments enable row level security;
alter table public.status_entries enable row level security;
alter table public.performance_metrics enable row level security;

-- Profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
on public.profiles
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

-- Teams
drop policy if exists "teams_select_by_scope" on public.teams;
create policy "teams_select_by_scope"
on public.teams
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
  or manager_id = auth.uid()
  or id = (
    select p.team_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "teams_manage_super_admin" on public.teams;
create policy "teams_manage_super_admin"
on public.teams
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

-- Workflows
drop policy if exists "workflows_select_by_scope" on public.workflows;
create policy "workflows_select_by_scope"
on public.workflows
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
  or exists (
    select 1
    from public.workflow_assignments wa
    where wa.workflow_id = workflows.id
      and wa.user_id = auth.uid()
  )
);

drop policy if exists "workflows_manage_super_admin" on public.workflows;
create policy "workflows_manage_super_admin"
on public.workflows
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

-- Workflow assignments
drop policy if exists "workflow_assignments_select_by_scope" on public.workflow_assignments;
create policy "workflow_assignments_select_by_scope"
on public.workflow_assignments
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

drop policy if exists "workflow_assignments_manage_super_admin" on public.workflow_assignments;
create policy "workflow_assignments_manage_super_admin"
on public.workflow_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

drop policy if exists "workflow_assignments_delete_super_admin" on public.workflow_assignments;
create policy "workflow_assignments_delete_super_admin"
on public.workflow_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

-- Status entries
drop policy if exists "status_entries_select_by_scope" on public.status_entries;
create policy "status_entries_select_by_scope"
on public.status_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'manager'
    )
    and user_id in (
      select p2.id
      from public.profiles p2
      where p2.team_id in (
        select t.id
        from public.teams t
        where t.manager_id = auth.uid()
      )
    )
  )
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'team_lead'
    )
    and user_id in (
      select p2.id
      from public.profiles p2
      where p2.team_id = (
        select p3.team_id
        from public.profiles p3
        where p3.id = auth.uid()
      )
    )
  )
  or user_id = auth.uid()
  or (
    workflow_id is not null
    and exists (
      select 1
      from public.workflow_assignments wa
      where wa.workflow_id = status_entries.workflow_id
        and wa.user_id = auth.uid()
    )
  )
);

drop policy if exists "status_entries_insert_own" on public.status_entries;
create policy "status_entries_insert_own"
on public.status_entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "status_entries_update_own_or_admin" on public.status_entries;
create policy "status_entries_update_own_or_admin"
on public.status_entries
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

drop policy if exists "status_entries_delete_own_or_admin" on public.status_entries;
create policy "status_entries_delete_own_or_admin"
on public.status_entries
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

-- Performance metrics
drop policy if exists "performance_metrics_select_by_scope" on public.performance_metrics;
create policy "performance_metrics_select_by_scope"
on public.performance_metrics
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'manager'
    )
    and user_id in (
      select p2.id
      from public.profiles p2
      where p2.team_id in (
        select t.id
        from public.teams t
        where t.manager_id = auth.uid()
      )
    )
  )
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('team_lead', 'performer')
    )
    and user_id in (
      select p2.id
      from public.profiles p2
      where p2.team_id = (
        select p3.team_id
        from public.profiles p3
        where p3.id = auth.uid()
      )
    )
  )
  or user_id = auth.uid()
);

drop policy if exists "performance_metrics_manage_admin" on public.performance_metrics;
create policy "performance_metrics_manage_admin"
on public.performance_metrics
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

-- ==========================================
-- 8. ANALYTICS VIEWS
-- ==========================================
drop view if exists public.user_workflow_view cascade;
create view public.user_workflow_view as
select
  p.id,
  p.email,
  p.performer_name,
  p.role,
  p.client_id,
  p.team_id,
  w.id as workflow_id,
  w.name as workflow_name,
  w.is_active
from public.profiles p
left join public.workflow_assignments wa on wa.user_id = p.id
left join public.workflows w on w.id = wa.workflow_id;

drop view if exists public.monthly_leaderboard cascade;
create view public.monthly_leaderboard as
select
  pm.user_id,
  p.performer_name,
  p.role,
  p.team_id,
  t.name as team_name,
  pm.metric_date,
  pm.month,
  pm.year,
  pm.total_pages,
  pm.tasks_completed,
  pm.target_achieved,
  pm.time_efficiency,
  pm.quality_score,
  row_number() over (
    partition by pm.month
    order by pm.total_pages desc, pm.target_achieved desc, p.performer_name asc
  ) as calculated_rank
from public.performance_metrics pm
join public.profiles p on p.id = pm.user_id
left join public.teams t on t.id = p.team_id;

drop view if exists public.quarterly_leaderboard cascade;
create view public.quarterly_leaderboard as
select
  pm.user_id,
  p.performer_name,
  p.role,
  p.team_id,
  t.name as team_name,
  extract(quarter from pm.month)::integer as quarter,
  pm.year,
  sum(pm.total_pages) as total_pages_quarter,
  sum(pm.tasks_completed) as tasks_completed_quarter,
  round(avg(pm.target_achieved)::numeric, 2) as avg_target_achieved,
  round(avg(pm.time_efficiency)::numeric, 2) as time_efficiency,
  round(avg(pm.quality_score)::numeric, 2) as avg_quality_score,
  row_number() over (
    partition by extract(quarter from pm.month), pm.year
    order by sum(pm.total_pages) desc, avg(pm.target_achieved) desc, p.performer_name asc
  ) as calculated_rank
from public.performance_metrics pm
join public.profiles p on p.id = pm.user_id
left join public.teams t on t.id = p.team_id
group by
  pm.user_id,
  p.performer_name,
  p.role,
  p.team_id,
  t.name,
  extract(quarter from pm.month),
  pm.year;

drop view if exists public.yearly_leaderboard cascade;
create view public.yearly_leaderboard as
select
  pm.user_id,
  p.performer_name,
  p.role,
  p.team_id,
  t.name as team_name,
  pm.year,
  sum(pm.total_pages) as total_pages_year,
  sum(pm.tasks_completed) as tasks_completed_year,
  round(avg(pm.target_achieved)::numeric, 2) as avg_target_achieved,
  round(avg(pm.time_efficiency)::numeric, 2) as time_efficiency,
  round(avg(pm.quality_score)::numeric, 2) as avg_quality_score,
  row_number() over (
    partition by pm.year
    order by sum(pm.total_pages) desc, avg(pm.target_achieved) desc, p.performer_name asc
  ) as calculated_rank
from public.performance_metrics pm
join public.profiles p on p.id = pm.user_id
left join public.teams t on t.id = p.team_id
group by pm.user_id, p.performer_name, p.role, p.team_id, t.name, pm.year;

drop view if exists public.team_performance cascade;
create view public.team_performance as
select
  t.id as team_id,
  t.name as team_name,
  count(distinct p.id) as team_size,
  pm.month,
  pm.year,
  round(avg(pm.total_pages)::numeric, 2) as avg_pages_per_member,
  round(avg(pm.target_achieved)::numeric, 2) as avg_target_achieved,
  round(avg(pm.time_efficiency)::numeric, 2) as avg_time_efficiency,
  coalesce(sum(pm.total_pages), 0) as total_team_pages
from public.teams t
left join public.profiles p on p.team_id = t.id
left join public.performance_metrics pm on pm.user_id = p.id
group by t.id, t.name, pm.month, pm.year;

grant select on public.user_workflow_view to authenticated;
grant select on public.monthly_leaderboard to authenticated;
grant select on public.quarterly_leaderboard to authenticated;
grant select on public.yearly_leaderboard to authenticated;
grant select on public.team_performance to authenticated;

-- Role hierarchy helper (matches live ROLE_RLS_PREFLIGHT)
create or replace function public.get_user_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case (select role::text from public.profiles where id = user_uuid)
    when 'super_admin' then 6
    when 'general_manager' then 5
    when 'manager' then 4
    when 'group_lead' then 3
    when 'team_lead' then 2
    when 'performer' then 1
    else 0
  end;
$$;

commit;

-- ==========================================
-- 9. POST-SETUP STEPS
-- ==========================================
-- 1. Create your first user from the app or Supabase Auth.
-- 2. After these users sign up, promote them with:
--    update public.profiles
--    set role = 'super_admin'
--    where email = 'ayaz@company.io';
--
--    update public.profiles
--    set role = 'general_manager'
--    where email = 'alex@newgen.co';
--
-- 3. Optional sample team:
--    insert into public.teams (name, description)
--    values ('Production Team', 'Default delivery team');
--
-- 4. Optional backfill if you manually imported status entries:
--    select public.refresh_performance_metrics_for_user('[USER_UUID]'::uuid);

-- ==========================================
-- 10. OPTIONAL ROLE BOOTSTRAP
-- ==========================================
-- Run this block after the two users have completed signup in Supabase Auth.
--
-- update public.profiles
-- set role = case
--   when email = 'ayaz@company.io' then 'super_admin'::public.user_role
--   when email = 'alex@newgen.co' then 'general_manager'::public.user_role
--   else role
-- end
-- where email in ('ayaz@company.io', 'alex@newgen.co');
