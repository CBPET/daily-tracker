-- ==========================================
-- Fresh greenfield verification (run after 01–06)
-- ==========================================

-- 1. Active role enum labels
select e.enumlabel
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'user_role'
order by e.enumsortorder;

-- Expect: super_admin, general_manager, manager, group_lead, team_lead, performer
-- Must NOT include assistant_manager as a required live role for new projects.

-- 2. Core + enterprise tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'teams',
    'profiles',
    'workflows',
    'workflow_assignments',
    'status_entries',
    'performance_metrics',
    'clients',
    'division_targets',
    'request_hub_tickets',
    'request_hub_screenshots',
    'request_hub_events',
    'notifications',
    'notification_actions',
    'user_behaviour_snapshots',
    'feedback_records',
    'enterprise_audit_log'
  )
order by table_name;

-- 3. Key columns
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in ('role', 'client_id', 'client_ref', 'sub_division', 'team_id', 'onboarding', 'status'))
    or (table_name = 'status_entries' and column_name in ('client_id', 'sub_division', 'batch_number', 'created_at', 'workflow_id'))
    or (table_name = 'request_hub_tickets' and column_name in ('ticket_number', 'status', 'assigned_to', 'archived_at'))
  )
order by table_name, column_name;

-- 4. RLS enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'status_entries',
    'clients',
    'division_targets',
    'request_hub_tickets',
    'notifications',
    'user_behaviour_snapshots',
    'feedback_records'
  )
order by tablename;

-- 5. Manager (not assistant_manager) appears in key write policies
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (
    qual::text ilike '%manager%'
    or with_check::text ilike '%manager%'
  )
  and tablename in ('status_entries', 'clients', 'division_targets', 'performance_metrics')
order by tablename, policyname;

-- 6. Storage bucket for Request Hub
select id, name, public, file_size_limit
from storage.buckets
where id = 'request-hub-screenshots';

-- 7. Helper function
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_user_role_level',
    'handle_new_user',
    'can_view_request_hub_ticket',
    'can_manage_request_hub_ticket'
  )
order by routine_name;

-- 8. Health counts (empty is fine on fresh project)
select
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.clients) as clients_count,
  (select count(*) from public.request_hub_tickets) as tickets_count,
  (select count(*) from public.notifications) as notifications_count;
