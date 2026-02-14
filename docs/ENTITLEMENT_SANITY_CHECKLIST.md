# Final Entitlement Sanity Checklist (~10 min)

**Authoritative** pre-launch and post-incident entitlement check. This document is the single source of truth for validating entitlement correctness end-to-end.

**Usage:** Run before launch; run after any entitlement-related incident or change.

**Goal:** Verify end-to-end entitlement behavior. No code changes—manual verification only.

**Rule of thumb:** If `GET /api/me/entitlements` doesn’t show `subscription.status` = `active` or `trialing`, the backend will lock content.

---

## 1. Baseline (no access)

**Setup:** Pick a student with **no** `subscriptionV2` (or clear it in Mongo / use a fresh test student).

**Steps:**

1. Log in as that student.
2. Call **GET /api/me/entitlements** (e.g. from DevTools or Postman).

**Expected:**

- `subscription.status` = `none` (or `subscription` = `null`).
- **GET /api/lessons** → lessons show **Locked**.
- Lesson tiles: **Locked**, no “View lesson”.

**Pass:** ✅ Student has no access; list shows locked stubs.

---

## 2. Grant trial

**Steps:**

1. **Admin Dashboard → Users** → find the same student.
2. Enter their **User ID** in the Subscription Admin (Dev) box.
3. Click **Grant 7 days**.

**Verify (admin side):**

- In the Users table, that user’s **Access / Pass** column shows **“Trial (expires &lt;date&gt;)”** (green badge).

**Verify (student side):**

1. As the student, **hard refresh** the app (Ctrl+Shift+R / Cmd+Shift+R).
2. **GET /api/me/entitlements** → `subscription.status` = `trialing`, `subscription.expiresAt` in the future.
3. **GET /api/lessons** → lessons show **Unlocked** (or equivalent; list reflects access).
4. Open **GET /api/lessons/:id** for one lesson → returns **full content** (no 403).

**Pass:** ✅ Admin sees Trial in the table; student sees unlocked lessons and full content.

---

## 3. Expire access

**Steps:**

1. **Admin Dashboard → Users** → same student, same User ID in Subscription Admin.
2. Click **Expire now**.

**Verify (admin side):**

- Users table **Access / Pass** column for that user shows **“Expired (&lt;date&gt;)”** (red badge).

**Verify (student side):**

1. Student **refresh** (or hard refresh).
2. Lessons revert to **Locked**; no “View lesson” for paid content.
3. **GET /api/me/entitlements** → status is **not** entitled (e.g. `expired`, `none`, or `subscription` null).

**Pass:** ✅ Admin sees Expired; student loses access and entitlements reflect it.

---

## 4. Draft safety check

**Setup:** Pick a lesson with `status !== "published"` (e.g. `draft` or `in_review`).

**Steps:**

1. Log in as an **entitled** student (e.g. one with an active trial from step 2, or re-grant 7 days for this check).
2. Try to access that draft/in_review lesson (list or direct **GET /api/lessons/:id**).

**Expected:**

- Lesson either **does not appear** in the student’s list, or
- **GET /api/lessons/:id** returns **NOT_PUBLISHED** (or 403 with message indicating not published).
- Entitlement does **not** override publication state.

**Pass:** ✅ Unpublished lessons are not accessible even when the user is entitled.

---

## Result

| # | Check              | Pass |
|---|--------------------|------|
| 1 | Baseline (no access) | ☐   |
| 2 | Grant trial        | ☐   |
| 3 | Expire access      | ☐   |
| 4 | Draft safety       | ☐   |

**If all 4 pass** → Entitlements + UI are production-ready. No further fixes required.

**If any fail** → Use [ENTITLEMENTS_DEBUG.md](./ENTITLEMENTS_DEBUG.md) and `/api/admin/users/:userId/entitlements-debug` to diagnose.
