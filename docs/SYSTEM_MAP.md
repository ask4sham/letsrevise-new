# LetsRevise System Map

## Frontend

**LessonViewPage.tsx**
Student lesson interface showing lesson content and practice.

**EditLessonPage.tsx**
Teacher lesson editor including pages, blocks, flashcards, quizzes, and assessments.

**AttachPaperModal.tsx**
Modal for attaching practice papers to lessons.

**AttachedAssessmentPapersPanel.tsx**
Displays attached practice papers.

**FlashcardsEditor**
Teacher tool for creating and editing flashcards.

## Backend

**Lesson APIs**

- GET /lessons/:id/practice
- lesson assessment generation endpoints

**Assessment Paper APIs**

- pagination support
- fields=summary
- mineOnly filter
- text search q

## Models

- Lesson
- AssessmentPaper
- ExamQuestion
- TopicFlashcard
- TopicQuizQuestion

## Scripts

- backend/scripts/dedupLessonPracticeSources.js
- backend/scripts/runDedupLessonPracticeSources.js
