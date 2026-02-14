# Entitlements / “7 day pass” still Locked — Diagnosis

## Step 1 — What the backend sees (source of truth)

**As the affected user**, call:

```http
GET /api/me/entitlements
Authorization: Bearer <user-jwt>
```

**Expected if pass worked**

- `subscription.status` is `"active"` or `"trialing"`
- `subscription.expiresAt` is in the future (ISO string)

**If you see** `null`, `none`, `past_due`, `canceled`, or an expired `expiresAt` → backend will deny access and lessons show Locked.

**Admin shortcut (no need to log in as the user)**  
Call the entitlements-debug endpoint as an admin:

```http
GET /api/admin/users/:userId/entitlements-debug
Authorization: Bearer <admin-jwt>
```

Example for user `695cfee71d527e85cfb2da68`:

```http
GET /api/admin/users/695cfee71d527e85cfb2da68/entitlements-debug
```

Response includes:

- `subscriptionV2FromDb` — raw Mongo `subscriptionV2`
- `normalizedSubscriptionV2` — what the contract uses
- `wouldBeEntitled` — `true` iff backend would grant access
- `hint` — next step if still locked

---

## Step 2 — Mongo (optional)

Find user `_id = 695cfee71d527e85cfb2da68` and inspect:

- `subscriptionV2` — must have `status: "active"` or `"trialing"` and `expiresAt` in the future
- `subscription` (legacy)
- `subscriptionV2Snapshot`
- `purchasedLessons`

**Typical mismatch**

- Admin “7 day pass” wrote to a field the backend doesn’t read (e.g. `passExpiresAt`, `trialEndsAt`, `subscriptionPass`).
- Or `subscriptionV2.status` set but `expiresAt` missing/invalid/past.
- Or a status not in the allowlist (`active`, `trialing`), e.g. `promo` / `free` / `granted`.

---

## Step 3 — Fix: make “7 day pass” real

The admin action that issues the pass is:

- **Route:** `POST /api/admin/subscription/grant`
- **File:** `backend/routes/admin.js`

It already writes the correct shape:

```js
user.subscriptionV2 = {
  status: "trialing",
  provider: "admin",
  planId: "admin-pass-7d",
  plan: "trial",
  expiresAt: new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: true,
};
await user.save();
```

**If the user was granted the pass before this fix**, their record may still have the old shape. **Re-grant the pass** for that user (Admin UI “Grant 7 days” or POST with `userId` and `days: 7`), then re-check Step 1.

---

## Step 4 — Verify end-to-end

As the user (or after re-granting):

1. **GET /api/me/entitlements** — `subscription.status` = `trialing`, `subscription.expiresAt` in the future.
2. **GET /api/lessons** — list items show `hasAccess: true` where applicable (still list-safe).
3. **GET /api/lessons/:id** — returns full content for an entitled lesson.

**Sanity check:** For a lesson that still shows Locked, confirm `lesson.status === "published"`. If it’s `draft` or `in_review`, the backend correctly returns NOT_PUBLISHED even with entitlement.
