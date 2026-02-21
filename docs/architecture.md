# Let's Revise — Architecture Overview

One-page reference for developers. See `docs/runbook.md` for operations.

---

## 1. Core Objects

| Object | Purpose |
|--------|---------|
| **Lesson** | Teacher-owned content: pages, quiz (`lesson.quiz.questions`), assessment (`lesson.assessment.questions`), flashcards, past papers, exam questions |
| **Topic Banks** | Teacher-owned, per-topicKey: `TopicFlashcard`, `TopicQuizQuestion` (kind: quiz/assessment), `TopicPastPaper` |
| **Worksheet** | Teacher-owned, references ExamQuestions; share via WorksheetAssignment |
| **Quiz/Assessment attempts** | (PR-SQ1) Share link → QuizAssignment → QuizAttempt — student attempts lesson quiz/assessment via `/q/:shareId` |
| **Past Papers** | Snapshot in `lesson.pastPapers` from TopicPastPaper bank (URL or file) |

---

## 2. Invariants

- **topicKey**: Canonical AQA GCSE Biology key (e.g. `cell-structure`). Use `topicToKey(lesson.topic)` or `lesson.topicKey`.
- **Bank status**: draft | published. Only **published** items are used when generating into lessons.
- **Generate**: Published-only, **replace** semantics (overwrites), **snapshot** copy (no bank IDs in lesson).
- **Fingerprint**: Banks use fingerprints for dedupe. TopicQuizQuestion fingerprint includes `kind` (quiz vs assessment).

---

## 3. Data Flow

```
Bank (TopicFlashcard / TopicQuizQuestion / TopicPastPaper)
    → Generate (published-only, replace)
        → Lesson (flashcards / quiz / assessment / pastPapers)
            → Assignment (WorksheetAssignment or QuizAssignment)
                → Attempt (WorksheetAttempt or QuizAttempt)
                    → Release (teacher) → Student sees score
```

---

## 4. Endpoint Map (High Level)

| Path | Auth | Purpose |
|------|------|---------|
| `/api/auth/*` | public/login | Login, register |
| `/api/lessons/*` | auth + access | CRUD, generate flashcards/quiz/assessment/past-papers |
| `/api/topic-flashcards/*` | teacher/admin | Bank CRUD, bulk import |
| `/api/topic-quiz-questions/*` | teacher/admin | Bank CRUD, bulk import (kind=quiz/assessment) |
| `/api/topic-past-papers/*` | teacher/admin | Bank CRUD, bulk URL import, file upload |
| `/api/worksheet-assignments/*` | teacher + public share | Create assignment, share link, create attempt |
| `/api/worksheet-attempts/*` | public + teacher | Save/submit attempt, release, teacher view |
| `/api/worksheet-reports/*` | teacher/admin | Needs marking, attempt list, summary |
| `/api/exam-questions/*` | teacher/admin | Question bank |
| `/api/admin/*` | admin | Users, lessons, metrics, ops |
| `/api/taxonomy/aqa-gcse-biology` | public | Topic list |
| `/api/reports/*` | teacher/admin | Biology readiness, attempts, needs attention |

---

## 5. Access Control Matrix

| Role | Topic Banks | Lesson Generate | File Download (past papers) | Worksheet/Quiz Assign | Student Attempt |
|------|-------------|-----------------|-----------------------------|------------------------|-----------------|
| **teacher** | own only | owner only | owner only | own only | — |
| **admin** | all | all | all | all | — |
| **student** | 403 | — | — | — | via share link (public) |
| **public** | — | — | — | — | via share link (no auth) |

---

## 6. Storage

- **MongoDB**: All models (Lesson, User, TopicFlashcard, TopicQuizQuestion, TopicPastPaper, Worksheet, etc.)
- **Uploads (local)**: `backend/uploads/past-papers/`, `backend/uploads/ai-diagrams/` — excluded from git
- **Future**: S3-compatible storage seam for uploads

---

## 7. Test Commands

```bash
cd backend

# Index verification (PR-HARD-3)
npm run verify:indexes

# All integration tests
npm test

# Specific suites (copy/paste)
npm test -- tests/topicFlashcards.integration.test.js
npm test -- tests/topicQuizQuestionsBulkImport.integration.test.js
npm test -- tests/topicPastPapersBulkImport.integration.test.js
npm test -- tests/topicPastPapersUpload.integration.test.js
npm test -- tests/topicFlashcards.integration.test.js  # includes generate/flashcards-from-topic
npm test -- tests/lessonGenerateQuizFromTopic.integration.test.js
npm test -- tests/lessonGeneratePastPapersFromTopic.integration.test.js
npm test -- tests/lessonGenerateAssessmentFromTopic.integration.test.js
npm test -- tests/worksheetAssignment.integration.test.js
npm test -- tests/limitsAndRateLimit.integration.test.js
npm test -- tests/lessonsContentAccess.integration.test.js
```
