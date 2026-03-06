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

---

**PR-021 — Controlled external search fallback (teacher/admin first, safe + off-by-default)**

Date: 2026-03-05

Summary:
When enquiry confidence is weak, allow optional fallback to fetch external references from an allowlist (aqa.org.uk, ocr.org.uk, qualifications.pearson.com). External results are labeled EXTERNAL (exploratory), never mixed invisibly with curriculum, cited with URL + snippet, stored as KnowledgeDocuments sourceType=externalTrusted. Feature-flagged AI_TUTOR_EXTERNAL_SEARCH_ENABLED (default false). Teacher/admin only; students cannot trigger. Rate limit for external: 3/min teachers, 10/min admins. Mock + Brave Search providers.

Files changed:

- backend/config/externalSearch.js (feature flag, domains, max results/snippet)
- backend/.env.example (AI_TUTOR_EXTERNAL_SEARCH_*)
- backend/services/externalSearch/provider.js (mock, brave)
- backend/models/KnowledgeDocument.js (externalTrusted sourceType, sourceId Mixed)
- backend/services/knowledge/indexers/externalTrustedIndexer.js (index + embed)
- backend/services/knowledge/knowledgeSearchService.js (externalTrusted filter)
- backend/controllers/enquiry.controller.js (allowExternal, external flow)
- backend/services/enquiry/enquiryCache.js (allowExternal in cache key)
- backend/services/enquiry/confidence.js (external-only → weak, sources.external)
- backend/middleware/externalSearchRateLimit.js (3/min teacher, 10/min admin)
- backend/routes/enquiry.routes.js (externalSearchRateLimit middleware)
- frontend/src/api/enquiry.ts (allowExternal, externalUsed, externalSources, externalUrl)
- frontend/src/components/ai/AskAiPanel.tsx (checkbox, callout, externalSources list)
- frontend/src/components/ai/citationLinks.ts (externalUrl for externalTrusted)
- frontend/src/components/ai/CitationsList.tsx (anchor for external URLs)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Off by default. Weak confidence only. allowExternal in cache key.
- Never remove "Insufficient trusted sources" when external used.
- No scraping; snippets only. EXTERNAL_SEARCH_PROVIDER=brave|mock.

Follow-ups:
None

---

**PR-022 — External sources moderation + promotion (trust layer)**

Date: 2026-03-05

Summary:
Teacher/admin moderation workflow for externalTrusted sources: review recent sources, deny URL/domain, promote snippet to teacherNote KnowledgeDocument. ExternalSourcePolicy model (kind: url|domain, status: allowed|denied). filterDenied before indexing; retrieval filters denied externalTrusted. teacherNote sourceType with +0.02 boost. EnquiryLog stores externalUsed/externalSources. Promote triggers enqueueKnowledgeRefresh. ExternalSourcesPage at /external-sources (tabs: Recent, Denylist; promote modal).

Files changed:

- backend/models/ExternalSourcePolicy.js
- backend/models/ExternalSourceReview.js
- backend/models/KnowledgeDocument.js (teacherNote)
- backend/models/EnquiryLog.js (externalUsed, externalSources)
- backend/services/externalSearch/policyService.js
- backend/controllers/enquiry.controller.js (filterDenied, isDenied, allowExternal block)
- backend/controllers/externalSources.controller.js
- backend/routes/externalSources.routes.js
- backend/services/knowledge/knowledgeSearchService.js (teacherNote)
- backend/services/enquiry/confidence.js (teacherNote)
- frontend/src/api/externalSources.ts
- frontend/src/pages/ExternalSourcesPage.tsx
- frontend/src/api/enquiry.ts (teacherNote citation)
- frontend/src/components/ai/CitationsList.tsx (NOTE badge)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Students unaffected. Denied sources never indexed or returned.
- teacherNote contributes moderate confidence.

Follow-ups:
None

---

**PR-023 — Teacher notes surfaced in Coverage drilldown + Ask AI (adoption booster)**

Date: 2026-03-05

