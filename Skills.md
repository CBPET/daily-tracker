# Skills — CBPET Daily Tracker

Capability catalog: what the product can do, inputs/outputs, and who can use each skill.

---

## Skill index

| ID | Skill | Primary roles |
|----|--------|----------------|
| S01 | Authenticate and recover account | All |
| S02 | Log daily task entry | Performer+ (managers can log for others) |
| S03 | Review Daily Summary | All (scoped) |
| S04 | Analyze Overview / Trends | All with analytics access |
| S05 | Manage division targets | Leads / managers / admins |
| S06 | Score Performance Rating | All with analytics access |
| S07 | Export data (CSV / XLSX) | Analytics users |
| S08 | Administer users and clients | Manager+ / admin |
| S09 | Invite / provision users | Admin Invite: GM+; Provision/Add: GM+ |
| S10 | Manage workflows | Admin |
| S11 | Weekly division performance email | System (Edge Function) |
| S12 | Raise Smart Request Hub request | All authenticated |
| S13 | Review Smart Request Hub request | Leads / managers / admins |
| S14 | Receive notifications | All authenticated |
| S15 | Review Behaviour Intelligence | Leads / managers / admins (flag) |
| S16 | Manage Feedback | Manager / GM / super_admin (flag) |
| S17 | Super Admin governance | super_admin (flag) |
| S18 | Manage Project Database and schedule | Leads / managers / admins |

---

## S01 — Authenticate and recover account

- **Inputs:** Email, password; or reset/invite link tokens in URL hash  
- **Outputs:** Session; profile load; route to app / reset / invite-accept  
- **Rules:** Hash auth callbacks sanitized via `authRedirect.js`; invite → Display Name + password; recovery → password only  
- **Components:** `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `InviteAccept`

---

## S02 — Log daily task entry

- **Inputs:** Performer, date, client, sub-division, title, optional batch 1–25, task type, completed work, auto-estimated hours, taken hours  
- **Outputs:** `status_entries` row with `timeAchieved`, `targetAchieved`, `status`, optional `batch_number`  
- **Rules:**
  - Misc: hours 1–4; target N/A; status `N/A`
  - Other tasks: estimated hours auto-calculate as `completed work × 8 ÷ target`; target from division override or standard map; taken hours &gt; 0
  - Achievement ≥100% → `Achieved`, else `Keep Trying!`
  - Optional duplicate guard (flag): same date + performer + title + task type → confirm before insert
- **Components:** `App.jsx` form; `getTargetForEntry`; `targetUtils`

---

## S03 — Review Daily Summary

- **Inputs:** Role-scoped entries; period Day / Week / Month; Team or Individual  
- **Outputs:** Weighted target/time averages; task groups; delay-based suggestions  
- **Rules:** Week = Monday–Sunday local; Misc excluded from target avg, included in time avg; suggestion when avg delay &gt; 20%  
- **Components:** `DailySummary`, `targetUtils`

---

## S04 — Analyze Overview / Trends

- **Inputs:** Filtered entries (client, performer, group-by)  
- **Outputs:** Charts, ranking (month), overtime/bottleneck tables  
- **Rules:** Trends bucket monthly/quarterly/yearly; bottleneck suggests lower target when delay &gt; 20%  
- **Components:** `Dashboard`, `OverviewDashboard`, `TrendsDashboard`

---

## S05 — Manage division targets

- **Inputs:** Client, sub-division, task type, target value  
- **Outputs:** Upsert/delete in `division_targets`  
- **Rules:** Validation task type is **`FP Validation`** (canonical); historical `FL Validation` still aliases in maps  
- **Components:** `DivisionTargetsManager`

---

## S06 — Score Performance Rating

- **Inputs:** Entries + profile map; group Individual/Team/Process; period key or week range  
- **Outputs:** Ranked scores, bands, doughnut/bar charts, improvement tips, CSV/XLSX  
- **Rules:** 60/40 composite capped; Misc = hours÷8×100; Excellent/Good/Needs Improvement  
- **Components:** `PerformanceRating`, `performanceRating.js`  
- **Deep link:** `#analytics?tab=ratings&...`

---

## S07 — Export data

- **Inputs:** Filtered or all entries; or rating rows + detail entries  
- **Outputs:** `.csv` / `.xlsx` downloads  
- **Components:** `DataExport`, `exportUtils`

---

## S08 — Administer users and clients

- **Inputs:** Role, status, client/sub-division assignments  
- **Outputs:** Updated `profiles` / `clients`  
- **Rules:** Email Verified / Pending invite / Pending confirm from `email_confirmed_at` + `onboarding`; status active/idle/archive  
- **Components:** `UserManagement`, `ClientManagement`, `AdminUserRow`

---

## S09 — Invite / provision users

| Mode | Skill behavior |
|------|----------------|
| Admin Invite | Email + role → `invite-user` function → invite email → InviteAccept (`onboarding=invite`) |
| Add New User | Immediate `signUp` + role on profile (`onboarding=signup`) |
| Provision User | Clipboard `#signup` link; default performer |

