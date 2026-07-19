# Developer remarks — CBPET Daily Tracker

Practical notes for maintainers. Prefer this file over outdated marketing README sections.

---

## 1. Do not break live databases

- The only supported SQL path in-repo is [`sql_commands/`](sql_commands/README.md): `01`–`12` + `VERIFY_ALL.sql`.
- **Never** re-run the full greenfield sequence (`01`–`12`) on an existing production project.
- For a **brand-new** Supabase project, run `01`–`12` in order, then `VERIFY_ALL.sql`.
- Constraints added with `NOT VALID` still enforce new inserts; they do not rewrite old rows.

### Recommended SQL order for existing DB (additive only)

Apply only scripts whose objects are still missing, in order:

1. Core / hierarchy / targets already present from earlier deploys (covered by `01`–`03` on greenfield)
2. Request Hub / notifications / analytics if missing: `04` → `05` → `06`
3. Onboarding path split: [`07_ONBOARDING.sql`](sql_commands/07_ONBOARDING.sql) (invite vs signup Resend)
4. Profile lifecycle status: [`08_PROFILES_STATUS.sql`](sql_commands/08_PROFILES_STATUS.sql)
5. Request Hub creator visibility: [`09_REQUEST_HUB_RLS_FIX.sql`](sql_commands/09_REQUEST_HUB_RLS_FIX.sql)
6. Project database: [`10_PROJECT_DATABASE.sql`](sql_commands/10_PROJECT_DATABASE.sql) (after client hierarchy)
7. Schedule date ACL + `reason_code`: [`11_PROJECT_SCHEDULE_DATE_ACL.sql`](sql_commands/11_PROJECT_SCHEDULE_DATE_ACL.sql)
8. Project status values: [`12_PROJECT_RECORD_STATUS.sql`](sql_commands/12_PROJECT_RECORD_STATUS.sql)
9. [`VERIFY_ALL.sql`](sql_commands/VERIFY_ALL.sql)

---

## 2. Hours rule (important)

- **Only `Miscellaneous`** is limited to 1–4 hours (estimated + taken).
- Other tasks: any positive hours; placeholders suggest a full day (e.g. 8.0).
- Productive tasks auto-estimate hours as `completed work × 8 ÷ target`; taken hours remains manual.

Greenfield `01_FRESH_CORE.sql` already encodes the Miscellaneous 1–4 rule. If an older live DB still has a global 1–4 hours constraint on all tasks, Preedit inserts of 6–8h will fail until that constraint is corrected in Supabase.

---

## 3. Edge Functions

| Function | Path | Secrets / notes |
|----------|------|-----------------|
| `invite-user` | `supabase/functions/invite-user` | **Deploy with `--no-verify-jwt`** (gateway JWT breaks CORS OPTIONS from GitHub Pages). Auth still checked inside the function. Secrets: `APP_URL` (Pages origin + trailing `/`, no `#`), platform `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`; caller must be GM/super_admin JWT |
| `weekly-performance-report` | `supabase/functions/weekly-performance-report` | `APP_URL`, Gmail SMTP secrets if switched from Resend; partition by client+sub_division |
| `dispatch-notification` | `supabase/functions/dispatch-notification` | **Deploy with `--no-verify-jwt`** (same CORS OPTIONS issue as invite-user). Auth still checked inside the function. JWT caller; service role inserts notifications |
| `request-hub-reminders` | `supabase/functions/request-hub-reminders` | Cron + service role; see `docs/REQUEST_HUB_REMINDERS.md` |
| `calculate-behaviour-snapshots` | `supabase/functions/calculate-behaviour-snapshots` | Cron + service role; see `docs/BEHAVIOUR_SNAPSHOTS.md` |

Deploy example:

```bash
# Required for browser Admin Invite from GitHub Pages (CORS preflight)
supabase functions deploy invite-user --no-verify-jwt

supabase functions deploy weekly-performance-report
# Required for browser notifications from GitHub Pages (CORS preflight)
supabase functions deploy dispatch-notification --no-verify-jwt
supabase functions deploy request-hub-reminders
supabase functions deploy calculate-behaviour-snapshots
```

Or Dashboard → Edge Functions → `invite-user` / `dispatch-notification` → disable **Verify JWT**.

`APP_URL` example: `https://cbpet.github.io/daily-tracker/`

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
- Role enum historically used `assistant_manager` in SQL while UI uses `manager` — greenfield `01_FRESH_CORE.sql` uses `manager` only; confirm live DBs match before enabling enterprise RLS.
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
- Build Project Database UI on top of `project_records` / `project_schedule_tasks` and `projectFieldConfig.js`
