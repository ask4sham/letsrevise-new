# LETSREVISE – PHASE 2 SYSTEM AUDIT

**Date:** 2025-03-15  
**Objective:** Full audit of existing Phase 2 functionality before building further features.  
**Method:** Repository-wide search, file inspection, logic comparison.

---

## 1. Executive Summary

### What Already Exists

- **Student dashboard** – `StudentDashboard.tsx` with lesson browse, revision focus (knowledge-gap), recommended next, My Work/Progress/Practice links.
- **Topic mastery** – Two parallel systems: `TopicMastery` (quiz correct/attempts) and `StudentTopicProgress` (signals-based mastery). `studentTopicEvidenceService` aggregates `LearningEvidenceEvent` for admin view (not per-student).
- **Mastery scoring** – Three distinct formulas: (1) `studentTopicEvidenceService` (quiz+exam accuracy %), (2) `studentTopicProgressService` (signals-based 0–100), (3) `TopicMastery` (correct/attempts 0–1).
- **Revision recommendation** – `GET /api/student/knowledge-gap` (weak areas + LLM summary), `GET /api/reports/students/me/recommendations` (struggle topics + lessons), `StudyPlanPanel` (study coach plan).
- **Personalised revision planner** – `StudyPlanPanel` + `studyCoach.controller` (top 3–5 topics from `StudentTopicProgress` + `CoverageSnapshot`).
- **Recent activity** – `StudentProgressPage` uses `GET /api/progress/stats` (purchased lessons lastAccessed). `StudentDashboard` has no recent-activity feed.
- **Priority topics** – `priorityScore` in curriculum gap, evidence review, topic intelligence (admin/teacher). Student-facing: weak topics from knowledge-gap and recommendations.
- **Topic-level performance** – `StudentMyProgressPage` (quiz attempts by topic), `TopicCommandCenterPage` (admin), `TeacherTopicPerformancePage`.
- **Student API routes** – `/api/student/*`, `/api/progress/*`, `/api/mastery/*`, `/api/study-coach/*`, `/api/reports/students/me/recommendations`.
- **Cached mastery** – `StudentTopicProgress` (signals + recomputed mastery), `TopicMastery` (attempts/correct). No single cached model.

### Biggest Reuse Opportunities

1. **studentTopicEvidenceService** – Already aggregates `LearningEvidenceEvent` (quiz, flashcard, exam, lesson). Extend for per-student filtering instead of creating a new evidence aggregator.
2. **StudyPlanPanel + studyCoach** – Personalised plan exists; extend with daily revision plan UI and wire to same backend.
3. **ContentCoveragePage / TopicCommandCenterPage** – Admin views already show mastery, evidence health, priority. Student dashboard can reuse aggregation patterns (with per-user scope).
4. **LearningEvidenceEvent** – Single event store; quiz/exam/lesson/flashcard recording already wired. Ensure all student actions flow through it.

### Biggest Missing Pieces

1. **Single canonical mastery service** – Three competing formulas; no per-student API that returns unified mastery from `LearningEvidenceEvent`.
2. **Student-facing topic mastery page** – No dedicated page showing per-topic mastery, difficulty, evidence health for the student.
3. **Daily revision plan** – Study plan exists but not framed as “today’s plan” with time slots or daily goals.
4. **Recent activity feed on StudentDashboard** – `StudentProgressPage` has it (purchased-lesson centric); dashboard does not.
5. **Unified student evidence API** – No single endpoint returning student’s topic-level evidence (mastery, difficulty, recent activity) for dashboard.

### Risk of Duplication

**High.** Mastery is computed in:
- `studentTopicEvidenceService` (aggregate, from LearningEvidenceEvent)
- `studentTopicProgressService` (per-user, from signals)
- `TopicMastery` (per-user, from quiz record)
- `student.js` `/progress` and `/knowledge-gap` (QuizAttempt + PracticeAttempt)

Recommendation: Choose one canonical source for student mastery and have other systems delegate to it.

