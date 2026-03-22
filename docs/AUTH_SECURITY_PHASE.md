# Auth/Security Phase — Implementation Summary

## Tasks Completed

### Task 1: Forgot password / Reset password ✓ (already done)
- **User model:** `passwordResetToken`, `passwordResetExpires`
- **POST /api/auth/forgot-password** — generic success, secure token, 1h expiry
- **POST /api/auth/reset-password** — validate token, bcrypt hash, single-use
- **Frontend:** `/forgot-password`, `/reset-password?token=...`
- **Rate limiting:** 5/15min (forgot), 10/15min (reset)

### Task 2: Change password while logged in ✓
- **PUT /api/auth/me/password** — `currentPassword` + `newPassword`, bcrypt hash
- **Frontend:** Settings page — Change password form
- **Rate limiting:** 10/15min

### Task 3: Safe email change ✓
- **PUT /api/auth/me/email** — `currentPassword` + `newEmail`, preserves userType
- **Frontend:** Settings page — Change email form
- **Recommendation:** New email verification optional for now; add later for non-admin users if desired.

### Task 4: content_manager role ✓
- **User model:** `staffRole: "content_manager"`
- **Middleware:** `requireContentManager` — allows admin OR content_manager
- **Backend routes:** Lessons, taxonomy, content-graph, spec-statements, admin question-banks, autopilot use `requireContentManager`. Users, transactions, metrics, subscription, shamcoins, jobs stay `checkAdmin`.
- **PUT /api/admin/users/:userId/staff-role** — admin-only, assign/clear content_manager
- **Frontend:** AdminDashboardPage filters nav (hide Users, Transactions, Paywall metrics for content_manager). Header shows Admin link for content_manager. RoleBasedRedirect sends content_manager to /admin.

### Task 5: Basic admin audit log ✓
- **Model:** `AdminAuditLog` — action, actorId, actorEmail, targetType, targetId, details, ip
- **Utility:** `auditAdminAction(opts)`
- **Logged actions:** `role_change`, `staff_role_change`, `teacher_verify`, `lesson_status`, `lesson_delete`, `user_delete`, `subscription_grant`, `subscription_expire`
- **GET /api/admin/audit-log** — admin-only, list recent entries (?limit=50, ?action=...)

---

## Files Changed

### Backend
| File | Changes |
|------|---------|
| `models/User.js` | `staffRole`, `passwordResetToken`, `passwordResetExpires` |
| `models/AdminAuditLog.js` | **New** |
| `routes/auth.js` | `PUT /me/password`, `PUT /me/email`, forgot/reset (existing) |
| `routes/admin.js` | `requireContentManager`, `PUT /users/:userId/staff-role`, `GET /audit-log`, audit calls |
| `middleware/requireContentManager.js` | **New** |
| `utils/auditAdminAction.js` | **New** |
| `routes/adminTaxonomy.js` | requireAdmin → requireContentManager |
| `routes/adminQuestionBanks.js` | checkAdmin → requireContentManager |
| `routes/contentGraph.js` | requireAdmin → requireContentManager |
| `routes/specStatements.routes.js` | requireAdmin → requireContentManager |

### Frontend
| File | Changes |
|------|---------|
| `pages/SettingsPage.tsx` | Change password, Change email forms |
| `pages/AdminDashboardPage.tsx` | isContentManager, filtered nav/tabs |
| `App.tsx` | `requireAdminOrContentManager`, RoleBasedRedirect for content_manager |
| `components/layout/Header.tsx` | Admin link for content_manager |

---

## Routes Added

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/auth/me/password` | Change password (auth, currentPassword required) |
| PUT | `/api/auth/me/email` | Change email (auth, currentPassword required) |
| PUT | `/api/admin/users/:userId/staff-role` | Assign content_manager (admin only) |
| GET | `/api/admin/audit-log` | List audit entries (admin only) |

---

## Model Changes

| Model | New Fields |
|-------|------------|
| User | `staffRole`, `passwordResetToken`, `passwordResetExpires` |
| AdminAuditLog | **New** — action, actorId, actorEmail, targetType, targetId, details, ip, timestamps |

---

## Env Vars

No new env vars for Tasks 2–5. Task 1 (forgot/reset) uses:
- `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

---

## Migration

- **User:** New fields are optional; no migration script needed.
- **AdminAuditLog:** New collection; created on first write.

---

## Rollout Order

1. **Task 1** — Forgot/reset password (already deployed)
2. **Task 2 & 3** — Change password, Change email (Settings page)
3. **Task 5** — Audit log (backend only; optional UI later)
4. **Task 4** — content_manager role:
   - Deploy backend
   - Run: `PUT /api/admin/users/:userId/staff-role` with `{ staffRole: "content_manager" }` for a teacher
   - Frontend will show filtered admin nav automatically

---

## Assign content_manager

```bash
# As admin, assign content_manager to a user (e.g. teacher ID)
curl -X PUT "https://api.example.com/api/admin/users/USER_ID/staff-role" \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"staffRole":"content_manager"}'

# To remove:
curl -X PUT "..." -d '{"staffRole":null}'
```
