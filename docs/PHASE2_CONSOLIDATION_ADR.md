# Phase 2 Consolidation — Architecture Decision Record

**Date:** 2025-03-15  
**Status:** Accepted

---

## A. Canonical Mastery Source

**Decision:** `studentTopicEvidenceService` is the canonical per-student topic mastery source.

**Why:**
- Uses `LearningEvidenceEvent` — the single event store already wired to quiz, flashcard, exam, and lesson completion
- Deterministic formula: masteryScore = (quizAccuracy + examAccuracy) / 2 (or single source if one null)
- DifficultyLevel derived from accuracy: very_difficult &lt;50%, difficult &lt;65%, moderate &lt;80%, well_understood ≥80%
- No dependency on `CoverageSnapshot` or `StudentTopicProgress` for the core score
- Extending with `userId` filter is minimal (add one query constraint)

**Delegation:**
- **topicIntelligenceService** — continues to call `studentTopicEvidenceService` for aggregate learning data (admin view). For per-student views, call with `userId`.
- **TopicMastery** — remains for backward compatibility; `mastery.routes` POST /record still updates it. Display logic should prefer `studentTopicEvidenceService` when available. Deprecate display usage over time.
- **studentTopicProgressService** — remains for signal recording (lessonViews, aiEnquiries, etc.) and study coach nextAction/reason. Study coach continues to use it for prioritisation. For mastery *score* display, prefer `studentTopicEvidenceService`.

---

## B. Canonical Dashboard Endpoint

**Decision:** `GET /api/student/dashboard` is the single student dashboard endpoint.

**Response shape:**
```json
{
  "ok": true,
  "summary": { "revisionFocus": "..." },
  "weakTopics": [...],
  "recentActivity": [...],
  "studyPlan": { "plan": [...], "specKey": "..." },
  "recommendations": { "topics": [...], "lessons": [...] }
}
```

**Implementation:** Thin aggregation layer. Reuses:
- `studentTopicEvidenceService.getStudentSpecLearningEvidence` for weak topics (masteryScore &lt; 70)
- `studentTopicEvidenceService.getStudentRecentActivity` (new) from LearningEvidenceEvent
- `studyCoach` plan logic (extracted to service)
- `reports/students/me/recommendations` logic (extracted to service)

**Existing endpoints:** Remain for backward compatibility. Frontend migrates to single dashboard call.

---

## C. Canonical Recommendation Source

**Decision:** `studentRecommendationsService` (extracted from reports) is the canonical source for struggle topics + recommended lessons.

**Logic:** PracticeAttempt-based scoring (highConfidenceWrong×3 + wrong - correct×0.5), top topics, matched lessons. Same as current `GET /api/reports/students/me/recommendations`.

**Delegation:** `GET /api/reports/students/me/recommendations` delegates to `studentRecommendationsService.getRecommendations(userId, days, limit)`.

---

## Implementation Summary (Completed)

| Task | Status |
|------|--------|
| Extend studentTopicEvidenceService with userId | Done — getTopicLearningEvidence(specKey, topicKey, userId), getStudentRecentActivity |
| Add GET /api/student/topic-evidence | Done |
| Add GET /api/student/dashboard | Done |
| Extract studyCoachService.getPlanData | Done — controller delegates |
| Extract studentRecommendationsService | Done — reports route delegates |
| Create studentDashboardService | Done |
| Update StudentDashboard | Done — uses dashboard first, fallback to legacy |

---

## Duplication Removal Plan

| Component | Action |
|-----------|--------|
| **studentTopicEvidenceService** | Extend with per-user. Becomes canonical mastery. |
| **studentTopicProgressService** | Keep. Used for signals, study coach nextAction. Do not use for mastery display. |
| **TopicMastery** | Keep for now. mastery.routes still writes. Display prefers studentTopicEvidenceService. |
| **knowledge-gap weak areas** | Dashboard uses studentTopicEvidenceService weak topics. knowledge-gap route can optionally add LLM summary; weak list from same source. |
| **reports/students/me/recommendations** | Extract to studentRecommendationsService. Route delegates. |
| **study coach getPlan** | Extract to studyCoachService.getPlanData. Controller delegates. |

---

## Minimal Implementation Task List

| # | Task | Type |
|---|------|------|
| 1 | Extend studentTopicEvidenceService with getStudentTopicLearningEvidence(userId, ...), getStudentSpecLearningEvidence(userId, ...), getStudentRecentActivity(userId, limit) | **Extend existing** |
| 2 | Add GET /api/student/topic-evidence?specKey=&topicKey= | **Build new** |
| 3 | Extract studyCoachService.getPlanData(userId, specKey) from controller | **Refactor existing** |
| 4 | Extract studentRecommendationsService.getRecommendations(userId, days, limit) from reports | **Refactor existing** |
| 5 | Create studentDashboardService.getDashboard(userId, specKey) | **Build new** |
| 6 | Add GET /api/student/dashboard | **Build new** |
| 7 | Update StudentDashboard to use GET /api/student/dashboard (with fallback) | **Refactor existing** |