---

## 2. Feature Inventory Table

| Capability | Status | Notes |
|------------|--------|-------|
| Student dashboard | **Complete** | `StudentDashboard.tsx` – lessons, revision focus, recommendations, links |
| Topic mastery page | **Partial** | `StudentMyProgressPage` shows topic-level quiz stats; no dedicated mastery page |
| Mastery scoring service | **Exists under other names** | 3 services: studentTopicEvidenceService, studentTopicProgressService, TopicMastery |
| Revision recommendation engine | **Complete** | knowledge-gap, reports/students/me/recommendations, StudyPlanPanel |
| Personalised revision planner | **Complete** | StudyPlanPanel + studyCoach (top 3–5 topics, next actions) |
| Recent activity feed | **Partial** | `StudentProgressPage` has it; `StudentDashboard` does not |
| Priority topics | **Complete** | Admin: priorityScore in gaps/evidence; Student: weak topics from knowledge-gap |
| Topic-level performance view | **Complete** | StudentMyProgressPage, TeacherTopicPerformancePage, TopicCommandCenterPage |
| Daily revision plan | **Partial** | Study plan exists; not framed as daily plan with slots |
| Student API routes | **Complete** | student, progress, mastery, study-coach, reports/students/me |
| Student controllers | **Complete** | student.js, studyCoach.controller, progress.routes |
| Student components | **Complete** | StudyPlanPanel, RevisionFocusBlock, StudentMyWorkPage, etc. |
| Cached mastery model | **Partial** | StudentTopicProgress + TopicMastery; no single canonical cache |

---

## 3. Backend Audit

### Services

| File | Purpose |
|------|---------|
| `studentTopicEvidenceService.js` | Aggregates `LearningEvidenceEvent` by topic (no userId). Returns quiz/flashcard/exam/lesson stats, masteryScore (quiz+exam accuracy %), difficultyLevel. Used by topicIntelligenceService. |
| `topicEvidenceService.js` | Content-quality evidence (issues, autopilot, approvals). evidenceHealth, weak/strong topics. Admin/teacher only. |
| `topicIntelligenceService.js` | Orchestrates topic command center: coverage, gap, readiness, evidence, learning, autopilot. Calls studentTopicEvidenceService for learning data (aggregate). |
| `evidenceReviewWorklistService.js` | Admin worklist for blocked/review_required topics. priorityScore, recommended actions. |
| `learningEvidenceService.js` | Records events: recordQuizAttempt, recordFlashcardReview, recordExamQuestionAttempt, recordLessonCompletion. |
| `progress/studentTopicProgressService.js` | Per-user signals (lessonViews, practiceAttempts, flashcardReviews, etc.). recomputeMastery (0–100), nextAction, reason. Used by study coach. |
| `curriculumGapDetectionService.js` | priorityScore, gapFlags, recommendations for content gaps. |
| `autopilotReadinessService.js` | readiness flags, blockers, available actions. |
| `autopilotGatingService.js` | Gate status from evidence + readiness. |
| `autopilotFeedbackService.js` | Weak topics (low approval), feedback by topic. |
| `revisionMetrics.js` | In-process counters for revision generation (not student mastery). |
| `validateRevision.js` | Validates flashcard/quiz content shape. |
| `generateRevision.js` | AI revision generation for lessons. |

### Models

| File | Purpose |
|------|---------|
| `LearningEvidenceEvent.js` | eventType: quiz_attempt, flashcard_review, exam_question_attempt, lesson_completion. Indexes: specKey+topicKey, eventType, userId, createdAt. |
| `TopicMastery.js` | userId, topicKey, attempts, correct, masteryScore (correct/attempts). Indexes: userId+topicKey, topicKey+masteryScore. |
| `StudentTopicProgress.js` | userId, specKey, topicKey, masteryScore, confidenceBand, status, signals, recommendations. Indexes: userId+specKey+topicKey, etc. |
| `TopicFlashcard.js` | Topic bank flashcards. |
| `TopicQuizQuestion.js` | Topic bank quiz questions. |
| `ExamQuestion.js` | Exam questions. |
| `PracticeAttempt.js` | Student practice attempts (topicKey, outcome, confidence). |
| `QuizAttempt.js` | Quiz assignment attempts. |

