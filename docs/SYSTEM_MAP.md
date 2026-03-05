# LetsRevise System Map

## Frontend

**LessonViewPage.tsx**
Student lesson interface showing lesson content and practice. Teacher/admin: "Ask AI about this topic" panel (PR-005).

**EditLessonPage.tsx**
Teacher lesson editor including pages, blocks, flashcards, quizzes, and assessments.

**AttachPaperModal.tsx**
Modal for attaching practice papers to lessons.

**AttachedAssessmentPapersPanel.tsx**
Displays attached practice papers.

**FlashcardsEditor**
Teacher tool for creating and editing flashcards.

**AskAiPanel** (PR-005)
Teacher-only panel in LessonViewPage: prompt input, /api/enquiry call, answer + citations + practice rendering.

**AskAiStudentPanel** (PR-007)
Student panel when AI_TUTOR_ENABLED_SPECS includes spec: "Ask for help", practice-first, collapsed explanation/citations.

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
- EnquiryLog (PR-004: RAG enquiry observability; PR-006: feedback, cached)
- EnquiryCache (PR-006: enquiry response cache, 24h TTL)
- CoverageSnapshot (PR-009: cached per-topic coverage metrics, TTL 90 days)

## SpecStatement API (admin only)

- GET /api/spec-statements?specKey=&topicKey=&examBoard=&level=
- POST /api/spec-statements
- PUT /api/spec-statements/:id
- DELETE /api/spec-statements/:id

## KnowledgeDocument API

- GET /api/knowledge-documents — admin only (debug)
- GET /api/knowledge/search — teacher + admin (semantic search, q + specKey required)

## Vector Store (Postgres/pgvector)

- knowledge_embeddings table (knowledge_document_id, content_hash, embedding vector(1536))
- backend/services/vector/pgvectorClient.js
- backend/services/embeddings/provider.js (mock | openai)

## Scripts

- backend/scripts/dedupLessonPracticeSources.js
- backend/scripts/runDedupLessonPracticeSources.js
- backend/scripts/seedSpecStatements.js (--specKey, --file)
- backend/scripts/buildKnowledgeIndex.js (--apply, --specKey, --source)
- backend/scripts/runVectorMigrations.js
- backend/scripts/embedKnowledgeDocuments.js (--apply, --specKey, --source, --limit, --batchSize)
- backend/scripts/buildCoverageReport.js (--specKey, --apply, --windowDays, --top, --includeWeakQuestions)
- backend/scripts/runEnquirySmokeTest.js

## Enquiry API (PR-004, PR-006, PR-007)

- POST /api/enquiry — teacher + admin + student (when flag enabled). Rate limits: student 5/min, teacher 10/min, admin 30/min
- POST /api/enquiry/:id/feedback — thumbs up/down + optional comment (teacher + admin)

## Feature Flags (PR-007)

- GET /api/feature-flags/ai-tutor?specKey=... — auth required, returns { enabled: boolean }

## Coverage API (PR-009)

- GET /api/coverage?specKey=...&windowDays=14 — teacher + admin, live computed coverage
- GET /api/coverage/snapshots?specKey=...&latest=true — teacher + admin, saved snapshots
- GET /api/coverage/topics?specKey=...&status=THIN — teacher + admin, filtered topicKeys
