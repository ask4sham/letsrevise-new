# Phase 2 — Student Mastery View Implementation Note

**Date:** 2025-03-15  
**Status:** Complete

---

## A. Implementation Summary

### Was StudentMyProgressPage sufficient?

**Yes.** The existing page structure supported the extension without a new page. The page already had:
- Overall section (subject-level stats)
- By-topic table
- Fallback empty state
- Link back to dashboard

We extended it by:
1. Fetching `GET /api/student/dashboard` first (single call)
2. Using `specEvidence.topics` for the canonical mastery table when available
3. Adding columns: Mastery %, Difficulty level, Attempts (quiz/exam breakdown)
4. Adding a "Recommended next" section from `studyPlan.plan`
5. Falling back to `GET /api/student/progress` when the dashboard fails

### Was a dedicated topic route necessary?

**No.** The current page structure supports the UX cleanly. Each topic row shows:
- Mastery score
- Difficulty level
- Attempts summary
- Status badge
- Action link (from study plan or browse-lessons)

A dedicated `/student/topic/:topicKey` route would only be useful for a drill-down detail view (e.g. full activity history, per-question breakdown). That was not in scope.

### Which existing components were reused?

| Component / Service | Reuse |
|--------------------|-------|
| `getStudentDashboard` | Primary data source; returns specEvidence, studyPlan |
| `getStudentProgress` | Fallback when dashboard fails |
| `SubjectBadge` | Unchanged; used for Overall status |
| `TopicStatusBadge` | Used in legacy table path only |
| `DifficultyBadge` | New; maps difficultyLevel to badge |
| `studentDashboardService` | Extended to include `specEvidence` in response |
| `studyCoachService.getPlanData` | Already in dashboard; used for Recommended next |

---

## B. UI Implementation

### Changes

1. **Dashboard response** — Added `specEvidence: { specKey, topics }` to `studentDashboardService.getDashboard()` so the progress page gets all topic evidence in one call.

2. **StudentMyProgressPage** — Refactored to:
   - Fetch dashboard first; fallback to progress
   - Render "Recommended next" from study plan (top 3 topics with reason + action links)
   - Overall section: derived from specEvidence when using canonical data
   - By-topic table: canonical path shows Mastery, Difficulty, Attempts, Status, Action
   - Legacy path: unchanged (Topic, Attempted, Avg score, Status, Action)

3. **No new components** — `DifficultyBadge` is a small inline helper; no new shared components.

### Minimal duplication

- Overall aggregation is computed once from `specEvidence.topics` (no separate API).
- Study plan comes from the same dashboard response.
- No parallel mastery logic; all from `studentTopicEvidenceService`.

---

## C. Performance

### Request pattern

- **One dashboard call** — `GET /api/student/dashboard` returns specEvidence, studyPlan, recommendations, etc. The progress page uses specEvidence and studyPlan only.
- **No N+1** — No per-topic `GET /api/student/topic-evidence` calls. All topic evidence comes from `getSpecLearningEvidence(specKey, userId)`, which runs one aggregation per spec.

### Index

- **LearningEvidenceEvent** — Added compound index `{ userId: 1, specKey: 1, topicKey: 1 }` for per-user topic queries used by dashboard and progress views.

### Concerns

- **Spec size** — `getSpecLearningEvidence` returns all topics in the spec (e.g. 50–100). Acceptable for now; consider pagination or filtering if specs grow.
- **Dashboard payload** — Progress page only needs specEvidence + studyPlan. A future `GET /api/student/progress-mastery?specKey=` could return just those for a lighter payload.

---

## D. Files Changed

| File | Change |
|------|--------|
| `backend/services/studentDashboardService.js` | Added `specEvidence` to response |
| `backend/models/LearningEvidenceEvent.js` | Added compound index |
| `frontend/src/api/studentDashboard.ts` | Added `TopicEvidence`, `specEvidence` types |
| `frontend/src/pages/StudentMyProgressPage.tsx` | Extended with canonical mastery view |
