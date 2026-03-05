# LetsRevise System Map

## Frontend

**LessonViewPage.tsx**
Student lesson interface showing lesson content and practice. Teacher/admin: "Ask AI about this topic" panel (PR-005). Students (PR-024.1): "Summarise this topic" button near Ask AI opens TopicSummaryStudentModal (Overview/Revision sheet only, feature-flagged).

**EditLessonPage.tsx**
Teacher lesson editor including pages, blocks, flashcards, quizzes, and assessments.

**AttachPaperModal.tsx**
Modal for attaching practice papers to lessons.

**AttachedAssessmentPapersPanel.tsx**
Displays attached practice papers.

**FlashcardsEditor**
Teacher tool for creating and editing flashcards.

**AskAiPanel** (PR-005, PR-019, PR-020, PR-021)
Teacher-only panel: threaded chat, response mode switch (Quick|Explain|Exam|Revision), flashcard practice type, "Use external references when course content is thin" checkbox. localStorage askai:mode:teacher, askai:allowExternal:teacher.

**ExternalSourcesPage** (PR-022, PR-023)
Route: /external-sources. Teacher/admin only. Tabs: Recent sources, Denylist. Actions: Deny domain, Deny URL, Promote to Teacher Note. Deep link filters: ?specKey=&topicKey= preselect spec and topic (PR-023).

**AskAiStudentPanel** (PR-007, PR-019, PR-020)
Student panel: threaded chat, mode switch (Quick|Explain|Revision), Exam hidden, flashcard practice, localStorage askai:mode:student.

**CoverageDashboardPage** (PR-010, PR-012, PR-013, PR-028)
Teacher/admin page at /coverage: AI coverage status per topic, weak-evidence hotspots, snapshot vs live toggle, "Generate sprint order" download button, row click opens drill-down panel. PR-028: columns enquiries, weak enq, summaries, weak sum, demand; "High demand (≥60)" filter; "weak enquiries" label.

**CoverageTopicDrawer** (PR-013, PR-014, PR-023, PR-024, PR-027, PR-028, PR-029)
Side drawer on /coverage: View button opens drawer with spec coverage, lessons, weak questions, sprint download. Ask AI copies question to clipboard. "Generate starter pack (draft)" creates draft lesson + flashcards + quiz + exam questions (PR-014). Teacher notes (curated) section lists promoted teacherNotes for topic (PR-023). Teaching summary section: "Summarise topic" opens modal with mode (Overview/Lesson plan/Revision sheet/Exam focus), max sources, allowExternal; generates structured summary with citations, confidence, copy buttons (PR-024). PR-027: "Recent summaries" list with Open, Download PDF, Load more. PR-028: header badges enq/sum counts. PR-029: "Create draft lesson" button in summary modal (when topicSummaryLogId exists), confirm modal, success links Edit/View lesson.

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
- KnowledgeDocument (PR-002: unified retrievable layer for SpecStatements + Lesson blocks; PR-021: externalTrusted; PR-022: teacherNote; PR-030: lessonDiagram)
- ExternalSourcePolicy (PR-022: url/domain allow/deny)
- ExternalSourceReview (PR-022: audit trail for promote/deny)
- EnquiryLog (PR-004: RAG enquiry observability; PR-006: feedback, cached)
- EnquiryCache (PR-006: enquiry response cache, 24h TTL)
- CoverageSnapshot (PR-009: cached per-topic coverage metrics, TTL 90 days; PR-028: summariesTotal, weakSummariesTotal, summariesByMode, demandScore)
- ContentGenerationJob (PR-014: starter pack generation jobs, audit trail)

## SpecStatement API (admin only)

- GET /api/spec-statements?specKey=&topicKey=&examBoard=&level=
- POST /api/spec-statements
- PUT /api/spec-statements/:id
- DELETE /api/spec-statements/:id

## KnowledgeDocument API

- GET /api/knowledge-documents — admin only (debug)
- GET /api/knowledge/search — teacher + admin (semantic search, q + specKey required). PR-030: lessonDiagram sourceType; +0.03 boost for diagram-intent queries.

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
- backend/scripts/buildSprintOrderFromCoverage.js (--specKey, --apply, --windowDays, --useSnapshots, --top, --minEnquiries, --weights coverage= weak= demand=)
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

## Enquiry API (PR-004, PR-006, PR-007, PR-019, PR-020)

- POST /api/enquiry — teacher + admin + student (when flag enabled). Body: conversationId?, responseMode? (quick|explain|exam|revision). Rate limits: student 5/min, teacher 10/min, admin 30/min
- POST /api/enquiry/:id/feedback — thumbs up/down + optional comment (teacher + admin)
- Cache key includes conversationId + responseMode. Practice types: mcq, short, exam, flashcard (front/back)

## Teacher Notes API (PR-023)

- GET /api/teacher-notes?specKey=&topicKey=&limit=20 — teacher/admin, list teacherNote KnowledgeDocuments for topic (sourceType=teacherNote, sorted by updatedAt desc)

## Topic Summary API (PR-024, PR-024.1, PR-025, PR-029)

- POST /api/topic-summary { specKey, topicKey, mode?, maxSources?, allowExternal? } — teacher/admin + student (when isAiTutorEnabledForSpec). Teachers: all 4 modes, 6/min. Admins: 20/min. Students (PR-024.1): overview and revisionSheet only, maxSources≤10, allowExternal forced false, 3/min. Student responses: no confidenceSignals, no teacherNote in citations, shorter/simpler LLM output. Cached 24h (key includes studentSafe).
- POST /api/topic-summary/export { topicSummaryLogId?, specKey, topicKey, mode?, includeCitations?, includeEvidenceAppendix?, includeNextSteps?, includeMiniRevisionAppendix?, evidenceQuoteChars?, summary?, usedSources?, ... } — teacher + student (when AI tutor enabled). Returns PDF attachment. Rate limited: students 2/min, teachers 6/min, admins 20/min. PDF rendered by backend/services/pdf/topicSummaryPdf.js (PDFKit). PR-026: layout engine, pagination, footer. PR-026.1: evidence appendix, next steps, mini revision appendix (teacher only); export options with role-based defaults.
- GET /api/topic-summary/logs?specKey=&topicKey=&limit=&before= — teacher/admin + student (when AI tutor enabled). List recent logs (teacher: own; admin: all; student: own, studentSafe). PR-027.
- GET /api/topic-summary/logs/:id — teacher/admin + student (when AI tutor enabled). Get full log for re-opening modal. PR-027.
- POST /api/topic-summary/to-lesson { topicSummaryLogId, lessonTitle?, strategy?, includeCheckpoint? } — teacher/admin only. Converts TopicSummaryLog to draft Lesson (3 pages, no AI). Rate limit 3/min teacher, 10/min admin. PR-029.

## External Sources API (PR-022)

- GET /api/external-sources/policies?status=&kind=&q= — teacher/admin, list policies
- POST /api/external-sources/policies { kind, value, status, reason? } — upsert
- DELETE /api/external-sources/policies/:id — remove policy
- GET /api/external-sources/recent?specKey=&topicKey=&limit= — recent external sources from EnquiryLog
- POST /api/external-sources/promote { enquiryLogId, url?, title?, snippet?, specKey, topicKey, noteTitle?, noteText? } — promote to teacherNote

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
