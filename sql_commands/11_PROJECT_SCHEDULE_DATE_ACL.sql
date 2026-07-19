-- ==========================================
-- PROJECT SCHEDULE DATE ACL + EVENT REASON
-- Run after 10_PROJECT_DATABASE.sql on live or greenfield.
-- Restricts date-column updates to can_manage_project_database roles.
-- ==========================================

begin;

-- Optional structured reason on audit events (also stored in new_values.reason_code from app)
alter table public.project_schedule_events
  add column if not exists reason_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_schedule_events_reason_code_check'
  ) then
    alter table public.project_schedule_events
      add constraint project_schedule_events_reason_code_check
      check (
        reason_code is null
        or reason_code in (
          'availability',
          'priority',
          'leave',
          'workload_delay',
          'client_change',
          'other'
        )
      );
  end if;
end $$;

create or replace function public.enforce_project_schedule_date_acl()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_changed boolean := false;
begin
  if tg_table_name = 'project_schedule_tasks' then
    date_changed :=
      (old.due_date is distinct from new.due_date)
      or (old.revised_due_date is distinct from new.revised_due_date)
      or (old.due_from_performer is distinct from new.due_from_performer)
      or (old.completed_from_performer is distinct from new.completed_from_performer)
      or (old.completed_date is distinct from new.completed_date);
  elsif tg_table_name = 'project_records' then
    date_changed :=
      (old.due_date is distinct from new.due_date)
      or (old.revised_due_date is distinct from new.revised_due_date)
      or (old.login_date is distinct from new.login_date)
      or (old.revised_login_date is distinct from new.revised_login_date);
  end if;

  if date_changed and not public.can_manage_project_database(auth.uid()) then
    -- Allow assignee to set completed_* only on their own schedule task
    if tg_table_name = 'project_schedule_tasks'
       and old.assigned_to is not null
       and old.assigned_to = auth.uid()
       and (old.due_date is not distinct from new.due_date)
       and (old.revised_due_date is not distinct from new.revised_due_date)
       and (old.due_from_performer is not distinct from new.due_from_performer)
       and (
         (old.completed_date is distinct from new.completed_date)
         or (old.completed_from_performer is distinct from new.completed_from_performer)
       )
    then
      return new;
    end if;

    raise exception 'Only leads/managers can change schedule or project due dates'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_schedule_task_date_acl on public.project_schedule_tasks;
create trigger trg_enforce_project_schedule_task_date_acl
before update on public.project_schedule_tasks
for each row
execute function public.enforce_project_schedule_date_acl();

drop trigger if exists trg_enforce_project_record_date_acl on public.project_records;
create trigger trg_enforce_project_record_date_acl
before update on public.project_records
for each row
execute function public.enforce_project_schedule_date_acl();

commit;