Summary:
Surface promoted teacherNotes in CoverageTopicDrawer (drilldown) and AskAiPanel citations. Teachers see curated notes in the topic drawer and know when Ask AI used them. New GET /api/teacher-notes (teacher/admin) endpoint. Coverage drawer shows Teacher notes (curated) section with cards (title, domain, snippet, updatedAt). ExternalSourcesPage supports ?specKey=&topicKey= deep links. CitationsList shows "Includes teacher-curated notes." with link to coverage when teacherNote sources used (teacher/admin only).

Files changed:

- backend/controllers/teacherNotes.controller.js
- backend/routes/teacherNotes.routes.js
- backend/app.js (mount /api/teacher-notes)
- frontend/src/api/teacherNotes.ts
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Teacher notes section)
- frontend/src/pages/ExternalSourcesPage.tsx (specKey, topicKey query params)
- frontend/src/components/ai/CitationsList.tsx (helper line + specKey/topicKey props)
- frontend/src/components/ai/AskAiPanel.tsx (pass specKey, topicKey to CitationsList)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- No changes to external search logic. Teacher notes remain teacher/admin only.
- Minimal: read + link + small preview. Reuses existing APIs; one new endpoint.

Follow-ups:
PR-024 — Topic summaries (Perplexity-style)

---

**PR-024 — Topic summaries (Perplexity-style, curriculum-first)**

Date: 2026-03-05

Summary:
Topic-level summarisation across specStatement, lessonBlock, teacherNote, and optionally externalTrusted (when allowExternal + weak confidence). Four modes: overview, lessonPlan, revisionSheet, examFocus. Structured teaching artifact with verified citations, confidence indicators, coverage signals. Caching (TopicSummaryCache, 24h TTL) and rate limiting (6/min teachers, 20/min admins). Teacher/admin only; student version in PR-024.1.

Files changed:

- backend/models/TopicSummaryLog.js
- backend/models/TopicSummaryCache.js
- backend/utils/citationVerification.js (extracted from enquiry)
- backend/controllers/enquiry.controller.js (use shared verifyCitations)
- backend/services/topicSummary/topicSummaryRetrieval.js
- backend/services/topicSummary/topicSummaryCache.js
- backend/services/llm/provider.js (generateTopicSummary)
- backend/controllers/topicSummary.controller.js
- backend/routes/topicSummary.routes.js
- backend/middleware/topicSummaryRateLimit.js
- backend/app.js (mount /api/topic-summary)
- frontend/src/api/topicSummary.ts
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Teaching summary section + modal)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Reuses computeConfidence, verifyCitations, knowledgeSearchService.
- External only when allowExternal, teacher/admin, weak confidence, AI_TUTOR_EXTERNAL_SEARCH_ENABLED.
- Citation verification ensures quotes appear in source text.

Follow-ups:
PR-024.1 — Student topic summary (after UX and safety hardening)

---

**PR-024.1 — Student-safe topic summaries (feature-flagged per spec)**

Date: 2026-03-05

Summary:
Allow students to generate topic summaries when AI_TUTOR_ENABLED_SPECS includes the spec. Gated by isAiTutorEnabledForSpec (same as PR-007). Students: overview and revisionSheet modes only; allowExternal forced false; maxSources capped at 10; retrieval excludes teacherNote; LLM studentSafe prompts (shorter, GCSE-level); citations omit teacherNote; confidenceSignals omitted; rate limit 3/min. UI: "Summarise this topic" button near Ask AI on LessonViewPage; TopicSummaryStudentModal with Overview/Revision sheet modes.

Files changed:

- backend/controllers/topicSummary.controller.js (student gating, constraints, omit signals)
- backend/services/topicSummary/topicSummaryRetrieval.js (student: specStatement + lessonBlock only)
- backend/services/topicSummary/topicSummaryCache.js (studentSafe in cache key)
- backend/services/llm/provider.js (studentSafe prompts, shorter limits)
- backend/middleware/topicSummaryRateLimit.js (students 3/min)
- frontend/src/components/ai/TopicSummaryStudentModal.tsx
- frontend/src/pages/LessonViewPage.tsx (button + modal for students)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Teacher/admin behavior unchanged.
- Citations: lessonBlock deep-link via CitationsList studentMode; teacherNote omitted for students.

