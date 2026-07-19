-- ==========================================
-- PROJECT DATABASE / SCHEDULE TRACKING
-- Existing databases: run after client hierarchy and profile roles are live.
-- ==========================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------
-- 1. Helpers
-- ------------------------------------------
create or replace function public.can_manage_project_database(user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_uuid
      and p.role in ('super_admin', 'general_manager', 'manager', 'group_lead', 'team_lead')
      and coalesce(p.is_active, true) = true
      and coalesce(p.status, 'active') <> 'archive'
  );
$$;

-- ------------------------------------------
-- 2. Configurable client/project field schema
-- ------------------------------------------
create table if not exists public.project_field_configs (
  id uuid primary key default gen_random_uuid(),
  client_code text not null unique,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_field_configs_client_code_upper check (client_code = upper(client_code))
);

-- ------------------------------------------
-- 3. Project master data
-- ------------------------------------------
create table if not exists public.project_records (
  id uuid primary key default gen_random_uuid(),
  project_code text,
  title text not null,
  client_id text not null,
  client_ref uuid references public.clients (id) on delete set null,
  sub_division text,
  page_count integer,
  complexity_level text,
  status text not null default 'new',
  text_word_count integer,
  reference_count integer,
  reference_count_notes integer,
  ref_word_count integer,
  reference_style text,
  login_date date,
  revised_login_date date,
  due_date date,
  revised_due_date date,
  client_fields jsonb not null default '{}'::jsonb,
  raw_source jsonb not null default '{}'::jsonb,
  remarks text,
  queries text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_records_status_check check (
    status in ('new', 'scheduled', 'in_progress', 'on_hold', 'completed', 'delivered', 'cancelled')
  ),
  constraint project_records_page_count_nonnegative check (page_count is null or page_count >= 0),
  constraint project_records_text_word_count_nonnegative check (text_word_count is null or text_word_count >= 0),
  constraint project_records_reference_count_nonnegative check (reference_count is null or reference_count >= 0),
  constraint project_records_reference_count_notes_nonnegative check (reference_count_notes is null or reference_count_notes >= 0),
  constraint project_records_ref_word_count_nonnegative check (ref_word_count is null or ref_word_count >= 0)
);

-- ------------------------------------------
-- 4. Per-project workflow schedule and assignment
-- ------------------------------------------
create table if not exists public.project_schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project_records (id) on delete cascade,
  stage_order integer not null,
  workflow_stage text not null,
  task_type text not null,
  division text,
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_by uuid references auth.users (id) on delete set null,
  allocation_status text not null default 'unassigned',
  allocated_at timestamptz,
  due_from_performer date,
  completed_from_performer date,
  due_date date,
  revised_due_date date,
  completed_date date,
  completed_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_schedule_stage_order_positive check (stage_order > 0),
  constraint project_schedule_allocation_status_check check (
    allocation_status in ('unassigned', 'assigned', 'in_progress', 'completed', 'cancelled', 'skipped')
  ),
  unique (project_id, stage_order)
);

create table if not exists public.project_schedule_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project_records (id) on delete cascade,
  schedule_task_id uuid references public.project_schedule_tasks (id) on delete cascade,
  event_type text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------
-- 5. Indexes and timestamps
-- ------------------------------------------
create index if not exists idx_project_field_configs_client_code on public.project_field_configs (client_code);
create index if not exists idx_project_records_client_status on public.project_records (client_id, status);
create index if not exists idx_project_records_due_date on public.project_records (coalesce(revised_due_date, due_date));
create index if not exists idx_project_records_created_by on public.project_records (created_by);
create index if not exists idx_project_schedule_project_order on public.project_schedule_tasks (project_id, stage_order);
create index if not exists idx_project_schedule_assigned_to on public.project_schedule_tasks (assigned_to);
create index if not exists idx_project_schedule_status_due on public.project_schedule_tasks (allocation_status, coalesce(revised_due_date, due_date));
create index if not exists idx_project_schedule_events_project on public.project_schedule_events (project_id, created_at desc);

drop trigger if exists set_updated_at_project_field_configs on public.project_field_configs;
create trigger set_updated_at_project_field_configs
before update on public.project_field_configs
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_project_records on public.project_records;
create trigger set_updated_at_project_records
before update on public.project_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_project_schedule_tasks on public.project_schedule_tasks;
create trigger set_updated_at_project_schedule_tasks
before update on public.project_schedule_tasks
for each row
execute function public.set_updated_at();

-- ------------------------------------------
-- 6. RLS
-- ------------------------------------------
alter table public.project_field_configs enable row level security;
alter table public.project_records enable row level security;
alter table public.project_schedule_tasks enable row level security;
alter table public.project_schedule_events enable row level security;

drop policy if exists "project_field_configs_select_authenticated" on public.project_field_configs;
create policy "project_field_configs_select_authenticated"
on public.project_field_configs
for select
to authenticated
using (is_active = true or public.can_manage_project_database(auth.uid()));

