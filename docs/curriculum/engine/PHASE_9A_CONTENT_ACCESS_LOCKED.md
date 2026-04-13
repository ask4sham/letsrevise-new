# Phase 9A — Content access locked

Backend-first lesson content access is **locked** at this tag. No change to policy, gated routes, or list sanitizer without going through this doc and tests.

**Tag:** `phase-9a-content-access-locked`

---

## Policy rules (single source of truth)

- **Source:** `backend/utils/canAccessContent.js`
- **Deny by default.** Reasons: `UNAUTHENTICATED`, `NOT_PUBLISHED`, `NOT_ENTITLED` (and allow reasons below).
- **Allow:** Admin override; then **published-only**; then one of:
  1. **Active subscription** (`isSubscriptionActive` — allowlist statuses only, e.g. `active`, `trialing`; expiry enforced).
  2. **Purchased lesson** (lesson id in `user.purchasedLessons`; IDs normalized with `String()` to avoid ObjectId/string mismatches).
  3. **Free preview** (lesson `isFreePreview === true` → partial content only).
- **Owner semantics:** Enforced in middleware: `lesson.teacherId ?? lesson.teacher?._id`; owner (and admin) bypass content check; owner may see draft.

---

## requireLessonAccess — lessonId resolution

- **Source:** `backend/middleware/requireLessonAccess.js`
- **Order:** `req.params.id` → `req.params.lessonId` → `req.query.lessonId` → (optional) `req.body.lessonId` **only** when `requireLessonAccess({ allowBody: true })`.
- **Default:** Body is **not** used. This prevents new endpoints from accidentally being gated via body.
- **Opt-in:** `POST /api/uploads/lesson-block` uses `requireLessonAccess({ allowBody: true })` because lessonId is in body.

---

## Gated routes

| Route | Gate | Notes |
|-------|------|--------|
| `GET /api/lessons/:id` | auth + requireLessonAccess() | Partial for FREE_PREVIEW via toLessonPreviewPayload; full via toLessonFullPayload. |
| `GET /api/lessons` | auth + canAccessContent per item | List only; see list sanitizer below. |
| `GET /api/curriculum-confidence/:lessonId` | auth + requireLessonAccess() | |
| `POST /api/uploads/lesson-block` | auth + requireLessonAccess({ allowBody: true }) | lessonId from body. |
| `GET /api/reviews/lesson/:lessonId` | auth + requireLessonAccess() | |
| `POST /api/reviews/:lessonId` | auth + requireLessonAccess() | |
| Progress (update/review) | auth + canAccessContent in handler | |

---

## List sanitizer (GET /api/lessons)

- **No premium fields in list.** All items go through `toListSafe(lesson, extra)`.
- **LIST_SAFE_KEYS** (no `pages`, `content`, `quiz`, `flashcards`):  
  `id`, `_id`, `title`, `summary`, `subject`, `level`, `board`, `topic`, `tier`, `status`, `isPublished`, `teacherId`, `teacherName`, `createdAt`, `updatedAt`, `views`, `averageRating`, `isFreePreview`, `preview`.
- **Extra fields allowed:** `locked`, `hasAccess`, `reason`, `isFreePreview`, `pageCount` (only for entitled users).
- **Tripwire test:** Integration test asserts list items do **not** contain `pages`, `content`, `quiz`, `flashcards`; may contain `pageCount`.

---

## Payload helpers (GET /api/lessons/:id)

- **Source:** `backend/utils/lessonPayload.js`
- **toLessonPreviewPayload(lesson)** — Explicit allowlist; first page only; no quiz; flashcards `[]`. Used for FREE_PREVIEW.
- **toLessonFullPayload(lesson)** — Full lesson. Used for SUB_ACTIVE / PURCHASED / ADMIN / OWNER.
- Ensures new lesson fields cannot leak into preview by default.

---

## Test commands

```bash
# Unit (canAccessContent)
npx jest backend/tests/canAccessContent.test.js --config=jest.backend.config.js

# Integration (content access + list no-premium-fields tripwire)
npx jest backend/tests/lessonsContentAccess.integration.test.js --config=jest.backend.config.js

# All backend tests
npm run test:backend
```

---

## CI

- **Workflow:** `.github/workflows/validate-curriculum.yml`
- **Job step name:** `Backend content-access tests (Phase 9)`
- **Command:** `npm run test:backend`
- **Env:** `JWT_SECRET_KEY` (or CI fallback `test-secret-for-ci-phase9`).

---

## Done criteria (Phase 9 pre-step)

- [x] API denies by default
- [x] Single policy source of truth (`canAccessContent`)
- [x] All lesson-scoped routes gated
- [x] List endpoint cannot leak premium content (LIST_SAFE_KEYS + toListSafe + tripwire test)
- [x] Owner semantics explicit (teacherId, String compare)
- [x] Subscription entitlement allowlist (isSubscriptionActive)
- [x] Integration test + CI
- [x] requireLessonAccess body opt-in only
- [x] Purchased IDs normalized (Set of strings)
- [x] Explicit preview/full payload helpers

Next: Phase 9B (subscription entitlements) layers on top of this access gate.
