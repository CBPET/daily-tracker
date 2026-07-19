# Fresh Supabase setup (greenfield only)

Use this folder for a **brand-new** Supabase project.  
Do **not** run these scripts on an existing production database.

Live upgrades should keep using the root `sql_commands/` migrations
(`ROLE_RLS_PREFLIGHT.sql`, `SMART_REQUEST_HUB_PHASE1.sql`, etc.).

## Apply order (SQL Editor)

Run each file once, in order:

| Step | File | What it creates |
|------|------|-----------------|
| 1 | `01_FRESH_CORE.sql` | Core tables, RLS, analytics views. Roles: `super_admin`, `general_manager`, `manager`, `group_lead`, `team_lead`, `performer` |
| 2 | `02_CLIENT_HIERARCHY.sql` | `clients`, `client_ref`, `sub_division` |
| 3 | `03_DIVISION_TARGETS.sql` | `division_targets` (write roles use `manager`, not `assistant_manager`) |
| 4 | `04_REQUEST_HUB.sql` | Smart Request Hub tables + storage bucket |
| 5 | `05_NOTIFICATIONS.sql` | Enterprise notifications |
| 6 | `06_ANALYTICS.sql` | Behaviour snapshots, feedback, `batch_number`, audit |
| 7 | `07_ONBOARDING.sql` | `profiles.onboarding` (`invite` / `signup`) for Resend split |
| 8 | `08_PROFILES_STATUS.sql` | `profiles.status` (`active` / `idle` / `archive`) for User Management |
| 9 | `09_REQUEST_HUB_RLS_FIX.sql` | Fix `can_view_request_hub_ticket` so creators see INSERT … RETURNING |
| 10 | `10_PROJECT_DATABASE.sql` | Project master data, configurable client fields, schedule tracking |
| 11 | `11_PROJECT_SCHEDULE_DATE_ACL.sql` | Lead-only date ACL trigger + `project_schedule_events.reason_code` |

Then run:

| Step | File |
|------|------|
| 12 | `VERIFY_ALL.sql` |

## After SQL

1. Create the first Auth users in the app or Supabase Auth.
2. Promote admins (example):

```sql
update public.profiles
set role = 'super_admin'
where email = 'you@company.com';
```

3. Deploy Edge Functions: `dispatch-notification`, `request-hub-reminders`, `calculate-behaviour-snapshots`.
4. Set Vite flags in `.env` as needed (`VITE_ENABLE_*`). Level 3 flags default off.

## Verified against product (2026-07)

- Enum and status/performance RLS use **`manager`** (matches live UI / invite flow).
- **`group_lead`** is in the enum from step 1 (step 2 enum add is a no-op).
- Enterprise Phases 1–3 are included so a greenfield DB matches the current app surface.