Follow-ups:
PR-025 — Export Topic Summary to PDF

---

**PR-025 — Export Topic Summary to PDF (teacher + student)**

Date: 2026-03-05

Summary:
Add "Download PDF" button to topic summary results. Backend POST /api/topic-summary/export generates a clean PDF via PDFKit. Accepts topicSummaryLogId (preferred) or full summary payload. Rate limited: students 2/min, teachers 6/min, admins 20/min. No LLM calls, no external fetch. TopicSummaryLog extended with keyPoints for PDF export.

Files changed:

- backend/package.json (pdfkit)
- backend/services/pdf/topicSummaryPdf.js
- backend/controllers/topicSummaryExport.controller.js
- backend/routes/topicSummaryExport.routes.js
- backend/middleware/topicSummaryExportRateLimit.js
- backend/models/TopicSummaryLog.js (keyPoints)
- backend/controllers/topicSummary.controller.js (persist keyPoints)
- backend/app.js (mount /api/topic-summary/export)
- frontend/src/api/topicSummaryExport.ts
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Download PDF button)
- frontend/src/components/ai/TopicSummaryStudentModal.tsx (Download PDF button)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- PDF includes title, subtitle, confidence, summary, key points, mode sections, citations.
- Teacher and student flows both supported.

PowerShell — **recommended: Invoke-RestMethod / Invoke-WebRequest** (avoids curl + JSON quoting issues):

```powershell
$jwt = "YOUR_JWT"
$body = '{"specKey":"aqa-gcse-biology","topicKey":"aqa-gcse-biology:cell-structure","mode":"overview","maxSources":10}'

$resp = Invoke-RestMethod -Uri "http://localhost:5000/api/topic-summary" -Method POST -Headers @{ Authorization = "Bearer $jwt" } -ContentType "application/json" -Body $body
$id = $resp.topicSummaryLogId

if ($id) {
  $exportBody = '{"topicSummaryLogId":"' + $id + '"}'
  Invoke-WebRequest -Uri "http://localhost:5000/api/topic-summary/export" -Method POST -Headers @{ Authorization = "Bearer $jwt" } -ContentType "application/json" -Body $exportBody -OutFile "topic-summary.pdf"
  Write-Host "Saved to topic-summary.pdf"
}
```

Follow-ups:
PR-026 — Topic Summary PDF v2 (handout layout, pagination, footer)

---

**PR-026 — Topic Summary PDF v2 (usable handout + robust layout)**

Date: 2026-03-05

Summary:
Refactored topic summary PDF export into a layout engine with proper text wrapping, headings, bullet lists, mode sections (overview/revision sheet/lesson plan/exam focus), numbered citations with source badges, automatic pagination, and footer "LetsRevise • specKey • topicKey • date • Page X". Empty content returns 400 with clear message (never a tiny/empty PDF). Frontend shows "Generating PDF…" → "Downloaded" or "No content to export yet" on 400.

Files changed:

- backend/services/pdf/topicSummaryPdf.js (layout engine, helpers, normalizeTopicSummaryExportPayload)
- backend/controllers/topicSummaryExport.controller.js (400 guards, filename LetsRevise_TopicSummary_*)
- frontend/src/api/topicSummaryExport.ts (parse 400 JSON from blob for toast message)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (toast UX)
- frontend/src/components/ai/TopicSummaryStudentModal.tsx (toast UX)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- PDF includes title, subtitle, confidence (teachers only; students omit reason), summary, key points, mode sections, citations with [1] SPEC, [2] LESSON, etc. External citations show shortened domain.
- If buffer < 5KB after render, logs warning (does not fail).
- Invalid topicSummaryLogId → 400 "Invalid topicSummaryLogId". Log with no exportable content → 400 "TopicSummaryLog has no exportable content".

PowerShell — generate summary then export:

