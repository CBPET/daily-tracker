# Test use cases — CBPET Daily Tracker

Manual end-to-end cases. Record Pass/Fail and notes per case.

**Conventions**

- Preconditions assume a working Supabase project, migrations applied (`MISC_HOURS`, `EMAIL_CONFIRMED_SYNC` where relevant), and `npm run dev` or deployed app.
- Replace sample emails with real mailboxes you control.

---

## A. Authentication

### A1 — Login as performer

| | |
|--|--|
| **Precondition** | Verified performer account exists |
| **Steps** | Open app → Login with email/password |
| **Expected** | Lands on Entry Form (`#form`); performer field read-only as self |

### A2 — Forgot / reset password

| | |
|--|--|
| **Precondition** | Auth SMTP configured |
| **Steps** | Forgot password → open email link → set new password |
| **Expected** | Reset Password screen (password only); then can login |

### A3 — Invite accept (Admin Invite)

| | |
|--|--|
| **Precondition** | `invite-user` deployed; `APP_URL` set; GM/super_admin logged in |
| **Steps** | Admin Invite → email + role → Send → open invite email → set Display Name + password |
| **Expected** | InviteAccept UI; name prefilled from email; after save, enters app; User Management shows **Verified** |

---

## B. Task entry and hours

### B1 — Normal task hours &gt; 4

| | |
|--|--|
| **Precondition** | Logged in |
| **Steps** | Task = Preedit; Estimated = 8; Taken = 7.5; submit |
| **Expected** | Saves successfully; not blocked by 1–4 rule |

### B2 — Miscellaneous within 1–4

| | |
|--|--|
| **Steps** | Task = Miscellaneous; hours = 2.0 / 2.0; submit |
| **Expected** | Saves; status `N/A`; target 0 / N/A in summary |

### B3 — Miscellaneous out of range

| | |
|--|--|
| **Steps** | Miscellaneous; Taken = 0.5 or 5.0; submit |
| **Expected** | Toast error; no save (UI). DB also rejects if constraint applied |

### B4 — Missing required fields

| | |
|--|--|
| **Steps** | Submit with empty title or task |
| **Expected** | Validation / error modal; no insert |

---

## C. Daily Summary

### C1 — Day filter

| | |
|--|--|
| **Steps** | Log entry for today; Daily Summary → Day → today |
| **Expected** | Entry appears under its task type; metrics update |

### C2 — This Week (Monday start)

| | |
|--|--|
| **Steps** | Entries mid-week; select This Week |
| **Expected** | Only Mon–Sun current week local dates; date shown on cards when not Day mode |

### C3 — This Month

| | |
|--|--|
| **Steps** | Select This Month |
| **Expected** | Entries with `YYYY-MM` prefix of current month |

### C4 — Suggestion when delay &gt; 20%

| | |
|--|--|
| **Steps** | Log non-Misc with taken ≫ estimated (e.g. est 2, taken 3) multiple times same task/client |
| **Expected** | Suggestions panel shows target correction when avg delay &gt; 20% |

### C5 — Lead Team vs Individual

| | |
|--|--|
| **Precondition** | team_lead or group_lead with members’ data |
| **Steps** | Toggle Team / Individual; pick performer |
| **Expected** | Team shows all scoped; Individual filters to one name |

---

## D. Analytics and Performance Rating

### D1 — Overview charts

| | |
|--|--|
| **Steps** | Analytics → Overview with some entries |
| **Expected** | Cards and charts render; no blank crash |

### D2 — Performance Rating tab

| | |
|--|--|
| **Steps** | Analytics → Performance Rating → Individual / Team / Process; change Monthly/Quarterly/Yearly |
| **Expected** | Ranked table + bar + band doughnut; Misc contributes via hours÷8 |

### D3 — Rating export

| | |
|--|--|
| **Steps** | With rating rows → CSV and Excel |
| **Expected** | Files download; Excel has Ratings (+ Entries sheet) |

### D4 — Deep link

| | |
|--|--|
| **Steps** | Open `#analytics?tab=ratings&client=CODE&division=PreEdit&start=YYYY-MM-DD&end=YYYY-MM-DD` while logged in |
| **Expected** | Analytics opens on Performance Rating with filters applied (within RLS) |

---

## E. Administration and invites

### E1 — Three buttons present

| | |
|--|--|
| **Precondition** | super_admin or general_manager |
| **Steps** | Administration → Users |
| **Expected** | **Admin Invite**, **Add New User**, **Provision User** all visible |

### E2 — Provision User clipboard

| | |
|--|--|
| **Steps** | Provision User → Copy signup link |
| **Expected** | Clipboard has `{origin}#signup`; signup still works |

### E3 — Add New User

| | |
|--|--|
| **Steps** | Add New User with email + name + role |
| **Expected** | Profile appears; confirmation email behavior per Auth settings |

### E4 — Email verified filters

| | |
|--|--|
| **Precondition** | `EMAIL_CONFIRMED_SYNC.sql` applied |
| **Steps** | User Management → Verified / Pending filters |
| **Expected** | Badges match; pending users show **Resend** for GM/super_admin |

### E5 — Resend pending

| | |
|--|--|
| **Steps** | Click Resend on pending invite vs pending confirm user |
| **Expected** | Invite path: “Invite resent…”; signup path: “Confirmation email resent…”; clear error if Auth cannot resend; no crash |

### E6 — Manager cannot Admin Invite

| | |
|--|--|
| **Precondition** | Login as `manager` |
| **Steps** | Open Administration users |
| **Expected** | No Admin Invite button (or invite API returns 403) |

---

## F. RBAC / data scope

### F1 — Performer isolation

| | |
|--|--|
| **Steps** | Performer A logs entries; login as Performer B |
| **Expected** | B does not see A’s entries in form summary (RLS + fetch) |

### F2 — Entry delete

| | |
|--|--|
| **Steps** | Manager/admin deletes an entry from Daily Summary |
| **Expected** | Confirm → removed from UI and DB. Performer cannot delete |

---

## G. Build / regression

### G1 — Unit tests and build

```bash
npm test
npm run build
```

| **Expected** | Tests pass; Vite build completes |

---

## Results log (template)

| Case | Pass/Fail | Tester | Date | Notes |
|------|-----------|--------|------|-------|
| A1 | | | | |
| A2 | | | | |
| A3 | | | | |
| B1 | | | | |
| B2 | | | | |
| B3 | | | | |
| C1 | | | | |
| D2 | | | | |
| E1 | | | | |
| E4 | | | | |
| G1 | | | | |
