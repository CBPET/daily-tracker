-- ==========================================
-- Enterprise Analytics — Phase 3
-- ==========================================
-- Depends on: ROLE_RLS_PREFLIGHT, SMART_REQUEST_HUB_PHASE1
-- Active roles only: performer, team_lead, group_lead, manager, general_manager, super_admin
-- ==========================================

begin;

create extension if not exists pgcrypto;

-- Verify-then-add created_at (already present on fresh setups)
alter table public.status_entries
  add column if not exists created_at timestamptz default now();

alter table public.status_entries
  add column if not exists batch_number integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'status_entries_batch_number_check'
  ) then
    alter table public.status_entries
      add constraint status_entries_batch_number_check
      check (batch_number is null or (batch_number between 1 and 25));
  end if;
end $$;

-- ─────────────────────────────────────────
-- user_behaviour_snapshots
-- ─────────────────────────────────────────

create table if not exists public.user_behaviour_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null,
  period_start date not null,
  period_end date not null,
  client_id text,
  client_ref uuid references public.clients(id) on delete set null,
  sub_division text,
  team_id uuid,
  daily_entry_percent numeric default 0,
  weekly_entry_percent numeric default 0,
  bi_weekly_entry_percent numeric default 0,
  monthly_entry_percent numeric default 0,
  missed_entries integer default 0,
  late_entries integer default 0,
  average_fill_time_minutes numeric default 0,
  entry_consistency numeric default 0,
  attendance_score numeric default 0,
  consistency_score numeric default 0,
  timeliness_score numeric default 0,
  completion_score numeric default 0,
  accuracy_score numeric default 0,
  overall_score numeric default 0,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  constraint user_behaviour_period_type_check
    check (period_type in ('daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'yearly'))
);

create unique index if not exists idx_user_behaviour_snapshots_user_period
  on public.user_behaviour_snapshots (user_id, period_type, period_start, period_end)
  where client_id is null and team_id is null;

create index if not exists idx_user_behaviour_snapshots_user
  on public.user_behaviour_snapshots(user_id, period_start desc);

create index if not exists idx_user_behaviour_snapshots_client
  on public.user_behaviour_snapshots(client_id);

-- ─────────────────────────────────────────
-- feedback_records
-- ─────────────────────────────────────────

create table if not exists public.feedback_records (
  id uuid primary key default gen_random_uuid(),
  feedback_type text not null,
  project_name text,
  task_type text,
  performer_id uuid references auth.users(id) on delete set null,
  feedback_date date not null default current_date,
  client_id text,
  sub_division text,
  title text not null,
  description text not null,
  severity text not null default 'Normal',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_role text,
  created_date timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archive_reason text,
  constraint feedback_type_check
    check (feedback_type in ('Internal', 'External')),
  constraint feedback_severity_check
    check (severity in ('Low', 'Normal', 'High', 'Critical'))
);

create index if not exists idx_feedback_records_performer
  on public.feedback_records(performer_id);
create index if not exists idx_feedback_records_created
  on public.feedback_records(created_date desc);
create index if not exists idx_feedback_records_archived
  on public.feedback_records(archived_at);

-- ─────────────────────────────────────────
-- enterprise_audit_log
-- ─────────────────────────────────────────

create table if not exists public.enterprise_audit_log (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  entity_type text not null,
  entity_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_date timestamptz not null default now()
);

create index if not exists idx_enterprise_audit_entity
  on public.enterprise_audit_log(entity_type, entity_id, created_date desc);
create index if not exists idx_enterprise_audit_module
  on public.enterprise_audit_log(module, created_date desc);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────

alter table public.user_behaviour_snapshots enable row level security;
alter table public.feedback_records enable row level security;
alter table public.enterprise_audit_log enable row level security;

drop policy if exists "behaviour_snapshots_select" on public.user_behaviour_snapshots;
create policy "behaviour_snapshots_select"
on public.user_behaviour_snapshots for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead')
  )
);

-- Inserts/updates via service role (Edge Function); allow managers to insert for testing/manual recalc
drop policy if exists "behaviour_snapshots_write_admin" on public.user_behaviour_snapshots;
create policy "behaviour_snapshots_write_admin"
on public.user_behaviour_snapshots for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "feedback_records_select" on public.feedback_records;
create policy "feedback_records_select"
on public.feedback_records for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "feedback_records_insert" on public.feedback_records;
create policy "feedback_records_insert"
on public.feedback_records for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "feedback_records_update" on public.feedback_records;
create policy "feedback_records_update"
on public.feedback_records for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "enterprise_audit_select" on public.enterprise_audit_log;
create policy "enterprise_audit_select"
on public.enterprise_audit_log for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "enterprise_audit_insert" on public.enterprise_audit_log;
create policy "enterprise_audit_insert"
on public.enterprise_audit_log for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

grant select on public.user_behaviour_snapshots to authenticated;
grant insert, update, delete on public.user_behaviour_snapshots to authenticated;
grant select, insert, update on public.feedback_records to authenticated;
grant select, insert on public.enterprise_audit_log to authenticated;

commit;
