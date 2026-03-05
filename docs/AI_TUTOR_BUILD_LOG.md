# AI Tutor Build Log

**Purpose:**
This file records every development change related to the AI Tutor and platform architecture.

**Rule:**
Every change to the system must add a new PR entry here.

**Format:**

```
PR-XXX — Title

Date:
Summary:
Files changed:
Notes:
Follow-ups:
```

---

## Initial entry

**PR-000 — Establish project memory and logging**

Date: 2025-03-04

Summary:
Created architecture memory documentation and established development logging procedure.

Files changed:

- docs/AI_ARCHITECTURE_MEMORY.md
- docs/CHATGPT_BOOT_PROMPT.md
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
This documentation prevents loss of development context between ChatGPT sessions.

Follow-ups:
Begin AI Tutor implementation sequence.

---

**PR-001 — SpecStatement model**

Date: 2025-03-04

Summary:
Introduced SpecStatement model representing exam-board specification requirements.
This forms the foundation of the AI Tutor knowledge layer.

Files changed:

- backend/models/SpecStatement.js
- backend/routes/specStatements.routes.js
- backend/controllers/specStatements.controller.js
- backend/scripts/seedSpecStatements.js
- docs/specStatements.example.json
- backend/models/index.js
- backend/app.js

Notes:
SpecStatements will later be indexed as KnowledgeDocuments for retrieval.

Follow-ups:
PR-002 — KnowledgeDocument abstraction and embedding pipeline

---

**PR-002 — KnowledgeDocument abstraction + index builder**

Date: 2025-03-04

Summary:
Added KnowledgeDocument model and scripts to normalize SpecStatements and Lesson content into retrievable chunks.
Added admin debug API for verifying indexing.

Files changed:

- backend/models/KnowledgeDocument.js
- backend/models/index.js
- backend/services/knowledge/chunkText.js
- backend/services/knowledge/indexers/specStatementIndexer.js
- backend/services/knowledge/indexers/lessonBlockIndexer.js
- backend/scripts/buildKnowledgeIndex.js
- backend/routes/knowledgeDocuments.js
- backend/app.js
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
Indexing without embeddings first. Corpus and citations can be verified before PR-003 vector infrastructure.

Follow-ups:
PR-003 — Embeddings + vector search

---

**PR-003 — Embeddings + Vector Search (pgvector)**

Date: 2025-03-04

Summary:
Added pgvector (Postgres) as vector store for KnowledgeDocument embeddings.
Embeddings provider abstraction (mock/openai), embedding build script, and semantic search endpoint.

Files changed:

- backend/config/vectorDb.js
- backend/migrations/vector/001_pgvector.sql
- backend/scripts/runVectorMigrations.js
- backend/services/vector/pgvectorClient.js
- backend/services/embeddings/provider.js
- backend/scripts/embedKnowledgeDocuments.js
- backend/routes/knowledgeDocuments.js (added /search)
- backend/app.js
- backend/package.json (pg)
- backend/.env.example
- backend/README.md
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Dimension: 1536. HNSW index for cosine similarity.
- Mock provider for dev; OpenAI for production.
- Search: teacher + admin only.

Usage:
- node backend/scripts/runVectorMigrations.js
- node backend/scripts/embedKnowledgeDocuments.js --specKey AQA_GCSE_BIOLOGY (dry run)
- node backend/scripts/embedKnowledgeDocuments.js --apply --specKey AQA_GCSE_BIOLOGY
- GET /api/knowledge/search?q=...&specKey=...

Follow-ups:
PR-004 — Enquiry API (RAG answer + citations + practice)

---

**PR-004 — Enquiry API (RAG answer + citations + practice)**

Date: 2025-03-04

Summary:
Added /api/enquiry endpoint that retrieves KnowledgeDocuments, generates structured answers with verified citations, logs enquiries. Teacher + admin only.

Files changed:

