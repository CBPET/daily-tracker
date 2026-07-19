-- ==========================================
-- Project records status (iTitle Form Entry)
-- ==========================================
-- PREREQUISITE: Run 10_PROJECT_DATABASE.sql (and preferably 11_).
-- Replaces project_records.status check with Form Entry values.
-- Default: yet_to_plan
-- ==========================================

begin;

-- Map legacy status values before tightening the check
update public.project_records
set status = case status
  when 'new' then 'yet_to_plan'
  when 'scheduled' then 'yet_to_plan'
  when 'in_progress' then 'wip'
  when 'on_hold' then 'on_hold'
  when 'completed' then 'completed'
  when 'delivered' then 'completed'
  when 'cancelled' then 'on_hold'
  else status
end
where status in ('new', 'scheduled', 'in_progress', 'on_hold', 'completed', 'delivered', 'cancelled');

alter table public.project_records
  alter column status set default 'yet_to_plan';

alter table public.project_records
  drop constraint if exists project_records_status_check;

alter table public.project_records
  add constraint project_records_status_check check (
    status in (
      'yet_to_plan',
      'allocated',
      'completed',
      'on_hold',
      'qc',
      'wip',
      'query'
    )
  );

-- Refresh client field options / aliases used by Form Entry + paste
insert into public.project_field_configs (client_code, display_name, config)
values
(
  'OUP',
  'OUP',
  '{
    "fields": [
      {"key": "jobRequired", "label": "Job Required", "type": "select", "aliases": ["job required", "job type"], "options": ["MUFO", "Typecode-Only", "TS", "Reconvert", "Prestyle", "Preedit", "MS Prep"]},
      {"key": "xmlProduct", "label": "XML Product", "type": "select", "aliases": ["xml product", "xml product (product/nonproduct)"], "options": ["Product", "Nonproduct"]},
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division", "client/div", "client / div"], "options": ["Acad Oss", "Acad US", "Acad Ind", "Acad UK", "Law UK", "Law UK HE", "Law US", "Law US HE", "Med UK", "MED UK HB", "Med US", "MED HB", "LOOU"]}
    ]
  }'::jsonb
),
(
  'OOH',
  'OOH',
  '{
    "fields": [
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division", "client"], "options": ["Bloomsbury UK", "Bloomsbury US", "JHUP", "NNA", "LLP", "OOH", "OOH_AGE_PUB", "OOH_ARC", "OOH_ARM", "OOH_BritAcad", "OOH_BUP", "OOH_CP", "OOH_GS", "OOH_IBT", "OOH_IBT-Flexi", "OOH_MIP", "OOH_MUP", "OOH_RA Press", "OOH_RSC", "OOH_SUP", "OOH_UCL", "OOH_UL", "OOH_UMP", "OOH_BB", "OOH-GLB", "OOH-ICE", "OOH-JKP", "SUP", "TNF_SPIB", "Intellect", "OOH_PI", "OOH_Scribe", "OOH_WITS", "OOH_MC", "BUP-RSP", "OOH_BA", "OOH_YUP", "BAR"]}
    ]
  }'::jsonb
),
(
  'TNF',
  'TNF',
  '{
    "fields": [
      {"key": "model", "label": "Model", "type": "select", "aliases": ["model", "onshore/offshore", "onshore / offshore"], "options": ["Onshore", "Offshore", "Hybrid"]},
      {"key": "subDivision", "label": "SUB_DIV", "type": "select", "aliases": ["sub_div", "sub division", "client"], "options": ["TNF_FSM", "OOH_TNF"]}
    ]
  }'::jsonb
)
on conflict (client_code) do update
set
  display_name = excluded.display_name,
  config = excluded.config,
  updated_at = now();

commit;