drop policy if exists "project_field_configs_manage_leads" on public.project_field_configs;
create policy "project_field_configs_manage_leads"
on public.project_field_configs
for all
to authenticated
using (public.can_manage_project_database(auth.uid()))
with check (public.can_manage_project_database(auth.uid()));

drop policy if exists "project_records_select_by_scope" on public.project_records;
create policy "project_records_select_by_scope"
on public.project_records
for select
to authenticated
using (
  public.can_manage_project_database(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.project_schedule_tasks pst
    where pst.project_id = project_records.id
      and pst.assigned_to = auth.uid()
  )
);

drop policy if exists "project_records_insert_leads" on public.project_records;
create policy "project_records_insert_leads"
on public.project_records
for insert
to authenticated
with check (public.can_manage_project_database(auth.uid()));

drop policy if exists "project_records_update_leads" on public.project_records;
create policy "project_records_update_leads"
on public.project_records
for update
to authenticated
using (public.can_manage_project_database(auth.uid()))
with check (public.can_manage_project_database(auth.uid()));

drop policy if exists "project_records_delete_manager_plus" on public.project_records;
create policy "project_records_delete_manager_plus"
on public.project_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager', 'manager')
  )
);

drop policy if exists "project_schedule_tasks_select_by_scope" on public.project_schedule_tasks;
create policy "project_schedule_tasks_select_by_scope"
on public.project_schedule_tasks
for select
to authenticated
using (
  public.can_manage_project_database(auth.uid())
  or assigned_to = auth.uid()
);

drop policy if exists "project_schedule_tasks_insert_leads" on public.project_schedule_tasks;
create policy "project_schedule_tasks_insert_leads"
on public.project_schedule_tasks
for insert
to authenticated
with check (public.can_manage_project_database(auth.uid()));

drop policy if exists "project_schedule_tasks_update_leads_or_assignee" on public.project_schedule_tasks;
create policy "project_schedule_tasks_update_leads_or_assignee"
on public.project_schedule_tasks
for update
to authenticated
using (public.can_manage_project_database(auth.uid()) or assigned_to = auth.uid())
with check (public.can_manage_project_database(auth.uid()) or assigned_to = auth.uid());

drop policy if exists "project_schedule_tasks_delete_leads" on public.project_schedule_tasks;
create policy "project_schedule_tasks_delete_leads"
on public.project_schedule_tasks
for delete
to authenticated
using (public.can_manage_project_database(auth.uid()));

drop policy if exists "project_schedule_events_select_by_scope" on public.project_schedule_events;
create policy "project_schedule_events_select_by_scope"
on public.project_schedule_events
for select
to authenticated
using (
  public.can_manage_project_database(auth.uid())
  or exists (
    select 1
    from public.project_schedule_tasks pst
    where pst.project_id = project_schedule_events.project_id
      and pst.assigned_to = auth.uid()
  )
);

drop policy if exists "project_schedule_events_insert_authenticated" on public.project_schedule_events;
create policy "project_schedule_events_insert_authenticated"
on public.project_schedule_events
for insert
to authenticated
with check (
  public.can_manage_project_database(auth.uid())
  or exists (
    select 1
    from public.project_schedule_tasks pst
    where pst.project_id = project_schedule_events.project_id
      and pst.assigned_to = auth.uid()
  )
);

