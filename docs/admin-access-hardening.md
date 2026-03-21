# Admin Access Hardening — LetsRevise

## 1. Admin Credential Hardening

### 1.1 How Admin Logs In

- **Method:** Standard email + password via `POST /api/auth/login`
- **Flow:** Same as student/teacher/parent; backend identifies `userType` from DB and redirects admin to `/admin-dashboard`
- **No separate admin login route** — admin uses the public login page

### 1.2 Where Admin Email/Password Can Be Changed

| Location | Email | Password |
|----------|-------|----------|
| **Edit Profile UI** (`/edit-profile`) | ❌ No | ❌ No |
| **Profile page** (`/profile`) | ❌ Read-only | — |
| **Admin Dashboard** | ❌ No UI | ❌ No UI |
| **PUT /api/users/profile** | ❌ Not accepted | ❌ Not accepted |
| **PUT /api/user/me** (userProfile) | ❌ Not accepted | ❌ Not accepted |
| **PUT /api/user/:id** (admin update any user) | ✅ Yes | ❌ No (not in allowedFields, and would need bcrypt) |

**Conclusion:** The current UI does **not** support changing admin email or password. The only relevant backend route (`PUT /api/user/:id`) allows an admin to change another user's email, but:

- No password change anywhere
- No UI for admin credential management
- Changing another admin's email would require being logged in as admin (chicken-and-egg if locked out)

### 1.3 Safest Way to Change Admin Credentials (DB/Backend)

**Option A: One-off script (recommended for emergency)**

Create `backend/scripts/update-admin-credentials.js`:

```javascript
#!/usr/bin/env node
/**
 * Safely update admin email and/or password.
 * Run: node backend/scripts/update-admin-credentials.js --email NEW_EMAIL --password NEW_PASSWORD
 * Or: node backend/scripts/update-admin-credentials.js --target-email admin@example.com --email NEW --password NEW
 *
 * - Uses bcrypt for password (same as auth)
 * - Keeps userType=admin, verificationStatus=verified
 * - Requires MONGO_URI
 */
```

**Exact DB operations:**
- Find admin by `userType: "admin"` and optionally `email: "<current>"`
- Update: `{ email: newEmail }` if provided
- Update: `{ password: await bcrypt.hash(newPassword, 12) }` if provided
- Preserve: `userType: "admin"`, `verificationStatus: "verified"`
- Use `User.updateOne` or `findOneAndUpdate` with `$set`

**Option B: Add authenticated change-password endpoint**

- `PUT /api/auth/me/password` — requires `currentPassword` + `newPassword`
- Any authenticated user (including admin) can change own password
- Backend: verify `bcrypt.compare(currentPassword, user.password)`, then `user.password = await bcrypt.hash(newPassword, 12)`

**Option C: Add change-email to Edit Profile**

- Allow `email` in `PUT /api/users/profile` for own account
- For admin: skip re-verification (trusted)
- For others: optional email verification flow

---

## 2. Limited-Access Staff Design

### Proposed Roles

| Role | Purpose |
|------|---------|
| `content_manager` | Curriculum, lessons, taxonomy, approvals |
| `support` | User issues, lesson reports, limited user view |
| `moderator` | Content moderation, review queue |
| `finance_viewer` | Read-only revenue, transactions, metrics |

### 2.1 content_manager

**Can access:**
- `/admin/content-coverage` — view/edit coverage
- `/admin/taxonomy` — taxonomy CRUD
- `/admin/content-issues` — content issues
- `/admin/autopilot-approval` — approve/reject drafts
- `/admin/autopilot-runs`, `/admin/autopilot-outcomes`, `/admin/autopilot-feedback`
- `/admin/draft-library`, `/admin/spec-statements`
- `/admin/question-banks` — exam questions, flashcards, quizzes
- `/admin/lesson/:id` — view/edit any lesson
- Teacher CSV import, bulk import for content

**Can do:**
- Publish/unpublish lessons
- Approve AI drafts
- Edit taxonomy
- Manage question banks
- Set lesson status

**Cannot do:**
- Delete users
- Change user roles (verify/reject teachers, assign admin)
- Grant/revoke subscriptions, shamcoins
- Delete lessons (optional: allow or restrict)
- Access metrics, transactions
- Ops/job control

**Backend routes:** `requireContentManager` — allow for `/admin/lessons`, `/admin/taxonomy`, content-graph, topicFlashcards, topicQuizQuestions, topicPastPapers, specStatements, bulk-import (content types), autopilot routes.

---

### 2.2 support

**Can access:**
- `/admin/content-issues` — view lesson reports
- `/api/admin/users` — list users (read-only)
- `/api/admin/users/:userId` — user detail
- Lesson reports, worksheet reports

**Can do:**
- View users, troubleshoot entitlements
- View content issues, lesson reports
- Possibly close/reassign issues (scope TBD)

