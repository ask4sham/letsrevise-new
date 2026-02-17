# Free Preview Rollout Checklist

## Backend
- [x] Lesson has `isFreePreview: boolean` default false
- [x] canAccessContent returns reason `FREE_PREVIEW` when `lesson.isFreePreview === true` (via `isFreePreviewAllowed(lesson)`)
- [x] Preview payload returns first page only and strips answers/markScheme/correctAnswer (lessonPayload.toLessonPreviewPayload)
- [x] GET /api/lessons/:id includes accessDecision
- [x] Create/update accept isFreePreview via pickLessonFlags (lessonValidation.js)
- [x] Admin PUT /api/admin/lessons/:id whitelists isFreePreview

## Teacher
- [x] Lesson editor shows "Free preview" toggle (EditLessonPage)
- [x] Saving a lesson persists isFreePreview (payload includes isFreePreview for both save and publish toggle)

## Student
- Non-entitled user:
  - if isFreePreview=false: 402 NOT_ENTITLED → locked view + Subscribe CTA
  - if isFreePreview=true: 200 preview payload → content + Subscribe CTA
- Entitled user always gets full content
- [x] Optional label "You're viewing a free preview (first page only)." when FREE_PREVIEW

## Metrics validation
- Viewing a free preview logs FREE_PREVIEW_VIEW
- Locked view logs PAYWALL_NOT_ENTITLED
- Clicking CTA logs SUBSCRIBE_CTA_CLICK
- Admin metrics reflect new behavior (CTR may improve on previewable lessons)

## Notes
- `allowed: true` + `reason: "FREE_PREVIEW"` — preview is partial access (first page, no answers), not full entitlement.
- LessonViewPage already handles FREE_PREVIEW and shows CTA.
- A/B by toggling isFreePreview on a few lessons and watching CTR in Admin → Paywall metrics.
