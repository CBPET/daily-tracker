# Project Database + Schedule Tracking Plan

## Summary
Build a new Project Database area separate from daily `status_entries`. Leads/managers can create projects by pasting raw Google Sheet data, filling a manual form, or using a future PubKit endpoint import. All visible fields come from JSON configuration, and workflow schedule tasks are generated after the user chooses a workflow template during project creation.

## Key Changes
- Add project tables:
  - `project_field_configs`: database source for configurable field JSON, with admin-editable config.
  - `project_records`: project/title master row with normalized core values, `client_fields`, `raw_source`, queries, remarks, and dates.
  - `project_schedule_tasks`: workflow stage, division, task, assigned performer, due/revised/completed dates.
  - `project_schedule_events`: audit trail.
- Remove `TAT(Days)` from OOH/client configuration.
- Do not hardcode visible fields in UI. The UI renders fields from JSON config.
- Keep fallback frontend defaults only for recovery when DB config is missing.
- Keep existing daily entry and analytics behavior unchanged.

## Field Configuration
- `project_field_configs.config` is the primary source of truth.
- Add an admin JSON editor so authorized users can update field definitions without a rebuild.
- Field config supports:
  - Core fields such as Title, Client, Sub Division, Page Count, Complexity Level, Status.
  - Count fields such as Text Word Count, Reference Count, Reference count in notes, Ref Word Count.
  - Reference style.
  - Date fields such as Login Date, Revised Login Date, Due Date, Revised Due Date.
  - Remarks and queries.
  - Client-specific field groups.
- Manual form, paste preview, and PubKit preview all use the same JSON config.

## Intake UI
- Add Admin sub-tab: `Project Database`.
- Provide three create/import options:
  - `Option #1`: Paste raw Google Sheet data into a preview grid.
  - `Option #2`: Fill all project data manually.
  - `Option #3`: PubKit endpoint import feature.
- Paste/import preview:
  - Normalize headers using configured aliases.
  - Show validation status per row.
  - Allow selecting rows before saving.
  - Store original source payload in `raw_source`.
- PubKit:
  - Implement as a configurable service interface in v1 unless endpoint contract is available.
  - PubKit results go through the same preview grid before save.

## Workflow and Schedule
- During project creation, user selects a workflow template.
- After project save, schedule rows are created immediately from the selected workflow.
- Default workflow templates:
  - `Prestyle -> Cast-off -> Preedit -> FP Validation -> Revises Validation`
  - `Normalisation -> Cast-off -> FP Validation -> Revises Validation`
- Schedule rows track:
  - Allocated to Performer
  - Due from Performer
  - Completed from Performer
  - Due Date
  - Revised Due Date
  - Completed Date
- Leads/managers can assign any performer to any division/task.
- Performers can view tasks assigned to them.

## Tests
- Unit tests:
  - JSON field config rendering helpers.
  - Raw header normalization from configured aliases.
  - Workflow template schedule generation.
  - Mock PubKit adapter normalization.
- Manual tests:
  - Admin edits JSON field config and form updates.
  - Manual project creation.
  - Paste preview, validate, select rows, save.
  - PubKit mocked import preview.
  - Workflow selected during creation creates schedule rows.
  - Assign performer to schedule task.
  - Performer sees assigned task.
- Regression:
  - `npm test`
  - `npm run build`
  - Existing daily form, summary, analytics, clients, and workflows still work.

## Assumptions
- `TAT(Days)` is removed completely from v1 field config.
- Field configuration should be database-driven and admin-editable.
- Workflow template is chosen during project creation and schedule rows are generated immediately after save.
- Any lead can assign any performer, matching your requirement.