- **Resend:** Pending invite → invite email; Pending confirm → signup confirmation (`invite-user` action `resend`)  
- **Duplicate:** Verified **or** any pending account rejected on new invite (use Resend / delete pending)  
- **SQL:** `sql_commands/07_ONBOARDING.sql` on existing DBs

---

## S10 — Manage workflows

- **Inputs:** Workflow name; user assignments  
- **Outputs:** `workflows` / `workflow_assignments`  
- **Rules:** RLS may scope entries by workflow membership  
- **Components:** `WorkflowManager`

---

## S11 — Weekly division performance email

- **Inputs:** Previous Mon–Sun entries; profiles  
- **Outputs:** Email per client + sub_division to group leads (managers CC); deep link to ratings  
- **Rules:** Idempotent via `weekly_report_deliveries`; service-role must keep division isolation  
- **Components:** Edge Function `weekly-performance-report`  
- **Docs:** `docs/WEEKLY_PERFORMANCE_REPORTS.md`

---

## S12 — Raise Smart Request Hub request

- **Inputs:** Category, title, description, screenshots (optional)  
- **Outputs:** `request_hub_tickets` with 8-digit `ticket_number`; audit event; optional notifications  
- **Components:** `SmartRequestHub`, `requestHubService`  
- **Route:** `#request-hub`  
- **Flag:** `VITE_ENABLE_SMART_REQUEST_HUB`

---

## S13 — Review Smart Request Hub request

- **Inputs:** Ticket id; workflow action (approve, assign, resolve, close, …)  
- **Outputs:** Status/priority/assignee updates + `request_hub_events`  
- **Rules:** Close = manager+; RLS scopes visibility  
- **Components:** `RequestDetail`, `RequestActions`

---

## S14 — Receive notifications

- **Inputs:** Trusted dispatch from Request Hub / Daily Tracker events  
- **Outputs:** Bell unread count; drawer / center actions  
- **Components:** `NotificationProvider`, `dispatch-notification` Edge Function  
- **Flag:** `VITE_ENABLE_NOTIFICATIONS`

---

## S15 — Review Behaviour Intelligence

- **Inputs:** Entries + optional snapshots; period filters  
- **Outputs:** Behaviour Score 0–100 (not Performance Rating); manager dashboard; leaderboards; heatmaps  
- **Components:** `EnterpriseAnalytics`, `behaviourScore.js`  
- **Deep link:** `#analytics?tab=behaviour`  
- **Flag:** `VITE_ENABLE_BEHAVIOUR_ANALYTICS=true` (default off)

---

## S16 — Manage Feedback

- **Inputs:** Internal/External feedback fields  
- **Outputs:** `feedback_records` (+ soft-archive)  
- **Components:** `FeedbackModule`  
- **Flag:** `VITE_ENABLE_FEEDBACK_MODULE=true`

---

## S17 — Super Admin governance

- **Inputs:** Ticket override / transfer / merge / archive / restore + required reason  
- **Outputs:** Ticket updates + `enterprise_audit_log`  
- **Components:** `SuperAdminGovernance`  
- **Flag:** `VITE_ENABLE_SUPER_ADMIN_GOVERNANCE=true`

---

## S18 — Manage Project Database and schedule

- **Inputs:** Project basic fields, client-specific fields, raw pasted Google Sheet row, workflow template, stage dates, performer assignment
- **Outputs:** `project_records`, `project_schedule_tasks`, optional `project_schedule_events`
- **Rules:**
  - Project master data is separate from daily `status_entries`
  - Default workflows: Prestyle -> Cast-off -> Preedit -> FP Validation -> Revises Validation; Normalisation -> Cast-off -> FP Validation -> Revises Validation
  - Client-specific fields are configurable JSON (`project_field_configs` / `client_fields`)
  - Leads/managers can create projects and assign any performer to any division/task
- **Libraries:** `projectFieldConfig.js`
- **SQL:** `sql_commands/10_PROJECT_DATABASE.sql`

---

## Role × skill matrix (summary)

| Skill | Performer | Team/Group Lead | Manager | GM / Super Admin |
|-------|-----------|-----------------|---------|------------------|
| S01 Auth | Y | Y | Y | Y |
| S02 Log entry | Own | Own (+ team view) | Self + others | Self + others |
| S03 Summary | Own | Team/individual | Broad | Broad |
| S04–S07 Analytics | Limited | Scoped | Broad | Broad |
| S05 Targets | — | Y* | Y | Y |
| S08–S10 Admin | — | — | Partial | Full |
| S09 Admin Invite | — | — | — | Y |
| S12–S14 Request Hub / Notify | Y | Y | Y | Y |
| S15 Behaviour | — | Y (flag) | Y | Y |
| S16 Feedback | — | — | Y (flag) | Y |
| S17 Governance | — | — | — | Super admin (flag) |
| S18 Project DB / Schedule | — | Y | Y | Y |

\*Division Targets tab available to leads/managers as mounted in Dashboard.
