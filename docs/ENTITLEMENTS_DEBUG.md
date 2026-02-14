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

Examples:

```http
GET /api/admin/users/695cfee71d527e85cfb2da68/entitlements-debug
GET /api/admin/users/6957f226859caa63f4faab26/entitlements-debug
```

Response includes:

- `subscriptionV2FromDb` — raw Mongo `subscriptionV2`
- `normalizedSubscriptionV2` — what the contract uses
- `wouldBeEntitled` — `true` iff backend would grant access
- `hint` — next step if still locked

---

## Step 2 — What to check in Mongo

Find the user by `_id`. Example IDs: `695cfee71d527e85cfb2da68`, `6957f226859caa63f4faab26`.

Inspect:

- **subscriptionV2** — primary; must exist and have `status` + `expiresAt`.
- **subscription** / **subscriptionSnapshot** — legacy; do not rely on these for entitlement.
- **subscriptionV2Snapshot** — only used by the backend when `subscriptionV2` is missing.

**Expected correct shape (backend will grant access):**

```js
subscriptionV2: {
  status: "trialing",   // or "active"
  expiresAt: Date,      // future
  provider: "admin",
  planId: "admin-pass-7d",
  plan: "trial",
  cancelAtPeriodEnd: true
}
```

**If instead you see something like:**

```js
subscription: { active: true, expiresAt: ... }   // legacy only
```

…then the backend will still deny. The backend reads `subscriptionV2` (or fallback `subscription` / `subscriptionV2Snapshot`) and normalizes via the contract; it expects `status: "active"` or `"trialing"`, not a boolean `active: true`.

**Other typical mismatches**

- Admin “7 day pass” wrote to a field the backend doesn’t read (e.g. `passExpiresAt`, `trialEndsAt`, `subscriptionPass`).
- `subscriptionV2.status` set but `expiresAt` missing / invalid / past.
- A status not in the allowlist (`active`, `trialing`), e.g. `promo`, `free`, `granted`.

---

## If entitlements are correct but UI still shows locked

1. **Refresh the page / hard refresh** — the frontend may be caching lesson list responses.
2. **Confirm lessons are published** — for each lesson that shows Locked, check `lesson.status === "published"`. If it’s `draft` or `in_review`, the backend correctly returns NOT_PUBLISHED even when the user is entitled.

**Quick check:** After granting, did the student’s lesson tiles unlock at all, or are they still “Locked”? If still locked, the most likely fix is to ensure the admin “grant pass” endpoint writes **subscriptionV2** with **status** `"active"` or `"trialing"` (not just a legacy `active: true`). The current implementation in `backend/routes/admin.js` already does this.

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