```powershell
$jwt = "YOUR_JWT"
$body = '{"specKey":"aqa-gcse-biology","topicKey":"aqa-gcse-biology:cell-structure","mode":"overview","maxSources":10}'
$resp = Invoke-RestMethod -Uri "http://localhost:5000/api/topic-summary" -Method POST -Headers @{ Authorization = "Bearer $jwt" } -ContentType "application/json" -Body $body
$id = $resp.topicSummaryLogId
if ($id) {
  Invoke-WebRequest -Uri "http://localhost:5000/api/topic-summary/export" -Method POST -Headers @{ Authorization = "Bearer $jwt" } -ContentType "application/json" -Body ('{"topicSummaryLogId":"' + $id + '"}') -OutFile "topic-summary.pdf"
  Write-Host "Saved to topic-summary.pdf"
}
```

Known limitations:
- Some topics may produce small PDFs (< 5KB) if content is minimal; these are not rejected.

Follow-ups:
PR-026.1 — Richer PDF exports (evidence appendix, next steps, mini revision)

---

**PR-026.1 — Richer Topic Summary PDFs (target 10KB+)**

Date: 2026-03-05

Summary:
Extended PDF export with richer sections and export options. New sections: "At a glance" (mode, confidence, source counts), "Key points (expanded)" (up to 12/8 bullets, derived from sections), "Common mistakes & examiner tips", "Next steps" (3–5 items from suggestedActions or computed), "Evidence used" appendix (with evidenceQuoteChars), "Mini revision appendix" (4 flashcards + 1 MCQ, teacher/admin only). Export options: includeEvidenceAppendix (default true teachers, false students), includeNextSteps (default true), includeMiniRevisionAppendix (default false, teacher only), evidenceQuoteChars (180 teachers, 120 students). Replaced size warning with dev-only content diagnostics.

Files changed:

- backend/controllers/topicSummaryExport.controller.js (export options, validation, student caps)
- backend/services/pdf/topicSummaryPdf.js (normalize, at-a-glance, expanded key points, next steps, evidence appendix, mini revision)
- frontend/src/api/topicSummaryExport.ts (new params)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (toggles: evidence, next steps, mini revision)
- frontend/src/components/ai/TopicSummaryStudentModal.tsx (toggles: evidence OFF, next steps ON)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Students cannot enable mini revision appendix. evidenceQuoteChars capped at 120 for students.
- No artificial padding; richer content from real sections and citations.

Follow-ups:
PR-027 — Saved Topic Summaries (recent list + re-open + export)

---

**PR-027 — Saved Topic Summaries (recent list + re-open + export)**

Date: 2026-03-05

Summary:
Added GET /api/topic-summary/logs (list) and GET /api/topic-summary/logs/:id (get one) for saved topic summaries. Teachers see own logs; admins see all. Students see own logs only when AI tutor enabled for spec (studentSafe, allowExternal false). CoverageTopicDrawer shows "Recent summaries" with mode badge, date, confidence, Open and Download PDF actions. Load more pagination. TopicSummaryLog now persists confidenceLevel and confidenceReason.

Files changed:

- backend/models/TopicSummaryLog.js (response.confidenceLevel, response.confidenceReason)
- backend/controllers/topicSummary.controller.js (persist confidence when creating log)
- backend/controllers/topicSummaryLogs.controller.js (new)
- backend/routes/topicSummary.routes.js (GET /logs, GET /logs/:id)
- frontend/src/api/topicSummary.ts (getTopicSummaryLogs, getTopicSummaryLogById, types)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Recent summaries section)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- List query: specKey, topicKey (required), limit (default 10 max 50), before (ISO for pagination).
- Open loads full log and displays in existing summary modal without regenerating.

Follow-ups:
PR-028 — Wire Topic Summaries + Enquiries into Coverage metrics

---

**PR-028 — Wire Topic Summaries + Enquiries into Coverage metrics (usage-driven coverage)**

Date: 2026-03-05