### Routes

| Route | File | Purpose |
|-------|------|---------|
| `GET /api/student/my-work` | student.js | Worksheets, quizzes, assessments |
| `GET /api/student/progress` | student.js | Subjects, topics, avg score, needsPractice (QuizAttempt + taxonomy) |
| `GET /api/student/knowledge-gap` | student.js | Weak areas (PracticeAttempt + QuizAttempt), LLM revision focus |
| `POST /api/progress/lesson-view` | progress.routes.js | Records lesson view + LearningEvidenceEvent lesson_completion |
| `POST /api/progress/practice-attempt` | progress.routes.js | StudentTopicProgress signal |
| `POST /api/progress/flashcard-review` | progress.routes.js | StudentTopicProgress + LearningEvidenceEvent |
| `POST /api/progress/lesson-completion` | progress.routes.js | LearningEvidenceEvent lesson_completion |
| `GET /api/progress/stats` | progress.js | Purchased lessons stats, recentActivity (lastAccessed) |
| `POST /api/mastery/record` | mastery.routes.js | TopicMastery increment |
| `GET /api/mastery?topicKey=` | mastery.routes.js | Student mastery for topic |
| `GET /api/mastery/aggregate?specKey=` | mastery.routes.js | Teacher aggregate mastery |
| `GET /api/study-coach/plan?specKey=` | studyCoach.routes | Study plan (top 3–5 topics) |
| `GET /api/study-coach/topic/:topicKey` | studyCoach.routes | Single topic progress card |
| `GET /api/reports/students/me/recommendations` | reports.js | Struggle topics + recommended lessons (PracticeAttempt-based) |

### LearningEvidenceEvent Wiring

- **Quiz:** `quizAttempts.js` calls `recordQuizAttempt` on submit (when lesson has specKey/topicKey).
- **Flashcard:** `progress.routes.js` POST /flashcard-review calls `recordFlashcardReview` (no difficultyRating in current UI).
- **Exam:** `practiceAttempts.js` calls `recordExamQuestionAttempt` on practice completion.
- **Lesson:** `progress.routes.js` POST /lesson-view and /lesson-completion call `recordLessonCompletion`.

---

## 4. Frontend Audit

### Pages

| Page | Purpose |
|------|---------|
| `StudentDashboard.tsx` | Lesson browse, RevisionFocusBlock (knowledge-gap), Recommended next, filters, links to My Work/Progress/Practice |
| `StudentMyWorkPage.tsx` | Worksheets, quizzes, assessments (tabs) |
| `StudentMyProgressPage.tsx` | Subject/topic progress from GET /api/student/progress (quiz-based) |
| `StudentProgressPage.tsx` | Different page: GET /api/progress/stats (purchased lessons, recent activity) |
| `StudentPracticePage.tsx` | Practice set builder + runner |
| `QuickQuizPage.tsx` | Quick quiz |
| `StructureNotesPage.tsx` | Create notes |
| `LessonViewPage.tsx` | Lesson view, StudyPlanPanel, mastery recording |
| `ContentCoveragePage.tsx` | Admin: coverage, gaps, readiness, evidence, review, learning views |
| `TopicCommandCenterPage.tsx` | Admin: single-topic intelligence (mastery, evidence, autopilot) |
| `TeacherTopicPerformancePage.tsx` | Teacher topic performance |
| `BiologyReadinessReportPage.tsx` | Biology readiness |

### Components

| Component | Purpose |
|-----------|---------|
| `StudyPlanPanel` | Today’s study plan (top 3 topics, mastery, actions) – used in LessonViewPage |
| `RevisionFocusBlock` | Knowledge-gap summary + weak areas – used in StudentDashboard |
| `LessonProgressTracker` | Lesson progress |
| `AdaptiveFeedbackCard` | Mastery display (0–1 scale) |
| `CoverageTopicPanel`, `CoverageTopicDrawer` | Coverage UI |

