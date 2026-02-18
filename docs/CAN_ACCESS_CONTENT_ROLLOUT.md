# canAccessContent() Middleware — Rollout Order

Single choke-point for lesson content access. Roll out in this order (lowest → highest risk).

## Status code convention

- **401** — Unauthenticated
- **402** — Authenticated but not entitled (subscription/purchase required). Use for `NOT_ENTITLED`.
- **403** — Authenticated but forbidden (draft, not owner, etc.)

All deny responses use a **stable body**: `{ error, reason, lessonId?, published? }` for debugging and frontend consistency.

---

## Rollout order

### ✅ Done

| Route | Method | Middleware | Notes |
|-------|--------|------------|--------|
| `/api/lessons/:id` | GET | `canAccessContent()` | Main lesson content. Returns full or preview by `req.accessDecision.reason`. |
| Progress / review | PUT | Inline `canAccessContent` | Returns 402 for NOT_ENTITLED, stable body. |
| `/api/curriculum-confidence/:lessonId` | GET | `canAccessContent()` | Params: `lessonId`. |
| `/api/reviews/lesson/:lessonId` | GET | `canAccessContent()` | Params: `lessonId`. |
| `/api/reviews/:lessonId` (submit review) | POST | `canAccessContent()` | Params: `lessonId`. |
| `/api/media/lesson-block` | POST | `canAccessContent({ allowBody: true })` | Only route that needs body; lessonId from `req.body.lessonId`. |

### Next (recommended order)

_No further routes currently in queue. When adding new lesson-content endpoints, gate them with `canAccessContent()` (or `canAccessContent({ allowBody: true })` only where lessonId must come from body)._

### Do not gate with canAccessContent

- **Admin** routes (`/api/admin/lessons/*`) — already admin-only.
- **Teacher-only** routes (create, edit, publish, revision-draft, etc.) — use owner/admin checks, not subscription.
- **Purchase / unlock** — they are the entitlement path; no content gate.

### allowBody

- **Default `allowBody: false`.** Only enable on endpoints where `lessonId` cannot come from params/query (e.g. multipart upload with `lessonId` in body).
- When `allowBody: true`, prefer validating that the body shape is `{ lessonId }` (or similar) so arbitrary body IDs don’t become a bypass.

---

## After migration

- **Deprecation:** `requireLessonAccess` is already marked deprecated; prefer `canAccessContent()` for new routes. All listed content routes now use `canAccessContent()`.
- **No duplication:** Remove or refactor any remaining inline entitlement checks that duplicate `utils/canAccessContent` so the middleware remains the single choke-point.

---

## Audit logging

In **non-production**, the middleware logs one line per access check:

`[canAccessContent] { userId, lessonId, reason }`

Reason is one of: `ADMIN`, `OWNER_DRAFT`, `SUB_ACTIVE`, `PURCHASED`, `FREE_PREVIEW`, `NOT_ENTITLED`, `NOT_PUBLISHED`, etc. Use for entitlement debugging.