Summary:
Coverage engine now aggregates TopicSummaryLog and EnquiryLog for usage-driven metrics. CoverageSnapshot schema extended with summariesTotal, weakSummariesTotal, summariesByMode, demandScore. Demand score (0–100) = enquiriesTotal + (summariesTotal × 2), normalized across topics. Sprint order script supports optional --weights demand=0.15; default demand weight 0 preserves existing ordering. Coverage dashboard: new columns (enquiries, weak enq, summaries, weak sum, demand bar), "High demand (≥60)" filter, "weak enquiries" label. CoverageTopicDrawer header badges show enq/sum counts.

Files changed:

- backend/models/CoverageSnapshot.js (summariesTotal, weakSummariesTotal, summariesByMode, demandScore)
- backend/services/coverage/coverageEngine.js (TopicSummaryLog aggregation, demandScore, topicKeys from EnquiryLog/TopicSummaryLog)
- backend/scripts/buildCoverageReport.js ($set new fields)
- backend/scripts/buildSprintOrderFromCoverage.js (--weights demand=)
- backend/services/sprintOrder/sprintOrderService.js (demandWeight, computePriority, writeSnapshots)
- frontend/src/api/coverage.ts (CoverageRow types)
- frontend/src/pages/CoverageDashboardPage.tsx (columns, High demand filter, weak enquiries label)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (header badges enq/sum)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Weak summary: confidenceLevel === "weak" OR response.warnings contains "insufficient".
- Sprint order: node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology --weights "coverage=0.60,weak=0.25,demand=0.15"

Follow-ups:
PR-029 — Teach Mode: Convert Topic Summary → Draft Lesson Skeleton

---

**PR-029 — Teach Mode: Convert Topic Summary → Draft Lesson Skeleton (no auto-publish)**

Date: 2026-03-05

Summary:
Teachers can create a draft lesson from a topic summary in one click. POST /api/topic-summary/to-lesson accepts topicSummaryLogId and produces a DRAFT Lesson with 3 pages (Overview, Core ideas, Exam practice). Pure transformation — no AI. Teacher/admin only; rate limit 3/min teacher, 10/min admin. CoverageTopicDrawer Teaching summary modal: "Create draft lesson" button (enabled when topicSummaryLogId exists), confirm modal, success links (Edit lesson, View lesson). Lesson.metadata.generatedFrom = { topicSummaryLogId, kind: "topicSummary" }.

Files changed:

- backend/controllers/topicSummaryToLesson.controller.js (new)
- backend/middleware/topicSummaryToLessonRateLimit.js (new)
- backend/routes/topicSummaryToLesson.routes.js (new)
- backend/app.js (mount /api/topic-summary/to-lesson)
- frontend/src/api/topicSummary.ts (postTopicSummaryToLesson)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Create draft lesson button, confirm modal, success links)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- No new LLM calls; formatting/transformation only.
- Publish remains gated by existing publish gate.

Follow-ups:
PR-030 — Diagram-aware retrieval

---

**PR-030 — Diagram-aware retrieval (AI answers can reference lesson diagrams)**

Date: 2026-03-05

Summary:
Index lesson diagram blocks into KnowledgeDocuments (sourceType: lessonDiagram). Ask AI and Topic Summaries can retrieve and cite diagrams. Retrieval: +0.03 boost when query contains diagram/label/identify/structure/parts/draw/look at. CitationsList: DIAGRAM badge (purple), diagram preview card with image + caption + "View in lesson" link. Citation verification returns lessonDiagram metadata (lessonId, pageId, blockIndex, caption, imageUrl). Topic summary retrieval includes lessonDiagram. No image generation; only existing lesson diagrams.

Files changed:

- backend/models/KnowledgeDocument.js (sourceType lessonDiagram)
- backend/services/knowledge/indexers/lessonBlockIndexer.js (index diagram blocks)
- backend/services/knowledge/knowledgeSearchService.js (lessonDiagram filter, ranking boost)
- backend/services/knowledge/embedChangedDocuments.js (include lessonDiagram)
- backend/services/topicSummary/topicSummaryRetrieval.js (lessonDiagram in internalTypes)
- backend/utils/citationVerification.js (lessonDiagram deepLink + metadata)
- backend/services/pdf/topicSummaryPdf.js (DIAGRAM badge)
- frontend/src/api/enquiry.ts (EnquiryCitation lessonDiagram)
- frontend/src/components/ai/citationLinks.ts (lessonDiagram link)
- frontend/src/components/ai/CitationsList.tsx (DIAGRAM badge, preview card)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Rebuild: node backend/scripts/buildKnowledgeIndex.js --apply --source lessonBlock (includes diagrams)
- Embed: lessonDiagram included in default sourceTypes

