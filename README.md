# CBPET Daily Tracker

Enterprise daily performance tracking for the CBPET team: role-based access, task logging, analytics, and Supabase-backed persistence with Row Level Security (RLS).

[![Deploy to GitHub Pages](https://github.com/cbpet/daily-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/cbpet/daily-tracker/actions/workflows/deploy.yml)

**Companion docs**

| File | Purpose |
|------|---------|
| [Skills.md](./Skills.md) | Feature capabilities by skill / role |
| [dev_remark.md](./dev_remark.md) | Developer notes, SQL order, pitfalls |
| [test_use_case.md](./test_use_case.md) | Manual test cases |
| [docs/PROJECT_DATABASE.md](./docs/PROJECT_DATABASE.md) | Project master data, client fields, schedule tracking |
| [docs/github_setup.md](./docs/github_setup.md) | GitHub Pages deployment setup |
| [docs/vercel_setup.md](./docs/vercel_setup.md) | Vercel deployment setup |
| [docs/firebase_setup.md](./docs/firebase_setup.md) | Firebase Hosting deployment setup |

---

## 1. Overview

| Item | Detail |
|------|--------|
| Stack | React 18, Vite 6, Tailwind CSS 3, Supabase (Auth + Postgres + RLS), Chart.js, Lucide, SheetJS (`xlsx`) |
| Hosting | GitHub Pages via Actions (`.github/workflows/deploy.yml`) |
| Auth | Email/password; hash-based in-app routes (`#form`, `#analytics`, `#request-hub`, `#admin`) |
| Data | `status_entries`, `project_records`, `project_schedule_tasks`, `profiles`, `clients`, `division_targets`, `request_hub_*`, `notifications`, behaviour snapshots / feedback as configured |

### Environment

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy from `.env.example` if present. Never commit secrets.

For hosted builds, store these values in the platform environment/secrets settings. The Supabase anon key is bundled into the browser app; this is expected, but production safety depends on Supabase Row Level Security. Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or client-side hosting settings.

```bash
npm install
npm run dev          # local
npm run build        # production → dist/
npm test             # node tests for rating + project config helpers
npm run deploy       # legacy gh-pages publish; production uses GitHub Actions
```

---

## 2. Architecture

```text
Browser (React SPA)
  ├── #form          Entry Form + Daily Summary (+ optional batch / duplicate guard)
  ├── #analytics     Dashboard (Overview / Trends / Targets / Performance Rating / Behaviour Intelligence)
  ├── #request-hub   Smart Request Hub (tickets, workflow, screenshots)
  └── #admin         Administration (Users / Clients / Workflows / Project setup)

Supabase
  ├── Auth (SMTP = Gmail for auth/invite emails)
  ├── Postgres + RLS
  ├── Storage (request-hub-screenshots)
  └── Edge Functions (service role)
        ├── invite-user
        ├── weekly-performance-report
        ├── dispatch-notification
        ├── request-hub-reminders
        └── calculate-behaviour-snapshots
```

**Core app shell:** [`src/App.jsx`](src/App.jsx) — session, profile, hash routing, entry form, admin modals, data fetch scoped by role.

**Enterprise modules:** Smart Request Hub (`src/components/requestHub/`), Notifications (`src/components/notifications/`), Behaviour Intelligence (`src/components/enterpriseAnalytics/`). Feature flags: see `.env.example`.

**Deep links:** `#analytics?tab=ratings&...` (Performance Rating); `#analytics?tab=behaviour` (Behaviour Intelligence). Auth callbacks use base URL without `#`; app parses hash tokens via [`src/lib/authRedirect.js`](src/lib/authRedirect.js).

---

## 3. Roles and access rules

| Role | Typical scope | UI highlights |
|------|---------------|---------------|
| `super_admin` | Org-wide | Admin tab, invites, user CRUD, clients, workflows, delete entries |
| `general_manager` | Org-wide | Same as above for user/invite management |
| `manager` | Broad analytics | Analytics filters, User Management (no Admin Invite), delete entries |
| `group_lead` | Client + sub-division members | Team/individual summary, limited admin targets |
| `team_lead` | Team members | Team/individual summary, division targets where allowed |
| `performer` | Own entries only | Entry form, own Daily Summary, personal analytics |

**Entry fetch rules (App):** performer → `user_id = self`; team_lead → team member IDs; group_lead → profiles matching `client_ref` / `sub_division`; managers/admins → broader list subject to RLS.

**Form performer select:** only `super_admin` / `general_manager` / `manager` can log on behalf of others.

---

## 4. User onboarding (three paths)

| Path | Who | Behavior |
|------|-----|----------|
| **Admin Invite** | super_admin, general_manager | Email + role → Edge Function `invite-user` → Auth invite email → **InviteAccept** (display name + password). Sets `profiles.onboarding = invite`. |
| **Add New User** | super_admin, general_manager | Email + name + role → client `signUp` + profile update (`onboarding = signup`) |
| **Provision User** | Admin UI | Copy `#signup` link / message; user self-registers as performer; role assigned later |

Display name from email: [`src/lib/displayName.js`](src/lib/displayName.js) (`jane.doe@co.com` → `Jane Doe`).

**Email verified:** `profiles.email_confirmed_at` sync support is part of the Supabase setup SQL. User Management shows **Verified** / **Pending invite** / **Pending confirm** + path-aware Resend. Apply [`sql_commands/07_ONBOARDING.sql`](sql_commands/07_ONBOARDING.sql) on existing DBs.

---

## 5. Business rules

### Task types and targets (8-hour day)

Standard targets used in entry form ([`App.jsx`](src/App.jsx)):

| Task | Target | Notes |
|------|--------|-------|
| Prestyle | 900 pages | |
| Preedit | 300 pages | |
| FP Validation | 600 pages | Form uses **FP**; some analytics maps also list **FL Validation** |
| Revises Validation | 1200 pages | |
| Normalisation | 300 pages | |
| Cast-off XML Conversion | 4 titles | |
| Ref Edit | 400 refs | |
| Style Editing | 80 pages | |
| **Miscellaneous** | none | No productivity target; status `N/A` |

Division overrides: `division_targets` (client + sub_division + task_type).

**Target achievement (non-Misc):**

`completedPages / ((target / 8) * takenTime) * 100`

**Estimated hours (non-Misc):**

`completedPages * 8 / target`

**Time efficiency:**

`estimatedTime / takenTime * 100`

### Hours validation

| Task | Estimated / Taken |
|------|-------------------|
| Miscellaneous | **1.0–4.0** only (UI + DB conditional checks) |
| All other tasks | Estimated hours auto-calculate from completed work and target; taken hours must be **> 0** |

SQL constraints are included in the Supabase setup files under [`sql_commands/`](sql_commands/).

### Daily Summary

- Periods: **Day** (date picker), **This Week** (Mon–Sun local), **This Month**
- Team / Individual for leads/managers
- Target avg excludes Misc from weighted target %; time efficiency includes all
- Suggestions: delay > 20% → proposed lower daily target (by task + client + sub_division)

### Performance Rating

- Score (standard): `60% × capped target + 40% × capped time` (cap 100)
- Misc score: `(takenHours / 8) × 100` (cap 100)
- Groups: Individual / Team / Process; filters Monthly / Quarterly / Yearly
- Bands: Excellent ≥90, Good ≥75, Needs Improvement &lt;75
- Export CSV / XLSX via [`exportUtils.js`](src/lib/exportUtils.js)

---

## 6. Component catalog

### Shell and entry

| Component / file | Logic |
|------------------|--------|
| [`src/App.jsx`](src/App.jsx) | Auth bootstrap, hash tabs, entry form submit → Supabase insert, role-scoped fetch, admin modals (Add / Provision / Admin Invite) |
| [`DailySummary.jsx`](src/components/DailySummary.jsx) | Period filters, grouping by task, metrics via `aggregateDayMetrics`, delay suggestions |
| [`LandingPage.jsx`](src/components/LandingPage.jsx) | Public splash → login |
| [`Toast.jsx`](src/components/Toast.jsx) / [`Modal.jsx`](src/components/Modal.jsx) | Feedback / dialogs |

### Analytics

| Component | Logic |
|-----------|--------|
| [`Dashboard.jsx`](src/components/Dashboard.jsx) | Sub-tabs; client/performer filters; mounts Overview, Trends, Division Targets, Performance Rating; deep-link support |
| [`OverviewDashboard.jsx`](src/components/OverviewDashboard.jsx) | Summary cards, bar/pie charts, breakdown table |
| [`TrendsDashboard.jsx`](src/components/TrendsDashboard.jsx) | Monthly/quarterly/yearly trends, overtime, bottleneck target corrections |
| [`PerformanceRating.jsx`](src/components/PerformanceRating.jsx) | Composite scores, charts, bands, suggestions, rating exports |
| [`DivisionTargetsManager.jsx`](src/components/DivisionTargetsManager.jsx) | CRUD custom targets per client/sub-division/task |
| [`DataExport.jsx`](src/components/DataExport.jsx) | CSV/XLSX for filtered or all entries |

### Project database and scheduling

Next-phase project tracking uses separate project tables instead of adding intake fields to daily `status_entries`.

| Area | Logic |
|------|-------|
| Project master | `project_records`: title, client, sub-division, counts, due dates, remarks, queries |
| Client fields | `project_field_configs` + `client_fields` JSONB for OUP / OOH / TNF / OHO-OHB variants |
| Schedule | `project_schedule_tasks`: workflow stage, division, task, performer assignment, due dates, completion |
| Raw paste | `src/lib/projectFieldConfig.js` maps pasted Google Sheet headers into normalized fields |

See [`docs/PROJECT_DATABASE.md`](docs/PROJECT_DATABASE.md).

### Administration

| Component | Logic |
|-----------|--------|
| [`UserManagement.jsx`](src/components/UserManagement.jsx) | Roles, status (active/idle/archive), client/sub-division, email Verified/Pending, Resend invite |
| [`AdminUserRow.jsx`](src/components/AdminUserRow.jsx) | Legacy inline role row (fallback admin table) |
| [`ClientManagement.jsx`](src/components/ClientManagement.jsx) | Clients CRUD |
| [`WorkflowManager.jsx`](src/components/WorkflowManager.jsx) | Workflows + assignments |
| [`TeamManagement.jsx`](src/components/TeamManagement.jsx) | Team hierarchy UI (where used) |
| [`ChangePassword.jsx`](src/components/ChangePassword.jsx) | Logged-in password change |
| [`AdminResetUserPassword.jsx`](src/components/AdminResetUserPassword.jsx) | Admin-triggered reset email |

### Auth

| Component | Logic |
|-----------|--------|
| [`Login.jsx`](src/components/Login.jsx) / [`Signup.jsx`](src/components/Signup.jsx) | Sign-in / public register |
| [`ForgotPassword.jsx`](src/components/ForgotPassword.jsx) | `resetPasswordForEmail` |
| [`ResetPassword.jsx`](src/components/ResetPassword.jsx) | Recovery: new password only |
| [`InviteAccept.jsx`](src/components/InviteAccept.jsx) | Invite: display name + password |
| [`ProtectedRoute.jsx`](src/components/ProtectedRoute.jsx) | Guard helper (if wired) |

### Libraries

| File | Logic |
|------|--------|
| [`supabase.js`](src/lib/supabase.js) | Client; implicit auth flow |
| [`authRedirect.js`](src/lib/authRedirect.js) | Callback parse, recovery/invite detection, sanitize hash |
| [`targetUtils.js`](src/lib/targetUtils.js) | Targets, day aggregates, week/month helpers, suggestions |
| [`performanceRating.js`](src/lib/performanceRating.js) | Scoring, bands, period filters, deep links, division partition |
| [`exportUtils.js`](src/lib/exportUtils.js) | Entry + rating CSV/XLSX |
| [`displayName.js`](src/lib/displayName.js) | Email → display name |

**Note:** [`Leaderboard.jsx`](src/components/Leaderboard.jsx) exists but is not mounted in the current Dashboard tab set; prefer Performance Rating.

---

## 7. Database and Edge Functions

### SQL setup

Run the SQL files in order for a fresh Supabase project:

| Script | Purpose |
|--------|---------|
| [`01_FRESH_CORE.sql`](sql_commands/01_FRESH_CORE.sql) | Core tables, auth/profile foundations, and RLS |
| [`02_CLIENT_HIERARCHY.sql`](sql_commands/02_CLIENT_HIERARCHY.sql) | Clients, sub-divisions, and leadership hierarchy |
| [`03_DIVISION_TARGETS.sql`](sql_commands/03_DIVISION_TARGETS.sql) | Division target configuration |
| [`04_REQUEST_HUB.sql`](sql_commands/04_REQUEST_HUB.sql) | Smart Request Hub tables and policies |
| [`05_NOTIFICATIONS.sql`](sql_commands/05_NOTIFICATIONS.sql) | Notification tables and support objects |
| [`06_ANALYTICS.sql`](sql_commands/06_ANALYTICS.sql) | Enterprise analytics, feedback, and governance objects |
| [`10_PROJECT_DATABASE.sql`](sql_commands/10_PROJECT_DATABASE.sql) | Project master data, configurable client fields, schedule tracking |
| [`VERIFY_ALL.sql`](sql_commands/VERIFY_ALL.sql) | Post-setup verification checks |

See [`sql_commands/README.md`](sql_commands/README.md) for the database setup sequence.

### Edge Functions

| Function | Role |
|----------|------|
| `supabase/functions/invite-user` | Admin invite / resend (`inviteUserByEmail`); requires caller JWT + admin role |
| `supabase/functions/weekly-performance-report` | Weekly division emails (Google SMTP secrets per plan) |

Set `APP_URL` for invite redirect. Auth emails use Supabase Auth SMTP (Gmail).

---

## 8. Project structure (current)

```text
Daily-Tracker/
├── .github/workflows/deploy.yml
├── docs/                          # Setup, RBAC, email, invite guides
├── sql_commands/                  # All SQL migrations
├── supabase/functions/            # Edge Functions
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/                # UI (see catalog above)
│   └── lib/                       # supabase, rating, export, auth helpers
├── README.md
├── Skills.md
├── dev_remark.md
├── test_use_case.md
├── package.json
└── vite.config.js
```

---

## 9. Further documentation

| Guide | Topic |
|-------|-------|
| [docs/github_setup.md](docs/github_setup.md) | GitHub Pages setup |
| [docs/vercel_setup.md](docs/vercel_setup.md) | Vercel setup |
| [docs/firebase_setup.md](docs/firebase_setup.md) | Firebase Hosting setup |
| [docs/PROJECT_DATABASE.md](docs/PROJECT_DATABASE.md) | Project database and schedule tracking |
| [sql_commands/README.md](sql_commands/README.md) | Supabase SQL setup order |
| [dev_remark.md](dev_remark.md) | Developer notes and operational reminders |
| [test_use_case.md](test_use_case.md) | Manual test scenarios |

---

## License

Open for fork and self-hosted use. Add a `LICENSE` file for distribution.

© 2024–2026 CBPET Daily Tracker contributors.
