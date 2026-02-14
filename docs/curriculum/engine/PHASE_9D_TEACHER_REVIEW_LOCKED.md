# Phase 9D — Teacher review workflow locked

Draft → in_review → published state machine and review workflow are **locked** at this tag. Access rules, list filtering, and audit trail are stable.

**Tag:** `phase-9d-teacher-review-locked`

---

## State machine (canonical)

### Lesson visibility status (single field on Lesson)

- **draft** — only owner + admin can view full content.
- **in_review** — only owner + reviewer/admin can view full content.
- **published** — students can access via entitlements (subscription / purchase / free preview); list shows list-safe shape.
- **archived** / **flagged** — hidden from students; owner/admin only; used for moderation.

**Source of truth:** `lesson.status`. `lesson.isPublished` is kept in sync (true only when `status === "published"`). Pre-save hook in `Lesson` model aligns both; legacy lessons with `isPublished: true` and no status get `status: "published"`.

### Review decision state (LessonReview collection)

- **LessonReview** records: `lessonId`, `submittedBy`, `status` (PENDING | APPROVED | REJECTED), `reviewedBy`, `notes`, timestamps.
- One PENDING review per submission; approve/reject updates the latest PENDING and transitions the lesson.

---

## Access control

- **canAccessContent:** When `lesson.status` is present, only `status === "published"` allows non-owner/non-admin access. Otherwise deny with **NOT_PUBLISHED**.
- **requireLessonAccess:** Owner and admin bypass content check (see lesson regardless of status). Students require published + entitlement.
- **PUT /api/lessons/:id:** Owner may edit only when status is **draft** or **in_review**. Admin may edit any. Returns 403 `EDIT_PUBLISHED` if owner tries to edit published.

---

## Routes

| Method | Path | Auth | Who | Behaviour |
|--------|------|------|-----|-----------|
| POST | /api/lessons | ✓ | teacher | Creates lesson with `status: "draft"`. |
| PUT | /api/lessons/:id | ✓ | owner/admin | Edit; owner only if draft or in_review. |
| POST | /api/lessons/:id/submit-review | ✓ | owner | DRAFT → in_review; creates LessonReview PENDING. 409 INVALID_STATE if already in_review or published. |
| POST | /api/lessons/:id/unpublish | ✓ | owner/admin | PUBLISHED → draft. 409 INVALID_STATE if not published. |
| POST | /api/reviews/lesson/:lessonId/approve | ✓ | admin/reviewer | IN_REVIEW → published; marks latest PENDING → APPROVED, sets reviewedBy, notes. |
| POST | /api/reviews/lesson/:lessonId/reject | ✓ | admin/reviewer | IN_REVIEW → draft; marks latest PENDING → REJECTED. |
| GET | /api/lessons/:id | ✓ | requireLessonAccess | Owner/admin see any status; others require published + entitlement. |
| GET | /api/lessons | ✓ | — | **List filtering:** students see only **published**; teachers see **own** (any status except archived/flagged); admins see **all** (except archived/flagged). List-safe shape only. |

---

## Tests and CI

- **backend/tests/lessonReviewWorkflow.integration.test.js**: draft lifecycle (create, student 403, owner 200, submit-review, student 403 on in_review, admin approve → published, entitled student 200), reject (in_review → draft), invalid transitions (409 INVALID_STATE), unpublish, list filtering (student excludes draft, teacher sees own draft).
- **backend/tests/canAccessContent.test.js**: Phase 9D cases for status draft / in_review → NOT_PUBLISHED, published → allow when entitled.
- **npm run test:backend** includes all of the above.

---

## Tagging (one-time)

After CI is green:

```
git tag -a phase-9d-teacher-review-locked -m "Phase 9D teacher review locked: state machine, submit/approve/reject/unpublish, list filtering, tests"
git push origin phase-9d-teacher-review-locked
```