Follow-ups:
PR-031 — Weak Evidence Fix Mode

---

**PR-031 — Weak Evidence Fix Mode (coverage drill-down → generate gap-fix drafts)**

Date: 2026-03-05

Summary:
From Coverage drill-down for a topicKey, teachers/admins can generate draft content to fix missing spec statements coverage and weak enquiries (Insufficient trusted sources). Creates ONLY drafts; reuses Publish Gate (no auto-publish). "Fix weak evidence (draft pack)" button in Weak enquiries section opens modal with statement/question selection (max 5 each), allowExternal toggle, windowDays (7/14/30). Output: 1 draft lesson page, 4 flashcards, 5 quiz questions (MCQ/short), 2 exam questions. ContentGenerationJob mode extended with "weakEvidenceFix"; inputs: missingStatementCodes, weakQuestions, allowExternal, windowDays. Rate limit: 2/min teacher, 6/min admin for weak-evidence-fix.

Files changed:

- backend/models/ContentGenerationJob.js (mode weakEvidenceFix, inputs extended, index mode+createdAt)
- backend/services/generation/weakEvidenceFixService.js (new)
- backend/services/knowledge/knowledgeSearchService.js (sourceTypes array support)
- backend/services/llm/provider.js (generateWeakEvidenceFixPack mock + openai)
- backend/controllers/contentGeneration.controller.js (postWeakEvidenceFix)
- backend/routes/contentGeneration.routes.js (POST /weak-evidence-fix)
- backend/middleware/contentGenerationRateLimit.js (route-aware: 2/6 for weak-evidence-fix)
- frontend/src/api/generation.ts (postGenerateWeakEvidenceFix)
- frontend/src/components/coverage/CoverageTopicDrawer.tsx (Fix weak evidence button, modal, success panel, ReviewPublishChecklist)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Retrieval: specStatement, lessonBlock, teacherNote, lessonDiagram; externalTrusted only when allowExternal.
- ReviewPublishChecklist works unchanged (metadata.generatedFrom.jobId pattern).
- Knowledge refresh enqueued after publish (PR-015).

Follow-ups:
PR-033 — Student tutoring actions

---

**PR-032.1 — Fix weak-evidence-fix route wiring**

Date: 2026-03-05

Summary:
postWeakEvidenceFix was exported but never implemented; the route would fail when called. Implemented the handler to call runWeakEvidenceFixGeneration, create ContentGenerationJob (mode weakEvidenceFix), persist lesson + flashcards + quiz + exam drafts, and return the response shape expected by CoverageTopicDrawer success panel. Added missing isPracticeSetRoute in contentGenerationRateLimit middleware. Suggested action gating for "Create practice set (draft)" was already correct (teacher/admin, specKey, topicKey).

Files changed:

- backend/controllers/contentGeneration.controller.js (postWeakEvidenceFix handler)
- backend/middleware/contentGenerationRateLimit.js (isPracticeSetRoute)
- docs/AI_TUTOR_BUILD_LOG.md

Acceptance:
- POST /api/generate/weak-evidence-fix returns 200 and creates drafts.
- CoverageTopicDrawer weak evidence button works end-to-end.
- No stale exports or dead routes.

---

**PR-033 — Student tutor action chips**

Date: 2026-03-05

Summary:
Student chat feels like a tutor with one-tap follow-up chips above the input. Chips use the same conversation thread (PR-019) and responseMode logic (PR-020). No new backend models or endpoints. Frontend-only.

