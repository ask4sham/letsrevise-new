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
PR-008 — Quality flywheel (evaluation harness, coverage dashboard)
