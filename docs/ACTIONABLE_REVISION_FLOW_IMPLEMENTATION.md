# Actionable Revision Flow Implementation

## Summary

The mastery view on `StudentMyProgressPage` is now an **actionable revision interface**. Students can start flashcards, quiz, or exam practice in one click from the progress page. All topic data continues to come from `GET /api/student/dashboard`; no per-topic API calls were introduced.

## Architecture

- **Canonical mastery source:** `studentTopicEvidenceService` (LearningEvidenceEvent)
- **Canonical dashboard:** `GET /api/student/dashboard`
- **Practice content:** Fetched separately by practice pages (flashcards, quiz, exam)
- **Evidence recording:** `learningEvidenceService` (flashcard_review, quiz_attempt, exam_question_attempt)

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/utils/topicRevisionAction.ts` | Helper to determine recommended action from mastery score |
| `frontend/src/api/studentContent.ts` | API for topic flashcards |
| `frontend/src/pages/FlashcardSessionPage.tsx` | Flashcard session by topic |
| `frontend/src/pages/QuizSessionPage.tsx` | Quiz session by topic |
| `frontend/src/pages/ExamPracticePage.tsx` | Exam practice by topic |
| `docs/ACTIONABLE_REVISION_FLOW_IMPLEMENTATION.md` | This document |

## Files Modified

| File | Changes |
|------|---------|
| `backend/services/studentDashboardService.js` | Added `linkedTeachers` to dashboard response |
| `backend/routes/student.js` | Added `GET /api/student/content/topic-flashcards` |
| `backend/routes/progress.routes.js` | Extended flashcard-review to accept `flashcardId`, `difficultyRating` |
| `backend/routes/practiceAttempts.js` | Record `quiz_attempt` and `exam_question_attempt` to LearningEvidenceEvent |
| `frontend/src/api/studentDashboard.ts` | Added `LinkedTeacher` type, `linkedTeachers` to response |
| `frontend/src/api/studyCoach.ts` | Added `postFlashcardReview` |
| `frontend/src/pages/StudentMyProgressPage.tsx` | Action column with topicRevisionAction, Recommended Next action cards, mastery progress bars |
| `frontend/src/App.tsx` | Added routes `/practice/flashcards/:topicKey`, `/practice/quiz/:topicKey`, `/practice/exam/:topicKey` |

## Practice Routes

| Route | Page | Content Source |
|-------|------|----------------|
| `/practice/flashcards/:topicKey` | FlashcardSessionPage | GET /api/student/content/topic-flashcards |
| `/practice/quiz/:topicKey` | QuizSessionPage | POST /api/practice-sets/generate (quiz_mcq, quiz_short) |
| `/practice/exam/:topicKey` | ExamPracticePage | POST /api/practice-sets/generate (exam_question, past_paper_question) |

## Topic Revision Action Logic

| Mastery | Action | Route |
|---------|--------|-------|
| &lt; 40% | Start Flashcards | /practice/flashcards/:topicKey |
| 40–69% | Start Quiz | /practice/quiz/:topicKey |
| 70–84% | Exam Practice | /practice/exam/:topicKey |
| ≥ 85% | Review | /practice/flashcards/:topicKey |

## Evidence Event Integration

All practice sessions emit `LearningEvidenceEvent` records:

| Event Type | Source | When |
|------------|--------|------|
| `flashcard_review` | POST /api/progress/flashcard-review | On difficulty change in FlashcardsView |
| `quiz_attempt` | POST /api/practice-attempts | On quiz_mcq / quiz_short submit |
| `exam_question_attempt` | POST /api/practice-attempts | On exam_question / past_paper_question submit |

Events include: `userId`, `specKey`, `topicKey`, `eventType`, optional `score`/`correct`/`timeSpentSeconds`, `createdAt`.

## Progress Auto Refresh

After completing a practice session, the user is navigated to `/student/my-progress`. The page loads on mount and calls `getStudentDashboard()`, so mastery data is refreshed automatically.

## Confirmation: No Duplicate Mastery Logic

- No new mastery computation was introduced.
- Mastery continues to come from `studentTopicEvidenceService` via the dashboard.
- `topicRevisionAction` only uses `masteryScore` from the dashboard response to choose the action label/route.
- Recommendation data for "Recommended Next" continues to come from `studyCoachService.getPlanData()`.

## UX

- Mastery table uses colour-coded progress bars: red (&lt;40), orange (40–69), green (70–84), blue (≥85).
- Action buttons use clear "Next Action" styling.
- Recommended Next shows action cards with mastery % and one-click buttons.
- Existing badges (SubjectBadge, TopicStatusBadge, DifficultyBadge) are unchanged.