Chips:
- Explain again (mode: explain) — "Can you explain that again in different words?"
- Explain simpler (mode: quick) — "Explain it more simply, like I'm in Year 9."
- Another example (mode: explain) — "Give a different example and explain it step by step."
- Practice question (mode: quick) — "Give me 1 practice question on this, then explain the answer."
- Show diagram (mode: explain, when lessonId) — "If there is a diagram in this lesson, show it and explain what it shows."

Implementation:
- sendStudentMessage({ message, modeOverride? }) — shared helper for typed input and tutor chips
- sendTutorPrompt(message, mode) — chip helper: updates mode, calls sendStudentMessage
- Input box is NOT cleared when a chip is clicked (only cleared on form submit)
- Chips disabled while loading; wrap on narrow screens

Files changed:

- frontend/src/components/ai/AskAiStudentPanel.tsx
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- SuggestedActionsBar unchanged. No Exam mode for students (quick/explain/revision only).
- Show diagram nudges retrieval toward lessonDiagram (PR-030).

Follow-ups:
PR-034 — Inline diagram rendering

---

**PR-034 — Inline diagram rendering in AI answers**

Date: 2026-03-05

Summary:
When an answer cites a lessonDiagram source, render the diagram inline inside the assistant response (not only in CitationsList). Frontend-only. Filter response.answer.citations for sourceType === "lessonDiagram" with imageUrl; limit to max 2. InlineDiagramBlock: image, caption, "View in lesson" link. Placement: after explanation/keyPoints, before CitationsList. CitationsList unchanged — diagram still appears as [3] DIAGRAM in evidence. Student safety: backend returns only accessible lesson citations; no extra frontend checks.

Files changed:

- frontend/src/components/ai/InlineDiagramBlock.tsx (new)
- frontend/src/components/ai/AskAiStudentPanel.tsx (InlineDiagramBlock after explanation)
- frontend/src/components/ai/AskAiPanel.tsx (InlineDiagramBlock after keyPoints)
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Uses makeAbsoluteAssetUrl for image URLs; lesson link: /lesson/:id?page=N#block-M.
- studentMode: student links open same tab; teacher links open new tab.

Acceptance:
- Diagram appears inline in assistant message when cited.
- Citation still appears in evidence section.
- Clicking "View in lesson" opens the lesson page.

Follow-ups:
PR-035 — Live exam context search

---

**PR-035 — Live exam context search (controlled domains)**

Date: 2026-03-05

Summary:
Extend PR-021 external search: allow teachers/admins to optionally search recent exam context from trusted education domains when evidence is weak. Default domains: aqa.org.uk, ocr.org.uk, pearson.com, bbc.co.uk, openstax.org, nih.gov, nhs.uk. Env override still allowed. Domain query expansion: append site: filters (site:aqa.org.uk OR site:ocr.org.uk OR ...). Exam question detection: if query contains "exam", "past paper", "mark scheme", "6 mark", "explain question" — boost results from exam board domains (aqa, ocr, pearson first). UI: AskAiPanel shows "⚠ External exam context used" when external exam context used (with links). Students never trigger external search.

Files changed:

- backend/config/externalSearch.js (default domains, isExamContextQuery, getDomainsForQuery, EXAM_BOARD_DOMAINS)
- backend/controllers/enquiry.controller.js (getDomainsForQuery, externalExamContextUsed)
- backend/services/enquiry/enquiryCache.js (externalExamContextUsed in get/set)
- backend/services/externalSearch/provider.js (site: query expansion comment)
- backend/models/EnquiryLog.js (externalExamContextUsed)
- frontend/src/api/enquiry.ts (externalExamContextUsed)
- frontend/src/components/ai/AskAiPanel.tsx (⚠ External exam context used)
- backend/.env.example
- docs/AI_TUTOR_BUILD_LOG.md
- docs/SYSTEM_MAP.md

Notes:
- Exam keywords: exam, past paper, mark scheme, 6 mark, explain question.
- getDomainsForQuery puts exam boards first when exam context detected.

Acceptance:
- Teacher question "Recent GCSE enzyme questions" → AI returns external citations from exam boards.
- When external exam context used, UI shows "⚠ External exam context used" with source links.

Follow-ups:
None