- backend/models/EnquiryLog.js
- backend/models/index.js
- backend/services/knowledge/knowledgeSearchService.js (extracted from routes)
- backend/services/llm/provider.js
- backend/controllers/enquiry.controller.js
- backend/routes/enquiry.routes.js
- backend/routes/knowledgeDocuments.js (use service)
- backend/scripts/runEnquirySmokeTest.js
- backend/app.js
- backend/.env.example
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Citation verification drops hallucinated citations.
- Weak evidence (no results or top score < 0.35) triggers warning.
- Knowledge search gracefully degrades when VECTOR_DB_URL missing.

Follow-ups:
PR-005 — Evaluation harness OR "Ask AI" UI (teacher-only)

---

**PR-005 — Teacher-only Ask AI panel (LessonViewPage)**

Date: 2025-03-04

Summary:
Added teacher-only UI to query /api/enquiry and render answers with citations + practice. Panel appears above "Check your understanding" in lesson view.

Files changed:

- frontend/src/api/enquiry.ts
- frontend/src/components/ai/AskAiPanel.tsx
- frontend/src/pages/LessonViewPage.tsx
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Teachers and admins only; students do not see the panel.
- Citations show "Open source" link for lessonBlock (opens lesson in new tab).
- SpecStatement citations show "Spec" badge without link (no admin page yet).

Follow-ups:
- PR-006: Citation deep linking (scroll to block) + caching/rate limits
- PR-007: Student rollout (feature flag) once quality proven

---

**PR-006 — Trust & Operability: citation deep-links, caching, rate limits, feedback**

Date: 2025-03-04

Summary:
Improved AI tutor trust and production safety with: (A) citation deep-linking to exact lesson page/block, (B) enquiry caching to avoid repeated LLM calls, (C) rate limiting on /api/enquiry, (D) feedback capture (thumbs up/down + optional comment).

Files changed:

- backend/services/knowledge/indexers/lessonBlockIndexer.js (blockIndex in metadata)
- backend/controllers/enquiry.controller.js (deepLink in citations, cache check/store, enquiryLogId, handleEnquiryFeedback)
- backend/models/EnquiryLog.js (cached, feedback fields)
- backend/models/EnquiryCache.js (new)
- backend/models/index.js (EnquiryCache)
- backend/services/enquiry/enquiryCache.js (new)
- backend/middleware/enquiryRateLimit.js (new)
- backend/routes/enquiry.routes.js (rate limit, POST /:id/feedback)
- frontend/src/api/enquiry.ts (deepLink type, enquiryLogId, cached, postEnquiryFeedback)
- frontend/src/components/ai/AskAiPanel.tsx (deep link URLs, feedback UI, cached indicator)
- frontend/src/pages/LessonViewPage.tsx (block ids, ?page= numeric, scroll to #block-N)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Citation deep links: /lesson/:id?page=N#block-M (from KnowledgeDocument metadata).
- Cache key: sha256(specKey|topicKey|mode|normalizedQuestion). TTL 24h.
- Rate limit: 10/min teacher, 30/min admin. In-memory (resets on restart).
- Feedback stored in EnquiryLog.feedback; POST /api/enquiry/:id/feedback.

Follow-ups:
PR-006.1 — Fix blockIndex (accurate per chunk)
PR-007 — Student rollout behind feature flag

---

**PR-006.1 — Correct blockIndex per chunk (citation deep-link accuracy)**

Date: 2025-03-04

Summary:
Fixed lessonBlockIndexer to compute accurate blockIndexStart/blockIndexEnd per chunk instead of hardcoding blockIndex: 0. Uses [[BLOCK:n]] markers in page text during chunking, then extracts block range for each chunk. Enquiry deepLink uses blockIndexStart for scroll target.

Files changed:

- backend/services/knowledge/indexers/lessonBlockIndexer.js (blockTextUnits, markers, stripBlockMarkers)
- backend/controllers/enquiry.controller.js (deepLink uses blockIndexStart)
- backend/scripts/buildKnowledgeIndex.js (report includes blockIndexStart/End)
- frontend/src/pages/LessonViewPage.tsx (block id uses original block index from blocks array)
- docs/AI_TUTOR_BUILD_LOG.md

Notes:
- PR-006.1 blockIndex: After merging, re-run index + embed to refresh KnowledgeDocuments:
  - node backend/scripts/buildKnowledgeIndex.js --apply --source lessonBlock --specKey AQA_GCSE_BIOLOGY
  - node backend/scripts/embedKnowledgeDocuments.js --apply --source lessonBlock --specKey aqa-gcse-biology
  - (specKey in embed matches KnowledgeDocument.specKey, which comes from topicKey e.g. aqa-gcse-biology)

Follow-ups:
PR-007 — Student rollout behind feature flag (implemented below)

---

**PR-007 — Student rollout (feature-flagged, student-safe mode)**

Date: 2025-03-04

Summary:
Exposed "Ask AI" to students behind feature flag AI_TUTOR_ENABLED_SPECS. Student-safe UX: practice-first, explanation/citations collapsed by default, no admin links. Stricter rate limit (5/min), student-mode LLM constraints, suggestedTopics on weak evidence.

Files changed:

- backend/config/featureFlags.js (new)
- backend/routes/featureFlags.js (new) — GET /api/feature-flags/ai-tutor?specKey=...
- backend/routes/enquiry.routes.js (students allowed when flag enabled)
- backend/middleware/enquiryRateLimit.js (5/min students)
- backend/controllers/enquiry.controller.js (student-safe mode, suggestedTopics)
- backend/services/llm/provider.js (studentMode constraints)
- backend/.env.example (AI_TUTOR_ENABLED_SPECS)
- frontend/src/api/featureFlags.ts (new)
- frontend/src/api/enquiry.ts (suggestedTopics type)
- frontend/src/components/ai/AskAiStudentPanel.tsx (new)
- frontend/src/pages/LessonViewPage.tsx (student panel when enabled)
- backend/app.js (feature-flags route)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- AI_TUTOR_ENABLED_SPECS: comma-separated specKeys (e.g. aqa-gcse-biology). Empty = disabled.
- Teachers/admins bypass flag. Students 5/min, teachers 10/min, admins 30/min.
- Student UI: "Ask for help on this topic", practice first, "Show explanation" / "Where this came from" collapsed.

Follow-ups:
PR-009 — Quality flywheel (evaluation harness, coverage dashboard)

---

**PR-008 — Local pgvector dev environment + embedding diagnostics**

Date: 2025-03-04

Summary:
Added deterministic local pgvector setup via Docker, npm scripts, and improved error messages for embedding scripts. "Local DB auth" no longer blocks development.

Files changed:

- docker-compose.vector.yml (pgvector/pgvector:pg16, port 5433)
- backend/package.json (vector:up, vector:down, vector:logs, vector:migrate, vector:reset)
- backend/.env.example (VECTOR_DB_URL default for local Docker)
- backend/README.md (full 5-step local workflow)
- backend/services/vector/pgvectorClient.js (testConnection, formatConnectionError for auth/ECONNREFUSED/extension/pg_hba)
- backend/scripts/embedKnowledgeDocuments.js (early connection test when --apply, actionable hint on failure)
- backend/scripts/runVectorMigrations.js (formatted errors, exit 1)
- docs/AI_TUTOR_BUILD_LOG.md

Notes:
- vector:reset is destructive (removes volume).
- On a fresh machine: npm run vector:up, npm run vector:migrate, then embed --apply works with localhost:5433.

Follow-ups:
None

---

**PR-009 — Coverage engine (reports + API)**

Date: 2026-03-05

Summary:
Added coverage computation for spec/topic across SpecStatements, KnowledgeDocuments, and EnquiryLog weak evidence. Coverage metrics: specStatementsTotal, knowledgeDocsSpec, knowledgeDocsLesson, retrieval readiness score (0–100), status (NO_SPEC, EMPTY, THIN, OK, STRONG), weak-evidence enquiry counts and top questions. Script generates markdown report; coverage APIs for teacher/admin.

Files changed:

- backend/models/CoverageSnapshot.js (new)
- backend/services/coverage/coverageEngine.js (new)
- backend/scripts/buildCoverageReport.js (new)
- backend/controllers/coverage.controller.js (new)
- backend/routes/coverage.routes.js (new)
- backend/app.js
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Coverage is computed per (specKey, topicKey). Score = 50*specIndexedRatio + 25*lessonPresence + 25*lessonDensity.
- Weak evidence: EnquiryLog.response.warnings contains "Insufficient trusted sources".
- TTL 90 days on CoverageSnapshot.

Usage:
- node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology
- node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology --apply
- GET /api/coverage?specKey=aqa-gcse-biology&windowDays=14
- GET /api/coverage/snapshots?specKey=aqa-gcse-biology&latest=true
- GET /api/coverage/topics?specKey=aqa-gcse-biology&status=THIN

Follow-ups:
- PR-010: UI dashboard (teacher/admin) showing coverage + hotspots (implemented below)
- PR-011: Auto-create Jira-style sprint order from THIN/EMPTY topics (optional)

---

**PR-010 — Coverage Dashboard UI (teacher/admin)**

Date: 2026-03-05

Summary:
Added Coverage Dashboard page at /coverage for teachers and admins. Shows coverage status per topicKey (NO_SPEC, EMPTY, THIN, OK, STRONG), weak-evidence hotspots, top failing questions. Snapshot vs live toggle, status filters, search. Nav links in Teacher Dashboard and Admin Dashboard.

Files changed:

- frontend/src/api/coverage.ts (new)
- frontend/src/pages/CoverageDashboardPage.tsx (new)
- frontend/src/App.tsx (route /coverage)
- frontend/src/pages/TeacherDashboard.tsx (AI Coverage link)
- frontend/src/pages/AdminDashboardPage.tsx (AI Coverage link)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Uses existing /api/coverage, /api/coverage/snapshots, /api/coverage/topics endpoints.
- Default: latest snapshot. "Refresh (live)" for on-demand compute.
- Students cannot access (ProtectedRoute requireTeacherOrAdmin).

Follow-ups:
- PR-011: Auto Sprint Order from Coverage (implemented below)

---

**PR-011 — Sprint order generator from coverage**

Date: 2026-03-05

Summary:
Added script to generate sprint order markdown per specKey using CoverageSnapshot + weak-evidence. Combines coverage status (NO_SPEC, EMPTY, THIN, OK, STRONG) with enquiry weak-evidence hotspots to produce prioritized sprint table. Includes npm scripts and safety confirmation for --apply (requires typing "APPLY &lt;SPEC_KEY&gt;" before writing snapshots).

Files changed:

- backend/scripts/buildSprintOrderFromCoverage.js (new)
- backend/scripts/runBuildSprintOrderFromCoverage.js (new)
- backend/package.json (maintenance:sprint-order scripts)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Output: reports/SPRINT_ORDER_&lt;SPEC&gt;_YYYY-MM-DD_HHMM.md
- Labels: P0_NO_SPEC, P0_EMPTY, P1_THIN, P2_OK_HIGH_WEAK, P3_STRONG
- Question bank audit: not generated by this script (run existing audit tooling)

Usage (from backend/):
- node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology
- node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology --apply
- npm run maintenance:sprint-order --specKey=aqa-gcse-biology
- npm run maintenance:sprint-order:apply --specKey=aqa-gcse-biology

Windows PowerShell (from project root): use ; instead of && to chain commands.

Follow-ups:
- PR-012: Integrate sprint output into teacher/admin UI (implemented below)

---

**PR-012 — Coverage Dashboard: sprint order download**

Date: 2026-03-05

Summary:
Added "Generate sprint order" button on /coverage that downloads the same markdown as PR-011. Refactored PR-011 logic into sprintOrderService so script and API share identical output. API is rate-limited (10/min teacher, 30/min admin), never writes snapshots. Optional admin-only POST /api/sprint-order/snapshots/ensure for ensuring snapshots with confirmation.

Files changed:

- backend/services/sprintOrder/sprintOrderService.js (new)
- backend/scripts/buildSprintOrderFromCoverage.js (refactored to use service)
- backend/controllers/sprintOrder.controller.js (new)
- backend/routes/sprintOrder.routes.js (new)
- backend/middleware/sprintOrderRateLimit.js (new)
- backend/app.js
- frontend/src/api/sprintOrder.ts (new)
- frontend/src/pages/CoverageDashboardPage.tsx
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Script still exists and delegates to sprintOrderService; output format identical.
- GET /api/sprint-order returns markdown with Content-Disposition attachment.
- X-SprintOrder-Source header indicates SNAPSHOT or LIVE.
- POST /api/sprint-order/snapshots/ensure requires X-Confirm: "APPLY &lt;SPEC_DISPLAY&gt;".

Follow-ups:
None

---

**PR-013 — Coverage drill-down panel**

Date: 2026-03-05

Summary:
Added drill-down panel when clicking a topic row on /coverage. Shows missing spec statements, lessons contributing knowledge docs, weak student questions, and quick actions (create lesson, question bank, flashcard bank). Backend endpoint GET /api/coverage/drilldown.

Files changed:

- backend/controllers/coverageDrilldown.controller.js (new)
- backend/routes/coverageDrilldown.routes.js (new)
- backend/routes/coverage.routes.js
- frontend/src/api/coverageDrilldown.ts (new)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (new)
- frontend/src/pages/CoverageDashboardPage.tsx
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Teacher/admin only.
- Missing spec = SpecStatements without matching KnowledgeDocument (metadata.statementCode).
- Lessons = KD with sourceType=lessonBlock grouped by lessonId.
- Weak questions = EnquiryLog with "Insufficient trusted sources" in response.warnings.

Follow-ups:
None

---

**PR-014 — Content Starter Pack generator**

Date: 2026-03-05

Summary:
One-click generator for THIN/EMPTY topics: creates draft lesson outline, flashcards, quiz questions, and exam questions from spec statements. Uses only trusted internal sources (SpecStatements, KnowledgeDocuments). All output is DRAFT; nothing auto-published. Teacher/admin only, rate limited (3/min teacher, 10/min admin).

Files changed:

- backend/models/ContentGenerationJob.js (new)
- backend/services/generation/starterPackService.js (new)
- backend/services/llm/provider.js (generateStarterPack added)
- backend/controllers/contentGeneration.controller.js (new)
- backend/routes/contentGeneration.routes.js (new)
- backend/middleware/contentGenerationRateLimit.js (new)
- backend/app.js
- frontend/src/api/generation.ts (new)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- POST /api/generate/starter-pack { specKey, topicKey, statementCodes?, tier? }
- GET /api/generate/jobs?specKey=...&topicKey=...&limit=20 — audit recent jobs
- If statementCodes empty, uses top 3 missing statements from drilldown
- Deterministic seed per run; no overwrite of existing drafts
- Outputs: lesson (draft), TopicFlashcard (draft), TopicQuizQuestion (draft), ExamQuestion (draft)

Follow-ups:
PR-014.1 — Review & Publish checklist

---

**PR-014.1 — Human-in-the-loop Review & Publish checklist**

Date: 2026-03-05

Summary:
Before AI-generated draft content can be published, a structured publish gate validates content quality (MCQ options, correct answer, empty fields, mark scheme). Blocks publish until fixed. Deep-links teacher to editor sections. Applies to content with metadata.generatedFrom.jobId. Non-generated content unchanged.

Files changed:

- backend/services/publishGate/validatePublishableContent.js (new)
- backend/controllers/publishGate.controller.js (new)
- backend/routes/publishGate.routes.js (new)
- backend/models/ContentGenerationJob.js (publishedAt, publishedBy)
- backend/models/Lesson.js (metadata)
- backend/models/TopicFlashcard.js (metadata)
- backend/models/TopicQuizQuestion.js (metadata)
- backend/models/ExamQuestion.js (metadata)
- backend/controllers/contentGeneration.controller.js (metadata.generatedFrom on created items)
- backend/app.js
- frontend/src/api/generation.ts (getPublishGateCheck, postPublishGatePublish)
- frontend/src/components/generation/ReviewPublishChecklist.tsx (new)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (ReviewPublishChecklist in success panel)
- frontend/src/pages/EditLessonPage.tsx (intercept publish for generated lessons)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- GET /api/publish-gate/check?scope=starterPack&jobId=...
- POST /api/publish-gate/publish { scope, jobId }
- Lesson/quiz/flashcard/exam publish rules: block on empty fields, invalid MCQ, missing mark scheme
- EditLessonPage: when lesson.metadata.generatedFrom.jobId exists, run gate check before publish

Follow-ups:
None

---

**PR-014.1a — Publish Check API + UI Checklist (no auto-publish)**

Date: 2026-03-05

Summary:
Review checklist for generated drafts: backend check + UI. Check only — no publishing. validateStarterPackPublishability({ jobId, user }) with ownership (teachers own job, admins any). Rate limit 10/min teacher, 30/min admin. Fix links open in new tab. Sections by type: Lesson / Flashcards / Quiz / Exam.

Files changed:

- backend/services/publishGate/validatePublishableContent.js (validateStarterPackPublishability, fixLink)
- backend/controllers/publishGate.controller.js (ownership, jobId-only check)
- backend/middleware/publishGateRateLimit.js (new)
- backend/routes/publishGate.routes.js (rate limit)
- frontend/src/components/generation/ReviewPublishChecklist.tsx (no Publish button, fixLink new tab, sections by type)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx
- frontend/src/api/generation.ts (fixLink, jobId required)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- GET /api/publish-gate/check?jobId=...
- No publishing in this PR; checklist guides fixes only

Follow-ups:
PR-014.1b — Publish all + hard gates

---

**PR-014.1b — Publish endpoint + hard gates for AI-generated drafts**

Date: 2026-03-05

Summary:
Added "Publish all" workflow for starter-pack outputs when checklist has zero BLOCK issues. Hard publish gating: generated content (metadata.generatedFrom.jobId) cannot be published via existing publish buttons without passing the gate. Non-generated content unchanged.

Files changed:

- backend/controllers/publishGate.controller.js (POST /publish-gate/publish, jobId only)
- backend/middleware/requirePublishGateIfGenerated.js (checkPublishGateForGenerated)
- backend/routes/topicFlashcards.js (gate on POST /:id/publish)
- backend/routes/topicQuizQuestions.js (gate on POST /:id/publish)
- backend/routes/lessons.js (gate in publishToggleHandler)
- backend/routes/admin.js (gate when setting isPublished via PUT admin/lessons)
- backend/routes/examQuestions.js (gate when status=published)
- frontend/src/api/generation.ts (postPublishGatePublish { jobId })
- frontend/src/components/generation/ReviewPublishChecklist.tsx (Publish all button, success links)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- POST /api/publish-gate/publish { jobId } — teacher/admin, returns 400 if blocks > 0
- Idempotent: already published returns ok with counts
- requirePublishGateIfGenerated: checks metadata.generatedFrom.jobId, runs validation
- "View lesson as student" and "Back to coverage" links on success

Follow-ups:
None

---

**PR-015 — Automatic publish → reindex → embed → coverage refresh pipeline**

Date: 2026-03-05

Summary:
When content is published (lesson or bank items), a background job is enqueued to refresh the knowledge index, embeddings, and coverage snapshots. Async, non-blocking. Safe when vector DB is down (index + coverage complete; embeddings skipped with log). Idempotent, deduplicated by specKey+topicKey.

Files changed:

- backend/models/BackgroundJob.js (new)
- backend/services/jobs/enqueueKnowledgeRefresh.js (new)
- backend/services/knowledge/rebuildKnowledgeIndex.js (new)
- backend/services/knowledge/embedChangedDocuments.js (new)
- backend/services/coverage/refreshCoverageSnapshot.js (new)
- backend/workers/knowledgeRefreshWorker.js (new)
- backend/services/knowledge/indexers/specStatementIndexer.js (topicKey filter)
- backend/services/knowledge/indexers/lessonBlockIndexer.js (topicKey filter)
- backend/controllers/publishGate.controller.js (enqueue on publish)
- backend/routes/lessons.js (enqueue on lesson publish)
- backend/routes/admin.js (enqueue on admin lesson publish, GET/POST jobs)
- backend/routes/topicFlashcards.js (enqueue on publish)
- backend/routes/topicQuizQuestions.js (enqueue on publish)
- backend/routes/examQuestions.js (enqueue on publish)
- backend/package.json (worker:knowledge-refresh)
- backend/README.md (worker docs)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- BackgroundJob: type=KNOWLEDGE_REFRESH, status queued|running|completed|failed, TTL 30d
- Worker polls every 5s, runs index → embed → coverage; retries up to 3 on failure
- GET /api/admin/jobs?type=KNOWLEDGE_REFRESH&status=queued — admin
- POST /api/admin/jobs/enqueue-knowledge-refresh { specKey, topicKey? } — admin
- npm run worker:knowledge-refresh

Follow-ups:
None

---

**PR-016a — Suggested learning actions (Next steps)**

Date: 2026-03-05

Summary:
After every /api/enquiry response, return suggestedActions: practice (scroll), view lesson, flashcards, quiz, coverage (teacher/admin when weak evidence). Deterministic, no extra LLM calls. Students see only student-safe actions. "Next steps" section added to AskAiPanel and AskAiStudentPanel.

Files changed:

- backend/services/enquiry/suggestedActions.js (new)
- backend/controllers/enquiry.controller.js (buildSuggestedActions, add to response)
- frontend/src/api/enquiry.ts (SuggestedAction type)
- frontend/src/components/ai/AskAiPanel.tsx (Next steps section)
- frontend/src/components/ai/AskAiStudentPanel.tsx (Next steps section)
- frontend/src/pages/CoverageDashboardPage.tsx (?focusTopicKey opens drawer)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- suggestedActions: max 5, priority practice/lesson/flashcards/quiz/coverage
- Teachers: /teacher/topic-banks/flashcards, /teacher/topic-banks/quizzes, /coverage?focusTopicKey=
- Students: /lessons/:id/flashcards, /lesson/:id#check-understanding
- No conversation persistence

Follow-ups:
PR-017 (confidence indicators), PR-018 (citation UI)

---

**PR-017 — Confidence indicators**

Date: 2026-03-05

Summary:
Expose answer confidence (strong/moderate/weak) from existing weak-evidence and retrieval signals. Backend computes deterministically. Teachers see badge + reason + source counts; students see badge only (High/Medium/Low). When weak, students see "Your course content may not cover this fully yet."

Files changed:

- backend/services/enquiry/confidence.js (new)
- backend/controllers/enquiry.controller.js (computeConfidence, add to cached + fresh responses)
- frontend/src/api/enquiry.ts (ConfidenceSignals, confidenceLevel, confidenceReason, confidenceSignals)
- frontend/src/components/ai/AskAiPanel.tsx (Confidence badge + reason + Sources)
- frontend/src/components/ai/AskAiStudentPanel.tsx (Confidence badge, weak note)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- weak: "Insufficient trusted sources" OR usedSources.length=0 OR topScore<0.35
- strong: topScore>=0.60 AND spec>=1 AND lesson>=1 AND no weak warning
- moderate: otherwise. Works when vector DB down (topScore null).

Follow-ups:
PR-018 (citation UI)

---

**PR-018 — Citation UI improvements**

Date: 2026-03-05

Summary:
Numbered citations [1],[2],[3] with SPEC/LESSON/EXTERNAL badges, source quality line ("Sources used: Spec ✓ (2), Lesson ✓ (1)"), deep links preserved. Shared CitationsList component. Teacher: quotes expanded by default; Student: collapsed by default with "Show evidence" button.

Files changed:

- frontend/src/components/ai/citationLinks.ts (new — buildCitationLink)
- frontend/src/components/ai/CitationsList.tsx (new)
- frontend/src/components/ai/AskAiPanel.tsx (use CitationsList)
- frontend/src/components/ai/AskAiStudentPanel.tsx (use CitationsList)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- No backend changes. Citation verification unchanged.
- Student mode: lesson links only when in same lesson context.

Follow-ups:
None

---

**PR-019 — Threaded tutoring conversations**

Date: 2026-03-05

Summary:
Turn Ask AI from single-shot Q&A into a tutoring chat. Users can ask follow-ups ("Explain simpler", "Give me another example") in the same thread. Conversation + ConversationMessage models store minimal context (last 3 user+assistant pairs) for LLM coherence. Enquiry API accepts conversationId; cache keys include conversationId. AskAiPanel and AskAiStudentPanel render chat UI with message bubbles; conversationId persisted in sessionStorage for refresh. All existing features preserved: citations, confidence, suggested actions, feedback, caching, rate limits, student gating.

Files changed:

- backend/models/Conversation.js (new)
- backend/models/ConversationMessage.js (new)
- backend/models/EnquiryLog.js (conversationId, turnIndex)
- backend/controllers/conversations.controller.js (new)
- backend/routes/conversations.routes.js (new)
- backend/controllers/enquiry.controller.js (conversationId, context load, append messages)
- backend/services/enquiry/enquiryCache.js (conversationId in cache key)
- backend/services/llm/provider.js (conversationContext param)
- backend/app.js (mount /api/conversations)
- frontend/src/api/conversations.ts (new)
- frontend/src/api/enquiry.ts (conversationId in PostEnquiryParams)
- frontend/src/components/ai/AskAiPanel.tsx (chat UI, messages, sessionStorage)
- frontend/src/components/ai/AskAiStudentPanel.tsx (chat UI, messages, sessionStorage)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Minimal context: last 6 messages (3 pairs) passed to LLM as conversationContext.
- Cache keys: specKey|topicKey|mode|question|conversationId — no cross-conversation leakage.
- Fallback: if conversation creation fails, single-turn enquiry still works.
- Students remain gated by AI_TUTOR_ENABLED_SPECS and rate limits.

Follow-ups:
None

---

**PR-020 — AI Tutor response modes (quick/explain/exam/revision)**

Date: 2026-03-05

Summary:
Perplexity-style response modes that change answer shape/tone while staying curriculum-grounded. quick: 3–5 bullets + 1 practice; explain: fuller explanation + 2 practice; exam: examiner style + 1 exam Q + mark scheme; revision: revision sheet + 3 flashcard prompts. Mode switch UI in both panels (teacher: Quick|Explain|Exam|Revision; student: Quick|Explain|Revision). New practice type "flashcard" with front/back rendered as "Show back" toggle. Mode included in cache key. EnquiryLog.responseMode persisted.

Files changed:

- backend/controllers/enquiry.controller.js (responseMode param, default explain)
- backend/services/enquiry/enquiryCache.js (responseMode in cache key)
- backend/models/EnquiryLog.js (responseMode, practice type flashcard)
- backend/services/llm/provider.js (mode-specific prompts, flashcard output)
- frontend/src/api/enquiry.ts (responseMode, EnquiryPracticeItem flashcard)
- frontend/src/components/ai/AskAiPanel.tsx (mode switch, flashcard render)
- frontend/src/components/ai/AskAiStudentPanel.tsx (mode switch Quick/Explain/Revision, flashcard render)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Default mode: explain for both roles. Students: Exam hidden from UI.
- Citations, confidence, suggested actions, caching unchanged.
- Student length caps respected.

Follow-ups:
None
