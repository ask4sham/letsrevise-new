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

**AskAiPanel** (PR-005, PR-019)
Teacher-only panel in LessonViewPage: threaded chat UI, conversation + follow-ups, /api/enquiry with conversationId, answer + citations + practice + feedback per message.

**AskAiStudentPanel** (PR-007, PR-019)
Student panel when AI_TUTOR_ENABLED_SPECS includes spec: "Ask for help"; threaded chat, practice-first, collapsed explanation/citations.

**CoverageDashboardPage** (PR-010, PR-012, PR-013)
Teacher/admin page at /coverage: AI coverage status per topic, weak-evidence hotspots, snapshot vs live toggle, "Generate sprint order" download button, row click opens drill-down panel.

**CoverageTopicDrawer** (PR-013, PR-014)
Side drawer on /coverage: View button opens drawer with spec coverage, lessons, weak questions, sprint download. Ask AI copies question to clipboard. "Generate starter pack (draft)" creates draft lesson + flashcards + quiz + exam questions (PR-014).

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
- ContentGenerationJob (PR-014: starter pack generation jobs, audit trail)

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
- backend/scripts/buildSprintOrderFromCoverage.js (--specKey, --apply, --windowDays, --useSnapshots, --top, --minEnquiries, --weights)
- backend/scripts/runBuildSprintOrderFromCoverage.js (wrapper: reads npm_config_specKey, forwards args)
- backend/scripts/runEnquirySmokeTest.js

NPM maintenance scripts (backend):
- maintenance:sprint-order — dry run (requires --specKey=...)
- maintenance:sprint-order:apply
- maintenance:sprint-order:spec / maintenance:sprint-order:spec:apply

## Conversations API (PR-019)

- POST /api/conversations { specKey, topicKey?, lessonId? } — create conversation, returns { conversationId }
- GET /api/conversations/:id — get conversation + messages (owner or admin)
- GET /api/conversations?specKey=&topicKey=&limit=20 — list recent conversations for user

## Enquiry API (PR-004, PR-006, PR-007, PR-019)

- POST /api/enquiry — teacher + admin + student (when flag enabled). Body may include conversationId for threaded follow-ups. Rate limits: student 5/min, teacher 10/min, admin 30/min
- POST /api/enquiry/:id/feedback — thumbs up/down + optional comment (teacher + admin)
- With conversationId: loads last 3 pairs as context, appends user+assistant to ConversationMessage; cache key includes conversationId

## Feature Flags (PR-007)

- GET /api/feature-flags/ai-tutor?specKey=... — auth required, returns { enabled: boolean }

## Coverage API (PR-009)

- GET /api/coverage?specKey=...&windowDays=14 — teacher + admin, live computed coverage
- GET /api/coverage/snapshots?specKey=...&latest=true — teacher + admin, saved snapshots
- GET /api/coverage/topics?specKey=...&status=THIN — teacher + admin, filtered topicKeys
- GET /api/coverage/drilldown?specKey=...&topicKey=...&windowDays=14 — teacher/admin, drill-down (PR-013)

## Frontend Coverage (PR-010)

- frontend/src/api/coverage.ts — getCoverage, getCoverageSnapshots, getCoverageTopics
- frontend/src/api/coverageDrilldown.ts — getCoverageDrilldown (PR-013)
- /coverage — CoverageDashboardPage (teacher/admin)

## Sprint Order API (PR-012)

- GET /api/sprint-order?specKey=... — teacher/admin, rate limited (10/min teacher, 30/min admin), markdown download
- POST /api/sprint-order/snapshots/ensure — admin only, X-Confirm required
- frontend/src/api/sprintOrder.ts — getSprintOrderMarkdown (fetch + trigger download)

## Content Generation API (PR-014)

- POST /api/generate/starter-pack { specKey, topicKey, statementCodes?, tier? } — teacher/admin, rate limited (3/min teacher, 10/min admin)
- GET /api/generate/jobs?specKey=...&topicKey=...&limit=20 — teacher/admin, audit recent jobs
- ContentGenerationJob model — tracks generation requests and outputs; publishedAt, publishedBy (PR-014.1)
- backend/services/generation/starterPackService.js — retrieval + LLM call
- frontend/src/api/generation.ts — postGenerateStarterPack, getGenerationJobs

## Publish Gate API (PR-014.1 / PR-014.1a / PR-014.1b)

- GET /api/publish-gate/check?jobId=... — teacher/admin, rate limited (10/min teacher, 30/min admin), returns { ok, blocks, warns, issues: [{ level, type, entityId, message, fixLink }], summaryByType }
- POST /api/publish-gate/publish { jobId } — teacher/admin, publishes all job outputs (lesson, flashcards, quiz, exam) only when blocks === 0. Returns 400 with issues if blocked. Idempotent.
- backend/services/publishGate/validatePublishableContent.js — validatePublishableContent, validateStarterPackPublishability (ownership)
- backend/middleware/requirePublishGateIfGenerated.js — for entities with metadata.generatedFrom.jobId, runs validation and blocks publish if issues
- Hard gates: TopicFlashcard, TopicQuizQuestion, Lesson, ExamQuestion publish routes check gate for generated content; non-generated content unchanged
- frontend/src/components/generation/ReviewPublishChecklist.tsx — Run check, "Publish all" when blocks === 0, success links (View lesson as student, Back to coverage)
- EditLessonPage: intercept publish for lessons with metadata.generatedFrom.jobId; show gate modal if blocked
- Response now includes suggestedActions (PR-016a): practice, lesson, flashcards, quiz, coverage (teacher/admin when weak)
- Response includes confidenceLevel, confidenceReason, confidenceSignals (PR-017): strong/moderate/weak from retrieval + sources
- AskAiPanel: Confidence badge + reason + "Sources: Spec X, Lesson Y" (teacher/admin)
- AskAiStudentPanel: Confidence: High/Medium/Low badge; weak shows "Your course content may not cover this fully yet."
- CoverageDashboardPage: ?focusTopicKey=... auto-opens topic drawer
- CitationsList (PR-018): numbered [1],[2],[3], SPEC/LESSON/EXTERNAL badges, source quality line, deep links. Used by both Ask AI panels.

## Background Jobs (PR-015)

- BackgroundJob model — type KNOWLEDGE_REFRESH, status queued|running|completed|failed, specKey, topicKey, sourceTypes, logs
- enqueueKnowledgeRefresh — fired on publish (gate, lesson, flashcard, quiz, exam); deduplicates by specKey+topicKey
- knowledgeRefreshWorker — polls every 5s; runs rebuildKnowledgeIndex → embedChangedDocuments → refreshCoverageSnapshot
- Safe when vector DB down: index and coverage complete; embeddings skipped with log
- GET /api/admin/jobs?type=...&status=... — admin, list jobs
- POST /api/admin/jobs/enqueue-knowledge-refresh { specKey, topicKey? } — admin, manual enqueue
- npm run worker:knowledge-refresh (run worker in dev/prod)