### API Modules

| File | Purpose |
|------|---------|
| `studentProgress.ts` | getStudentProgress (GET /api/student/progress) |
| `studentMyWork.ts` | getStudentMyWork |
| `studentKnowledgeGap.ts` | getKnowledgeGap |
| `studyCoach.ts` | getStudyPlan, postLessonView, postLessonCompletion |
| `mastery.ts` | Mastery API |
| `contentGraph.ts` | Content graph, coverage, topic intelligence types |

---

## 5. API Audit

### Student-Facing Endpoints

| Method | Path | Response Shape |
|--------|------|----------------|
| GET | /api/student/my-work | `{ ok, worksheets, quizzes, assessments }` |
| GET | /api/student/progress | `{ ok, subjects, topics }` – topics: topicKey, topicName, attempted, quizAttempts, averageScore, needsPractice |
| GET | /api/student/knowledge-gap | `{ summary, weakAreas }` – weakAreas: topicKey, topicName, attempted, correct, total, percentage |
| GET | /api/progress/stats | `{ success, stats, recentActivity }` – stats: totalPurchased, completionRate, subjectProgress; recentActivity: lessonId, title, lastAccessed |
| GET | /api/reports/students/me/recommendations | `{ ok, days, topics, lessons }` – topics: topicKey, topic, score, wrong, highConfidenceWrong |
| GET | /api/study-coach/plan | `{ specKey, generatedAt, plan }` – plan: topicKey, masteryScore, status, reason, actions |
| GET | /api/study-coach/topic/:topicKey | Single topic progress card |
| GET | /api/mastery?topicKey= | `{ topicKey, attempts, correct, masteryScore }` (0–1) |
| POST | /api/mastery/record | `{ topicKey, attempts, correct, masteryScore }` |

### Admin/Teacher Endpoints (Relevant)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/content-graph/topic-intelligence/:specKey/:topicKey | Full topic intelligence (includes learningEvidence from studentTopicEvidenceService – aggregate) |
| GET | /api/content-graph/spec-coverage/:specKey | Spec coverage |
| GET | /api/content-graph/coverage/:specKey/:topicKey | Topic coverage |
| GET | /api/content-graph/autopilot/readiness/:specKey | Readiness |
| GET | /api/mastery/aggregate?specKey= | Teacher aggregate mastery |

---

## 6. Logic Overlap / Duplication Risks

### Mastery Calculation (3 Formulas)

1. **studentTopicEvidenceService**  
   - `masteryScore = (quizAccuracy + examAccuracy) / 2` or quiz/exam alone if one null.  
   - `difficultyLevel` from accuracy: &lt;50 very_difficult, &lt;65 difficult, &lt;80 moderate, else well_understood.  
   - **Scope:** Aggregate (no userId). Used by topicIntelligenceService.

2. **studentTopicProgressService**  
   - `masteryScore` 0–100 from signals: lessonViews, aiEnquiries, topicSummaries, flashcardReviews, practiceAttempts, practiceCorrect. Penalty for weakAiEnquiries. Coverage cap (THIN/EMPTY).  
   - **Scope:** Per-user. Used by study coach.

3. **TopicMastery**  
   - `masteryScore = correct / attempts` (0–1).  
   - **Scope:** Per-user. Used by mastery routes, LessonViewPage AdaptiveFeedbackCard.

### Weak Topics / Recommendations (3 Sources)

1. **student/knowledge-gap** – PracticeAttempt + QuizAttempt, &lt;70% = weak. LLM summary.  
2. **reports/students/me/recommendations** – PracticeAttempt (highConfidenceWrong, wrong). Score = highConfidenceWrong*3 + wrong - correct*0.5.  
3. **StudyPlanPanel** – StudentTopicProgress sorted by low mastery, weak AI, thin coverage.

