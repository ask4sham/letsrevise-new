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
