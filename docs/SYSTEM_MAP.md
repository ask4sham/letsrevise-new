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
- SpecStatement (PR-001: exam specification knowledge layer)
- KnowledgeDocument (PR-002: unified retrievable layer for SpecStatements + Lesson blocks)

## SpecStatement API (admin only)

- GET /api/spec-statements?specKey=&topicKey=&examBoard=&level=
- POST /api/spec-statements
- PUT /api/spec-statements/:id
- DELETE /api/spec-statements/:id

## Scripts

- backend/scripts/dedupLessonPracticeSources.js
- backend/scripts/runDedupLessonPracticeSources.js
- backend/scripts/seedSpecStatements.js (--specKey, --file)
- backend/scripts/buildKnowledgeIndex.js (--apply, --specKey, --source)