### Evidence Health

- **topicEvidenceService** – evidenceHealth (strong/mixed/weak/unknown) from issues, approval rate, teacher revisions. Content quality.  
- **studentTopicEvidenceService** – difficultyLevel from accuracy. Student performance.  
- Different semantics; both used in TopicCommandCenterPage.

### Recent Activity

- **progress/stats** – recentActivity from `user.purchasedLessons` lastAccessed.  
- **student/progress** – topics with lastActivityAt from QuizAttempt submittedAt.  
- No unified recent-activity feed combining lesson views, quizzes, practice, flashcards.

---

## 7. Recommended Canonical Architecture

| Domain | Recommended Source of Truth | Action |
|--------|-----------------------------|--------|
| **Mastery (student-facing)** | Extend `studentTopicEvidenceService` with userId filter, or create `studentMasteryService` that aggregates from `LearningEvidenceEvent` per user | Consolidate; deprecate or delegate from TopicMastery and studentTopicProgressService for display |
| **Student evidence** | `LearningEvidenceEvent` + `studentTopicEvidenceService` (add per-user) | Single event store; single aggregation service |
| **Recommendations** | Keep `reports/students/me/recommendations` for struggle topics; unify with knowledge-gap weak areas | Consider merging or cross-referencing |
| **Dashboard summaries** | New endpoint aggregating: student progress, weak topics, recent activity, study plan | Build thin aggregation layer over existing services |
| **Topic-level performance** | `studentTopicEvidenceService` (per-user) for student view; `TopicCommandCenterPage` for admin | Add GET /api/student/topic-evidence or similar |

---

## 8. Gap List

Only genuinely missing items after audit:

1. **Per-student topic evidence API** – `studentTopicEvidenceService` is aggregate only. Need `getStudentTopicLearningEvidence(userId, specKey, topicKey)` or equivalent.
2. **Unified student dashboard API** – Single endpoint returning: weak topics, recent activity, study plan, mastery summary. Currently fetched from multiple endpoints.
3. **Student topic mastery page** – Dedicated page showing per-topic mastery, difficulty, next actions. StudentMyProgressPage is quiz-centric; no mastery-centric view.
4. **Recent activity on StudentDashboard** – StudentProgressPage has it; StudentDashboard does not show recent activity.
5. **Daily revision plan UI** – Study plan exists; not presented as “today’s plan” with time slots or daily goals.
6. **Canonical mastery service** – No single service that all consumers use. Need to pick one and have others delegate.
7. **Index on LearningEvidenceEvent for userId+specKey+topicKey** – Current indexes: specKey+topicKey, eventType, userId, createdAt. Consider compound for per-user topic queries.

---

## 9. Minimal Build Plan

Recommended smallest safe additive set of tasks:

1. **Extend studentTopicEvidenceService** – Add `getStudentTopicLearningEvidence(userId, specKey, topicKey)` filtering LearningEvidenceEvent by userId. Reuse existing aggregation logic.
2. **Add GET /api/student/topic-evidence or /api/student/mastery-summary** – Return per-student topic evidence for dashboard. Use extended studentTopicEvidenceService.
3. **Add recent activity to StudentDashboard** – Reuse `GET /api/progress/stats` recentActivity or extend to include LearningEvidenceEvent-based activity. Display compact feed.
4. **Unify weak-topic sources** – Document that knowledge-gap and recommendations use different data (PracticeAttempt vs QuizAttempt). Optionally merge or cross-link in UI.
5. **Choose canonical mastery for student UI** – Decide: LearningEvidenceEvent-based (studentTopicEvidenceService) vs TopicMastery vs StudentTopicProgress. Update LessonViewPage, StudyPlanPanel, StudentMyProgressPage to use one source.
6. **Student topic mastery page (optional)** – New page or extend StudentMyProgressPage to show mastery from canonical source, difficulty, next actions.
7. **Daily plan framing (optional)** – Relabel StudyPlanPanel as “Today’s revision plan” and add daily goal copy. No backend change.

