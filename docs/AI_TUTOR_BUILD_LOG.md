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
- PR-012: Integrate sprint output into teacher/admin UI (optional)
