# Project Database and Schedule Tracking

This phase adds project master data and per-stage schedule tracking. It is separate from `status_entries`.

## Why a Separate Table

`status_entries` is a daily performance log: who did what work, how many pages/refs/titles, estimated hours, taken hours, and target achievement.

Project intake is different data: title metadata, client-specific fields, due dates, workflow stages, allocation, performer due dates, completion dates, queries, and remarks. Keeping this in separate tables avoids bloating daily entries and lets one project have many scheduled tasks.

## Tables

| Table | Purpose |
|---|---|
| `project_field_configs` | JSON configuration for default and client-specific intake fields |
| `project_records` | One row per project/title with basic project information |
| `project_schedule_tasks` | One row per project workflow stage, assignment, due dates, and completion tracking |
| `project_schedule_events` | Audit/event trail for project and schedule changes |

Apply migration:

```bash
sql_commands/10_PROJECT_DATABASE.sql
```

Run it after `02_CLIENT_HIERARCHY.sql` because it can reference `clients`.

## Project Fields

Default fields:

| Field | Stored column |
|---|---|
| Title | `project_records.title` |
| Client | `project_records.client_id` / `client_ref` |
| Sub Division | `project_records.sub_division` |
| Page Count | `project_records.page_count` |
| Complexity Level | `project_records.complexity_level` |
| Status | `project_records.status` |
| Text Word Count | `project_records.text_word_count` |
| Reference Count | `project_records.reference_count` |
| Reference count in notes | `project_records.reference_count_notes` |
| Ref Word Count | `project_records.ref_word_count` |
| Reference style | `project_records.reference_style` |
| Login/Revised Login/Due/Revised Due | date columns |
| Queries/Remark | `queries`, `remarks` |

Client-specific fields are stored in `project_records.client_fields` as JSONB. This is intentional: OUP, OOH, TNF, and OHO/OHB have different fields and option lists.

## Client-Specific Fields

Configured in both:

- `project_field_configs.config` in Supabase
- [projectFieldConfig.js](../src/lib/projectFieldConfig.js) for frontend defaults and raw-paste mapping

Initial clients:

| Client | Fields |
|---|---|
| OUP | Job Required, XML Product, SUB_DIV |
| OOH | SUB_DIV |
| TNF | Model, SUB_DIV |
| OHO/OHB | SUB_DIV |

## Workflow Templates

Preedit workflow:

```text
Prestyle -> Cast-off -> Preedit -> FP Validation -> Revises Validation
```

Normalisation workflow:

```text
Normalisation -> Cast-off -> FP Validation -> Revises Validation
```

Each stage becomes a `project_schedule_tasks` row with:

```text
Allocated to Performer
Due from Performer
Completed from Performer
Due Date
Revised Due Date
Completed Date
```

Leads/managers can assign any performer to any division/task through these schedule rows. Performers can see their assigned project schedule tasks.

## Raw Google Sheet Paste

The field JSON includes aliases used by paste/import mapping. A pasted row like:

```text
Title | Client | SUB_DIV | Pages | Remark
```

can be normalized into:

```json
{
  "title": "...",
  "client": "...",
  "subDivision": "...",
  "pageCount": "...",
  "remarks": "..."
}
```

The original pasted data can be stored in `project_records.raw_source` for traceability.