---

## 10. Revised Phase 2 Roadmap (Post-Audit)

| Item | Classification | Notes |
|------|----------------|-------|
| Per-student topic evidence API | **Build new** | Extend studentTopicEvidenceService with userId |
| Unified dashboard API | **Build new** | Thin aggregation over existing |
| Student topic mastery page | **Build new** | Or extend StudentMyProgressPage |
| Recent activity on dashboard | **Extend existing** | Wire progress/stats or extend |
| Daily revision plan UI | **Extend existing** | Relabel StudyPlanPanel |
| Canonical mastery service | **Refactor existing** | Pick one; others delegate |
| Knowledge-gap + recommendations | **Refactor existing** | Unify or cross-link |
| LearningEvidenceEvent indexes | **Extend existing** | Add userId+specKey+topicKey if needed |

---

## 11. REVISED Phase 2 Roadmap (Second Deliverable)

Based on the audit, the following roadmap **excludes all already-existing functionality** and includes only **confirmed missing work**. Each item is classified as **Extend existing**, **Refactor existing**, or **Build new**.

### Extend Existing

| Item | What to Extend | Change |
|------|----------------|--------|
| Per-student topic evidence | `studentTopicEvidenceService` | Add `userId` filter to `LearningEvidenceEvent` queries; expose `getStudentTopicLearningEvidence(userId, specKey, topicKey)` |
| Recent activity on StudentDashboard | `StudentDashboard.tsx` | Add block that fetches `GET /api/progress/stats` recentActivity or new combined endpoint; display compact feed |
| Daily revision plan framing | `StudyPlanPanel` | Relabel as "Today's revision plan"; add daily goal copy; no backend change |
| LearningEvidenceEvent indexes | `LearningEvidenceEvent` schema | Add compound index `{ userId: 1, specKey: 1, topicKey: 1 }` if per-user topic queries are slow |

### Refactor Existing

| Item | What to Refactor | Change |
|------|------------------|--------|
| Canonical mastery service | `studentTopicEvidenceService`, `TopicMastery`, `studentTopicProgressService` | Choose one as canonical for student UI; have LessonViewPage, StudyPlanPanel, StudentMyProgressPage call it; deprecate or delegate others |
| Knowledge-gap + recommendations | `student/knowledge-gap`, `reports/students/me/recommendations` | Document difference (PracticeAttempt vs QuizAttempt); optionally merge weak-topic logic or cross-link in UI |
| Student progress data sources | `StudentMyProgressPage` (student/progress) vs `StudentProgressPage` (progress/stats) | Clarify: My Progress = quiz-based; Progress = purchased-lesson-based. Consider unifying or renaming for clarity |

### Build New

| Item | What to Build | Notes |
|------|---------------|-------|
| GET /api/student/topic-evidence or /api/student/mastery-summary | New route | Returns per-student topic evidence (mastery, difficulty, stats) for dashboard; uses extended studentTopicEvidenceService |
| Unified student dashboard API | New endpoint | Single GET returning: weak topics, recent activity, study plan summary, mastery overview. Thin aggregation over existing services |
| Student topic mastery page | New page or extend StudentMyProgressPage | Dedicated view of per-topic mastery, difficulty level, next actions. Uses canonical mastery source |

### Excluded (Already Exists)

- Student dashboard
- Topic-level performance view (StudentMyProgressPage, TeacherTopicPerformancePage)
- Revision recommendation engine (knowledge-gap, recommendations, StudyPlanPanel)
- Personalised revision planner (StudyPlanPanel + study coach)
- Priority topics (weak topics from knowledge-gap)
- Student API routes (student, progress, mastery, study-coach, reports)
- Student components (StudyPlanPanel, RevisionFocusBlock, etc.)
- Evidence recording (LearningEvidenceEvent, quiz/flashcard/exam/lesson)

---

*End of audit.*