**Cannot do:**
- Change roles, verify teachers
- Edit or delete lessons
- Access taxonomy, taxonomy edits
- Access revenue, transactions
- Delete users
- Bulk operations

**Backend routes:** Read-only users, lesson issues, reports.

---

### 2.3 moderator

**Can access:**
- `/admin/content-issues` — full access
- `/admin/autopilot-approval` — approve/reject
- Possibly lesson review queue

**Can do:**
- Resolve content issues
- Approve/reject AI drafts
- Flag/report content

**Cannot do:**
- Edit taxonomy
- Change user roles
- Access finances
- Delete users or lessons

**Backend routes:** Content issues, autopilot approval (approve/reject only).

---

### 2.4 finance_viewer

**Can access:**
- `/admin/metrics` — conversion, top paywalled
- `/admin` — stats (read-only subset)
- `/api/admin/transactions` — read-only

**Can do:**
- View revenue, transactions, metrics
- Export reports (if implemented)

**Cannot do:**
- Grant/revoke subscriptions
- Change shamcoins
- Any write operations

**Backend routes:** GET-only for metrics, transactions, stats.

---

## 3. Smallest Safe Implementation

### 3.1 Recommended First Role: content_manager

**Why:** LetsRevise is content-heavy. A content manager can handle:
- Curriculum taxonomy
- Lesson approvals
- Question bank management
- Autopilot approvals

without needing full admin (user management, finance, ops).

### 3.2 Backend Changes

1. **User model**
   - Add `staffRole?: "content_manager" | "support" | "moderator" | "finance_viewer"` (optional; `admin` remains `userType`)
   - Or: extend `userType` with `"content_manager"` etc. and treat them as staff in middleware

2. **Middleware**
   - `requireContentManager`: `userType === "admin" || staffRole === "content_manager"` (or equivalent)
   - Use after `auth` on content routes

3. **Route-level**
   - Replace `checkAdmin` with `checkAdminOrContentManager` on:
     - `GET/PUT /admin/lessons`, `PUT /admin/lessons/:id/status`, `DELETE /admin/lessons/:id` (optional)
     - Taxonomy routes
     - Content-graph, autopilot, draft-library, spec-statements
     - Question banks (exam, flashcards, quizzes)
     - Bulk import (content)
   - Keep `checkAdmin` only for: users CRUD, verify/role, shamcoins, subscription, transactions, metrics, jobs

4. **Create content_manager**
   - Either: seed script, or admin UI to set `staffRole: "content_manager"` on a user (admin-only action)
   - Ensure `verificationStatus: "verified"`

### 3.3 Frontend Changes

1. **Route guard**
   - `App.tsx`: Allow `/admin/*` for `userType === "admin"` **or** `staffRole === "content_manager"`
   - Render `AdminDashboardPage` (or a filtered view) for content_manager

2. **Admin dashboard**
   - Hide nav items content_manager cannot access:
     - Users, Transactions, Metrics, Subscription actions
   - Show: Content coverage, Taxonomy, Content issues, Autopilot, Question banks, Draft library, Spec statements

3. **API**
   - `useCurrentUser` (or equivalent) exposes `staffRole`
   - UI branches on `userType` and `staffRole`

### 3.4 Enforcing Protected Routes

```
Request → auth middleware (JWT) → requireAdmin or requireContentManager
                                    ↓
                    userType === "admin" → full access
                    staffRole === "content_manager" → content-only routes
```

- Reuse existing `auth` middleware
- Add `requireContentManager` that allows admin **or** content_manager
- Apply it only to the content-related admin routes

---

## 4. Output Summary

### Safest Way to Change Admin Email/Password

| Method | Use case |
|--------|----------|
| **DB script** | Emergency, or when locked out |
| **PUT /api/auth/me/password** (new) | Normal password change (recommended to add) |
| **PUT /api/user/:id** (existing) | Admin changing another user's email only — no password |

**Exact script behavior:**
- Input: `--email`, `--password` (optional), `--target-email` (which admin to update)
- Find: `User.findOne({ userType: "admin", email: targetEmail })`
- Update: `{ email, password: bcrypt.hash(password, 12), verificationStatus: "verified", userType: "admin" }`
- Use `$set` and ensure password is hashed in application code, not stored raw

### Current UI Support

- **No:** Current UI does not support changing admin email or password
- Edit Profile: firstName, lastName, schoolName only
- Admin Dashboard: no credential management UI

### Recommended Limited-Access Structure

- `content_manager` — first implementation
- `support`, `moderator`, `finance_viewer` — later, as needed

### Smallest Practical First Step

1. Add `backend/scripts/update-admin-credentials.js` for safe credential updates
2. Add `PUT /api/auth/me/password` for self-service password change
3. Add `staffRole` (or equivalent) and `requireContentManager` middleware
4. Implement `content_manager` role: backend route guards + frontend nav filtering
