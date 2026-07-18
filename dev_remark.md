# Developer remarks — CBPET Daily Tracker

Practical notes for maintainers. Prefer this file over outdated marketing README sections.

---

## 1. Do not break live databases

- **Never** re-run [`sql_commands/FRESH_SUPABASE_SETUP.sql`](sql_commands/FRESH_SUPABASE_SETUP.sql) on an existing production project.
- For a **brand-new** Supabase project, use [`sql_commands/fresh/`](sql_commands/fresh/README.md) (`01`–`06` + `VERIFY_ALL.sql`) instead of the legacy root FRESH script.
- Use incremental scripts (`MISC_HOURS_*`, `EMAIL_CONFIRMED_SYNC`, hierarchy, targets, weekly deliveries, `07_ONBOARDING.sql`).
- Constraints added with `NOT VALID` still enforce new inserts; they do not rewrite old rows.

### Recommended SQL order for current feature set (existing DB)

1. Hierarchy / clients / roles (if not already): `CLIENT_HIERARCHY_MIGRATION.sql`, role/status updates as needed  
2. `ADD_DIVISION_TARGETS.sql`  
3. `MISC_HOURS_RANGE_CONSTRAINT.sql` (replaces global 1–4)  
4. `EMAIL_CONFIRMED_SYNC.sql`  
5. `WEEKLY_REPORT_DELIVERIES.sql` (if using weekly email)  
6. **Enterprise:** `ROLE_RLS_PREFLIGHT.sql` → `SMART_REQUEST_HUB_PHASE1.sql` → `ENTERPRISE_NOTIFICATIONS_PHASE2.sql` → `ENTERPRISE_ANALYTICS_PHASE3.sql`  
7. Run matching `*_VERIFY.sql` scripts after each enterprise migration  
8. Duplicate audit only: `STATUS_ENTRIES_DUPLICATES_REPORT.sql` — **do not** add a unique index until cleaned  
9. Onboarding path split: `sql_commands/07_ONBOARDING.sql` (invite vs signup Resend)

---

## 2. Hours rule (important)

- **Only `Miscellaneous`** is limited to 1–4 hours (estimated + taken).
- Other tasks: any positive hours; placeholders suggest a full day (e.g. 8.0).
- Productive tasks auto-estimate hours as `completed work × 8 ÷ target`; taken hours remains manual.

If an old global 1–4 constraint is still live, inserts of 6–8h on Preedit will fail until `MISC_HOURS_RANGE_CONSTRAINT.sql` is applied.

---

## 3. Edge Functions

| Function | Path | Secrets / notes |
|----------|------|-----------------|
| `invite-user` | `supabase/functions/invite-user` | `APP_URL`, platform `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`; caller must be GM/super_admin JWT |
| `weekly-performance-report` | `supabase/functions/weekly-performance-report` | `APP_URL`, Gmail SMTP secrets if switched from Resend; partition by client+sub_division |
| `dispatch-notification` | `supabase/functions/dispatch-notification` | JWT caller; service role inserts notifications |
| `request-hub-reminders` | `supabase/functions/request-hub-reminders` | Cron + service role; see `docs/REQUEST_HUB_REMINDERS.md` |
| `calculate-behaviour-snapshots` | `supabase/functions/calculate-behaviour-snapshots` | Cron + service role; see `docs/BEHAVIOUR_SNAPSHOTS.md` |

Deploy example:

```bash
supabase functions deploy invite-user
supabase functions deploy weekly-performance-report
supabase functions deploy dispatch-notification
supabase functions deploy request-hub-reminders
supabase functions deploy calculate-behaviour-snapshots
```

Frontend calls invite via:

`POST ${VITE_SUPABASE_URL}/functions/v1/invite-user`  
Headers: `Authorization: Bearer <user_access_token>`, `apikey: <anon>`

---

## 4. Email systems are separate

| Channel | What it sends | Config |
|---------|---------------|--------|
| Supabase Auth SMTP (Gmail) | Signup confirm, password reset, **inviteUserByEmail** | Dashboard → Auth → SMTP |
| Weekly report function | Custom HTML division reports | Function SMTP/API secrets — **not** Auth SMTP settings |

Do not expect Auth SMTP alone to power arbitrary Edge Function emails unless the function sends via SMTP itself.

---

## 5. Naming inconsistencies to watch

- Entry form / Division Targets: **`FP Validation`** (canonical).
- Historical rows / maps may still contain **`FL Validation`** — `normalizeTaskType()` aliases FL → FP for scoring.
- Role enum historically used `assistant_manager` in SQL while UI uses `manager` — run `ROLE_RLS_PREFLIGHT.sql` before enterprise RLS.
- **Behaviour Score** ≠ **Performance Rating** — do not merge UI labels.

---

## 6. Dead / secondary code

- [`src/components/Leaderboard.jsx`](src/components/Leaderboard.jsx) — not mounted; use Behaviour Intelligence leaderboards or Performance Rating instead.
- Duplicate target maps in `App.jsx`, `Dashboard.jsx`, `targetUtils.js` — change all three when adjusting standards.

---

## 7. Routing and auth callbacks

- App tabs: `#form`, `#analytics`, `#request-hub`, `#admin` (mapped inside `App.jsx`).
- Auth redirect URL must be **origin + base path without `#`**. Tokens arrive in hash; `completeAuthCallback` sets session then sanitizes to `#invite-accept` / `#reset-password` / `#login`.
- **Signup confirm** (`type=signup`) must open app/login — never InviteAccept. Any auth error (e.g. Invalid API key) stays on login with a clear message.
- Double-hash quirks (`#login#access_token=...`) are handled in `authRedirect.js`.
- `VITE_SUPABASE_ANON_KEY` must be the **anon** key for the same project as `VITE_SUPABASE_URL`; rebuild after changing secrets.

---

## 8. Git / deploy

- Production build: `npm run build` → `dist/`; Pages must serve `dist`, not source.
- Push may fail if local Git credentials belong to a user without write access to `ArockiaAlexander/Daily-Tracker` (403). Fix remotes/credentials before forcing pushes.
- Commit only related files; do not commit `.env`.

---

## 9. Testing

```bash
npm test    # performanceRating unit tests (node:test)
npm run build
```

Manual scenarios: [`test_use_case.md`](./test_use_case.md).

---

## 10. Product backlog hints (not implemented)

- Automated estimate hours for non-Misc tasks  
- Unify FP/FL Validation naming  
- Mount or remove Leaderboard  
- Harden invite **resend** email delivery when user already exists (Auth may only regenerate links)  
- Server-side date-range fetch if entry volume grows beyond full client-side lists