-- ------------------------------------------
-- 7. Seed field configs
-- ------------------------------------------
insert into public.project_field_configs (client_code, display_name, config)
values
(
  'DEFAULT',
  'Default Project Intake',
  '{
    "workflowTemplates": {
      "preedit": {
        "label": "Preedit workflow",
        "stages": [
          {"stage": "Prestyle", "taskType": "Prestyle", "division": "PreEdit"},
          {"stage": "Cast-off", "taskType": "Cast-off XML Conversion", "division": "PreEdit"},
          {"stage": "Preedit", "taskType": "Preedit", "division": "PreEdit"},
          {"stage": "FP Validation", "taskType": "FP Validation", "division": "Validation"},
          {"stage": "Revises Validation", "taskType": "Revises Validation", "division": "Validation"}
        ]
      },
      "normalisation": {
        "label": "Normalisation workflow",
        "stages": [
          {"stage": "Normalisation", "taskType": "Normalisation", "division": "PreEdit"},
          {"stage": "Cast-off", "taskType": "Cast-off XML Conversion", "division": "PreEdit"},
          {"stage": "FP Validation", "taskType": "FP Validation", "division": "Validation"},
          {"stage": "Revises Validation", "taskType": "Revises Validation", "division": "Validation"}
        ]
      }
    },
    "coreFields": [
      {"key": "title", "label": "Title", "type": "text", "required": true, "aliases": ["title", "book title", "job title"]},
      {"key": "client", "label": "Client", "type": "client", "required": true, "aliases": ["client", "customer"]},
      {"key": "subDivision", "label": "Sub Division", "type": "text", "aliases": ["sub division", "sub_div", "subdivision"]},
      {"key": "pageCount", "label": "Page Count", "type": "number", "min": 0, "aliases": ["page count", "pages", "extent"]},
      {"key": "complexityLevel", "label": "Complexity Level", "type": "text", "aliases": ["complexity level", "complexity"]},
      {"key": "status", "label": "Status", "type": "select", "defaultValue": "new", "options": ["new", "scheduled", "in_progress", "on_hold", "completed", "delivered", "cancelled"], "aliases": ["status"]},
      {"key": "textWordCount", "label": "Text Word Count", "type": "number", "min": 0, "aliases": ["text word count", "text words"]},
      {"key": "referenceCount", "label": "Reference Count", "type": "number", "min": 0, "aliases": ["reference count", "references"]},
      {"key": "referenceCountNotes", "label": "Reference count in notes", "type": "number", "min": 0, "aliases": ["reference count in notes", "reference count notes", "refs in notes"]},
      {"key": "refWordCount", "label": "Ref Word Count", "type": "number", "min": 0, "aliases": ["ref word count", "reference word count"]},
      {"key": "referenceStyle", "label": "Reference style", "type": "text", "aliases": ["reference style", "ref style"]},
      {"key": "loginDate", "label": "Login Date", "type": "date", "aliases": ["login date", "received date"]},
      {"key": "revisedLoginDate", "label": "Revised Login Date", "type": "date", "aliases": ["revised login date"]},
      {"key": "dueDate", "label": "Due Date", "type": "date", "aliases": ["due date"]},
      {"key": "revisedDueDate", "label": "Revised Due Date", "type": "date", "aliases": ["revised due date"]},
      {"key": "queries", "label": "Queries", "type": "textarea", "aliases": ["queries", "query"]},
      {"key": "remarks", "label": "Remark", "type": "textarea", "aliases": ["remark", "remarks", "notes"]}
    ],
    "scheduleFields": [
      {"key": "assignedTo", "label": "Allocated to Performer", "type": "performer"},
      {"key": "dueFromPerformer", "label": "Due from Performer", "type": "date"},
      {"key": "completedFromPerformer", "label": "Completed from Performer", "type": "date"},
      {"key": "dueDate", "label": "Due Date", "type": "date"},
      {"key": "revisedDueDate", "label": "Revised Due Date", "type": "date"},
      {"key": "completedDate", "label": "Completed Date", "type": "date"}
    ]
  }'::jsonb
),
(
  'OUP',
  'OUP',
  '{
    "fields": [
      {"key": "jobRequired", "label": "Job Required", "type": "select", "aliases": ["job required", "job type"], "options": ["MUFO", "Typecode-Only", "TS", "Reconvert", "Prestyle", "Preedit", "MS Prep"]},
      {"key": "xmlProduct", "label": "XML Product", "type": "select", "aliases": ["xml product"], "options": ["Product", "Nonproduct"]},
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division"], "options": ["Acad Oss", "Acad US", "Acad Ind", "Acad UK"]}
    ]
  }'::jsonb
),
(
  'OOH',
  'OOH',
  '{
    "fields": [
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division"], "options": ["Bloomsbury UK", "Bloomsbury US", "JHUP", "NNA", "LLP", "OOH", "OOH_AGE_PUB", "OOH_ARC", "OOH_ARM", "OOH_BritAcad", "OOH_BUP", "OOH_CP", "OOH_GS", "OOH_IBT", "OOH_IBT-Flexi", "OOH_MIP", "OOH_MUP", "OOH_RA Press", "OOH_RSC", "OOH_SUP", "OOH_UCL", "OOH_UL", "OOH_UMP", "OOH_BB", "OOH-GLB", "OOH-ICE", "OOH-JKP", "SUP", "TNF_SPIB", "Intellect", "OOH_PI", "OOH_Scribe", "OOH_WITS", "OOH_MC", "BUP-RSP", "OOH_BA", "OOH_YUP", "BAR"]}
    ]
  }'::jsonb
),
(
  'TNF',
  'TNF',
  '{
    "fields": [
      {"key": "model", "label": "Model", "type": "select", "aliases": ["model"], "options": ["Onshore", "Offshore", "Hybrid"]},
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division"], "options": ["TNF_FSM", "OOH_TNF"]}
    ]
  }'::jsonb
),
(
  'OHO_OHB',
  'OHO/OHB',
  '{
    "fields": [
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division"], "options": ["US", "UK"]}
    ]
  }'::jsonb
)
on conflict (client_code) do update
set
  display_name = excluded.display_name,
  config = excluded.config,
  updated_at = now();

grant select, insert, update, delete on public.project_field_configs to authenticated;
grant select, insert, update, delete on public.project_records to authenticated;
grant select, insert, update, delete on public.project_schedule_tasks to authenticated;
grant select, insert on public.project_schedule_events to authenticated;

commit;
