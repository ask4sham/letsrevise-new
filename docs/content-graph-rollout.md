# Content Graph Rollout

## 1. What the feature does

The Content Graph is a canonical relationship layer between taxonomy, lessons, flashcards, quizzes, and exam questions. Content is linked by graph edges instead of loose topicKey copies.

**Benefits:**
- Reduces technical debt: content references canonical nodes
- Enables coverage analytics and gap detection
- Supports auto-attachment of flashcards/quiz/exam questions based on graph links
- Prepares for curriculum automation

**Components:**
- **ContentNode** – represents a taxonomy entity or content item (lesson, flashcard, quiz question, exam question)
- **ContentEdge** – represents relationships (teaches, belongs_to, covers)
- **Coverage service** – computes topic coverage scores (lesson + flashcards + quiz + exam)
- **Admin UI** – `/admin/content-coverage` for spec-level topic coverage view
- **EditLessonPage** – shows linked content counts and rebuild action

---

## 2. Migration / backfill steps

1. **Ensure MongoDB is running** and `MONGODB_URI` (or `MONGO_URI`) is set in `backend/.env`.

2. **Dry run first:**
   ```bash
   node backend/scripts/backfillContentGraph.js --dry-run
   ```
   Review output: would-process counts, sample unresolved mappings.

3. **Run backfill:**
   ```bash
   node backend/scripts/backfillContentGraph.js
   ```
   Output includes: `nodesByType`, `edgesByType`, `unresolvedByModel`, `sampleUnresolved`.

4. **Verify sample topics:**
   ```bash
   node backend/scripts/verifyContentGraphSample.js aqa-gcse-biology cell-structure animal-plant-cells
   ```

5. **Idempotent:** Safe to run multiple times. No duplicate edges (compound unique index).

---

## 3. Required index notes

Indexes are declared on the Mongoose schemas. Mongoose builds them automatically on first model use.

**ContentNode:**
- `canonicalKey` – sparse unique. `canonicalKey` is required, so never null.
- `nodeType + specKey + topicKey` – for taxonomy lookups.
- `lessonId`, `flashcardId`, `examQuestionId` – for content lookups.

**ContentEdge:**
- `(fromNodeId, toNodeId, edgeType)` – compound unique, prevents duplicate edges.
- `(fromNodeId, edgeType)` and `(toNodeId, edgeType)` – for graph traversal.

For large datasets, you can pre-build indexes once:
```javascript
// In mongo shell or a one-off script
db.contentnodes.createIndex({ canonicalKey: 1 }, { unique: true, sparse: true });
db.contentedges.createIndex({ fromNodeId: 1, toNodeId: 1, edgeType: 1 }, { unique: true });
```

---

## 4. Rollback approach

- **No destructive migrations.** The graph is additive. Existing lessons, flashcards, and questions are unchanged.
- **Disable feature:** Don't run backfill; don't use auto-attach graph path. Legacy topicKey-based flow continues.
- **Remove collections (last resort):**
  ```javascript
  db.contentnodes.drop();
  db.contentedges.drop();
  ```
  Lesson viewing and creation still work. Coverage admin page will show empty or fallback data.

---

## 5. Known assumptions

1. **Taxonomy** – Uses `getMergedTaxonomyBySpecKey` plus static specs. Taxonomy must match production.
2. **Topic keys** – Namespaced as `specKey:topicKey`. Legacy formats (unit__topic) supported via `queryCandidates`.
3. **Lesson schema** – `specKey`, `topicKey`, `topic`, `mainTopic`, `subTopic` used for mapping.
4. **TopicFlashcard / TopicQuizQuestion / ExamQuestion** – `topicKey`, `status`, `question` / `questionText` present.
5. **LessonIssueReport** – `lessonId`, `status: "open"` for coverage penalty.
6. **Auth** – Content graph routes use shared `auth` middleware (teacher/admin).

---

## 6. Curriculum Gap Detection

Curriculum Gap Detection uses the Content Graph and coverage data to identify weak curriculum areas and generate actionable recommendations for admins. It is **rules-based** (no LLM) and **read-only**—it does not auto-modify lessons or banks.

### What it does
- Ranks topics by priority score (higher = more urgent)
- Flags weak areas: missing lesson, low flashcards, low quizzes, low exam questions, high open issues
- Produces human-readable recommendations and suggested actions
- Provides a summary paragraph per topic (rules-based text generation)

### Priority scoring (v1)
| Condition | Points |
|-----------|--------|
| No lesson | +40 |
| Flashcards < 5 | +15 |
| Quizzes < 3 | +15 |
| Exam questions < 2 | +20 |
| Open issues ≥ 3 | +15 |
| Unresolved mappings | +10 |
| Coverage score < 40 | +20 |
| Coverage score 40–69 | +8 |

### How admins use it
1. Open **Content Coverage** page (`/admin/content-coverage`)
2. Select a spec and click **Gap Priorities**
3. Topics are sorted by priority (highest first)
4. Click a topic to see summary, counts, weak areas, recommendations, and suggested actions
5. Use recommendations to decide what to create or review

### Limitations
- **Unresolved mappings:** Not persisted in backfill; `unresolvedMappings` is currently always false
- **Read-only:** No auto-content creation; recommendations only
- **Admin-only:** Gap endpoints require `requireAdmin` middleware

### API endpoints

| Endpoint | Success (200) | 404 |
|----------|---------------|-----|
| `GET /api/content-graph/gaps/:specKey` | `{ specKey, summary, gaps }` | `{ error: "Spec not found" }` |
| `GET /api/content-graph/gaps/:specKey/:topicKey` | `{ ...topicGap }` | `{ error: "Topic not found" }` |

---

### From Gap Detection to Admin Action

Admins can act directly on recommendations from the Gap Priorities detail drawer. Each gap has `suggestedActions` (e.g. `create_lesson`, `generate_flashcards`, `generate_quiz`, `generate_exam_questions`, `review_content`, `fix_mapping`). Action buttons navigate to the appropriate workflow and, where supported, prefill spec/topic context.

| Action | Navigates to | Prefill |
|--------|--------------|---------|
| **create_lesson** | `/create-lesson` | `state: { specKey, topicKey }` — topic selectors and form are prefilled |
| **generate_flashcards** | `/teacher/topic-banks/flashcards` | `?specKey=&topicKey=` — spec and topic filters set |
| **generate_quiz** | `/teacher/topic-banks/quizzes` | `?specKey=&topicKey=` — topicKey passed to quiz bank |
| **generate_exam_questions** | `/admin/question-banks` | `?tab=exam-questions&topicKey=` — tab and topic filter set |
| **review_content** | `/admin/content-issues` | None (fallback — page has no topic filter) |
| **fix_mapping** | `/admin/taxonomy` | None (fallback — taxonomy / mapping management) |

**Prefill mechanism:**
- `create_lesson`: `CreateLessonPage` reads `location.state` and looks up the topic in taxonomy options to set Subject/Spec/Main topic/Sub-topic.
- Teacher routes (`flashcards`, `quizzes`): `setStoredSpecKey(specKey)` is called before navigation so the spec selector is correct; URL query params are read by the target page.
- Admin question banks: `useSearchParams` reads `tab` and `topicKey` to set the active tab and topic filter.

**Fallback routes:** `review_content` and `fix_mapping` go to general admin pages; topic-specific filtering is not available there. Future work could add `?topicKey=` support to content-issues or a dedicated mapping editor.

---

## 7. Taxonomy Edit/Delete Support

Admin taxonomy items (main topics and sub-topics added via `/admin/taxonomy`) support rename, delete, and move. **Deletion is guarded** when linked content exists.

### Edit support
- **Main topic:** `PATCH /api/admin/taxonomy/main-topic/:id` — `{ title?, slug? }`. Title updates display name; slug updates unitKey (cascades to sub-topics).
- **Sub-topic:** `PATCH /api/admin/taxonomy/sub-topic/:id` — `{ title?, slug? }`. Title always allowed. **Slug editing is restricted** when the topic has linked lessons, flashcards, quizzes, or exam questions (topicKey is identity; changing slug would orphan content).

### Delete safeguards
- Delete returns `409` with `{ error, linkedCounts }` when the item has linked content.
- Main topic: blocked if it has sub-topics or any sub-topic has linked content.
- Sub-topic: blocked if lessons, flashcards, quizzes, or exam questions reference its topicKey.

### Move sub-topic
- `POST /api/admin/taxonomy/sub-topic/:id/move` — `{ targetMainTopicId }`. Moves admin sub-topic to another main topic within the same spec. TopicKey (slug) preserved; only parent unit changes.

### Limitations
- Slug/topicKey editing for sub-topics: only when no linked content. Title edits are always safe.
- Static taxonomy (from config JSON) cannot be edited via API; only admin-added items.
- After rename or move, rebuild Content Graph for the affected spec to refresh coverage.

---

## 8. Manual verification checklist (3 sample topics)

Use `verifyContentGraphSample.js` or the admin UI.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `node backend/scripts/verifyContentGraphSample.js aqa-gcse-biology cell-structure` | Topic resolved, linked lessons/flashcards listed |
| 2 | Open `/admin/content-coverage`, select AQA GCSE Biology | Table shows topics with Lessons, Flashcards, Quizzes, Exam Qs, Score, Status |
| 3 | Click a topic row (e.g. cell-structure) | Drawer shows linked content counts, Rebuild button |
| 4 | Click Rebuild Topic Graph | Button disabled during rebuild; success toast; row refreshes |
| 5 | Open Edit Lesson for a lesson with topicKey | Graph panel shows "Topic has X flashcards, Y quizzes, Z exam questions linked" |
| 6 | Click Rebuild Graph in Edit Lesson | Graph refetches; "Updated" or refreshed counts |

---

## 9. CSV Import for Flashcards and Exam Questions

Phase 1: Anki-style bulk CSV import for TopicFlashcards and ExamQuestions. No Anki sync, no spaced repetition.

### Supported CSV formats

**Flashcard CSV**
| Column | Required | Description |
|--------|----------|-------------|
| front | Yes | Flashcard front text (max 500 chars) |
| back | Yes | Flashcard back text (max 2000 chars) |
| specKey | Yes* | e.g. `aqa-gcse-biology` (*or provide defaultSpecKey) |
| topicKey | Yes* | Leaf topic slug e.g. `cell-structure` (*or provide defaultTopicKey) |
| imageUrl | No | URL for image (stored in `assets[0].url`) |
| tags | No | Comma-separated |
| difficulty | No | Optional |
| status | No | `draft` (default) or `published` |

**Exam Question CSV**
| Column | Required | Description |
|--------|----------|-------------|
| questionText | Yes | Question stem |
| markScheme | Yes | Model answer (newline or `|` separated for multiple lines) |
| specKey | Yes* | (*or defaultSpecKey) |
| topicKey | Yes* | (*or defaultTopicKey) |
| marks | No | Number |
| imageUrl | No | Stored in `assets[0].url` |
| questionType | No | `mcq`, `short`, `label`, `table`, `data` (default `short`) |
| tags | No | Comma-separated |
| status | No | `draft` (default) or `published` |

### imageUrl storage

- **TopicFlashcard:** `assets[0].url` when imageUrl provided
- **ExamQuestion:** `assets[0].url` when imageUrl provided

### API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/import/flashcards/csv` | POST | Multipart: `file`, `dryRun`, `defaultSpecKey`, `defaultTopicKey` |
| `/api/import/exam-questions/csv` | POST | Same |
| `/api/import/templates/flashcards-csv` | GET | Download flashcard template |
| `/api/import/templates/exam-questions-csv` | GET | Download exam question template |

### Dry run

- `dryRun=true`: Parse and validate only; no DB writes. Returns summary and errors.
- `dryRun=false`: Import valid rows; skip duplicates and invalid.

### Moderation defaults

- `status` defaults to `draft` unless CSV specifies `published`
- Metadata: `importSource: "csv_import"`, `importType: "anki_style"`, `importedAt`, `importedBy`

### Duplicate handling

- **Flashcards:** Duplicate = same `front` + `back` + `topicKey` (within file and vs existing)
- **Exam questions:** Duplicate = same `questionText` + `topicKey` + `markScheme` (within file and vs existing)
- Duplicates are skipped; import continues for valid rows.

### Topic validation

- Only leaf topicKey values accepted (e.g. `cell-structure`). Main topic / section keys rejected.
- specKey/topicKey validated against taxonomy.

### Example CSV snippets

**Flashcards:**
```csv
front,back,specKey,topicKey,imageUrl,tags,difficulty,status
What is mitosis?,Cell division producing two identical cells,aqa-gcse-biology,cell-division,,,draft
What is diffusion?,Net movement from high to low concentration,aqa-gcse-biology,diffusion,https://example.com/diagram.png,,draft
```

**Exam questions:**
```csv
questionText,markScheme,specKey,topicKey,marks,imageUrl,questionType,tags,status
Describe the process of mitosis,1. Chromosomes condense 2. Spindle forms,aqa-gcse-biology,cell-division,4,,short,,draft
```

### UI

- **Admin:** `/admin/csv-import` (link from Admin Dashboard)
- **Teacher:** `/teacher/csv-import` (link from Teacher Dashboard)

---

## API contracts

| Endpoint | Success (200) | 400 | 404 |
|----------|---------------|-----|-----|
| `GET /api/content-graph/topic/:specKey/:topicKey` | `{ topicNode, linkedNodes, edgeCount, countsByType }` | - | `{ error: "Topic not found" }` |
| `GET /api/content-graph/lesson/:lessonId` | `{ lessonNode, topicNodes, lesson }` | Invalid ObjectId | `{ error: "Lesson not found" }` |
| `GET /api/content-graph/coverage/:specKey/:topicKey` | `{ specKey, topicKey, counts, score, status, weakAreas, ... }` | - | `{ error: "Topic not found" }` |
| `GET /api/content-graph/spec-coverage/:specKey` | `{ specKey, topics, totalTopics }` | - | `{ error: "Spec not found" }` |
| `POST /api/content-graph/rebuild/lesson/:lessonId` | `{ ok: true, lessonId, lessonNode }` | Invalid ObjectId | `{ error: "Lesson not found" }` |
| `POST /api/content-graph/rebuild/topic` | `{ ok: true, topicNode, lessonCount, ... }` | `{ error: "specKey and topicKey required" }` | `{ error: "Topic not found" }` |
| `POST /api/content-graph/rebuild/spec/:specKey` | `{ ok: true, specKey, topicsRebuilt, lessonLinksCreated, flashcardLinksCreated }` | `{ error: "specKey required" }` | `{ error: "Spec not found" }` |

Errors are JSON `{ error: string }` only. No stack traces in responses.

---

## 9. Curriculum Autopilot

Curriculum Autopilot is a safe automation layer that detects curriculum gaps and generates missing content (flashcards, quiz questions, exam questions) with AI. It runs as a controlled admin workflow—content is not auto-published.

### What it does

- Detects curriculum gaps automatically (uses existing gap detection)
- Generates flashcards, quiz questions, and exam questions with AI
- Attaches generated content to the Content Graph
- Recalculates coverage automatically after generation
- Supports dry-run mode (preview only, no writes)

### Current automated actions

| Action | Threshold | Description |
|--------|-----------|-------------|
| `generate_flashcards` | flashcards < 5 | Generate flashcards via starter pack |
| `generate_quiz` | quizzes < 3 | Generate quiz questions via starter pack |
| `generate_exam_questions` | exam questions < 2 | Generate exam questions via starter pack |

**Not automated:** `create_lesson` — recommend only; no auto lesson creation.

### Dry-run mode

- **Dry run (default in UI):** Preview planned actions only; no content is created or written.
- **Execute:** Runs generation and attaches content to the graph. Coverage is recalculated.

### Moderation behavior

- All generated content is saved with **status: draft**.
- Content includes `metadata.generatedBy: "autopilot"` for traceability.
- No auto-publish; admins must review and publish via existing workflows.

### Safety rules

- **High issue count:** Topics with ≥3 open lesson issues are skipped. Autopilot surfaces: "Skipped due to high issue count; review content first."
- **Duplicate protection:** Generation uses existing dedupe (fingerprint) and drift validation.
- **Idempotent graph:** Re-running autopilot does not create duplicate edges.

### Limits

- No auto lesson creation yet.
- Generation requires SpecStatements for the topic; otherwise returns `generation_not_available`.
- Only Topic leaf nodes receive generated content; Main Topic and Section remain grouping only.

### API endpoints

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/content-graph/autopilot/topic` | POST | `{ specKey, topicKey, dryRun?, actions?, promptPackId?, promptPackVersion? }` | Run autopilot for one topic |
| `/api/content-graph/autopilot/spec` | POST | `{ specKey, dryRun?, limit?, minPriorityScore?, promptPackId?, promptPackVersion? }` | Run autopilot for a spec |
| `/api/content-graph/autopilot/spec/:specKey/preview` | GET | `?limit=&minPriorityScore=` | Preview planned actions only |
| `/api/content-graph/autopilot/prompt-packs` | GET | - | List available prompt packs (admin only) |

All autopilot endpoints require admin (`requireAdmin` middleware).

### Prompt Pack Selection

Admins can choose which prompt pack/version to use when running Autopilot. This is **selection only**—no A/B testing or experimentation logic yet.

**How admins choose a pack**

1. Open **Content Coverage** page (`/admin/content-coverage`)
2. Select a spec and click **Gap Priorities**
3. In the Autopilot controls (spec-level or topic-level drawer), use the **Prompt pack** dropdown
4. Select from active packs (e.g. "Autopilot Core v1", "Autopilot Core v2")
5. Run Autopilot—the selected pack is used for that run and stored on runs and generated content

**Default behavior**

- If no pack is selected, the current default pack (e.g. autopilot-core v1) is used
- The dropdown defaults to the default pack when the page loads

**Validation behavior**

- Invalid `promptPackId` or `promptPackVersion` returns **400** with `{ error: "Unknown prompt pack: …" }` or `{ error: "Unknown prompt pack version: …" }`
- The API does not silently invent a pack; invalid input is rejected clearly

**What gets stored**

- **AutopilotRun:** `promptPackId` and `promptPackVersion` on the run record
- **Generated content:** `metadata.promptPackId` and `metadata.promptPackVersion` on flashcards, quiz questions, exam questions
- Existing feedback/outcomes by prompt pack continue to work; legacy runs and content remain compatible

### Prompt Pack Experimentation

Experiments allow Autopilot runs to use multiple prompt packs in controlled A/B tests and compare outcomes automatically.

**Why experiments exist**

- Compare prompt pack effectiveness (approval rate, coverage lift) before rolling out changes
- Run controlled tests on a spec or topic without manual pack selection
- Aggregate results by pack for data-driven decisions

**How assignment works**

1. **Explicit selection:** If the admin selects a pack in the UI, that pack is used (no experiment).
2. **Active experiment:** If an experiment is active for the spec/topic, the pack is assigned via experiment rules:
   - **Round robin:** Packs are assigned in sequence (v1, v2, v1, v2, …).
   - **Weighted random:** Packs are chosen randomly according to their weights.
3. **Default:** If no experiment applies, the default pack is used.

**Experiment scope**

- **specKey:** Restricts the experiment to runs for that spec. Null = all specs.
- **topicKey:** Restricts to a specific topic. Null = all topics in the spec.

**How results are evaluated**

- **Runs:** Number of autopilot runs using each pack.
- **Generated:** Total items (flashcards, quizzes, exam questions) generated.
- **Approved / Rejected:** From the approval queue (published vs archived).
- **Approval rate:** Approved ÷ (Approved + Rejected).
- **Avg coverage lift:** Average change in coverage score per topic.

Admins view results on the **Autopilot Experiments** page (`/admin/autopilot-experiments`). Experiments can be paused or activated without deleting them.

**API endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/content-graph/autopilot/experiments` | GET | List experiments |
| `POST /api/content-graph/autopilot/experiments` | POST | Create experiment |
| `GET /api/content-graph/autopilot/experiments/:id` | GET | Get single experiment |
| `PATCH /api/content-graph/autopilot/experiments/:id` | PATCH | Update (status, label, description) |
| `GET /api/content-graph/autopilot/experiments/:id/results` | GET | Get experiment performance |

---

## 10. Autopilot Readiness Diagnostics

Before expanding Autopilot further, admins can see exactly which topics are ready for automation, which are blocked, and why. This is **diagnostics only**—no approval queue, no changes to generation logic.

### What readiness means

A topic is **ready** when:
- At least one autopilot action is available (generate flashcards, quiz, or exam questions)
- No blockers apply

A topic **requires review** when:
- Open lesson issues ≥ 3 (high issue count)

### Readiness flags

| Flag | Meaning |
|------|---------|
| `hasSpecStatements` | Topic has SpecStatements needed by generators |
| `lowIssues` | Open issues < 3 |
| `hasTopicNode` | Canonical topic graph node exists |
| `canGenerateFlashcards` / `canGenerateQuiz` / `canGenerateExamQuestions` | All of: hasSpecStatements, lowIssues, hasTopicNode, topic is a leaf |

### Blockers

| Blocker | Cause |
|---------|-------|
| Missing specification statements | No SpecStatements for this topic |
| High open issue count | Open issues ≥ 3 |
| Topic graph node missing | ContentNode for topic does not exist |
| Topic is not a leaf topic | Topic is a main topic or section, not a leaf sub-topic |

### How admins use the readiness view

1. Open **Content Coverage** page (`/admin/content-coverage`)
2. Select a spec and click **Autopilot Readiness**
3. Table shows per-topic: Ready, Requires Review, Available Actions, Blockers, Summary
4. Click a row to open the detail drawer with counts, flags, blockers, recommended actions
5. Use this view to decide which topics to run Autopilot on and which need manual fixes first

### API endpoints

| Endpoint | Success (200) | 404 |
|----------|---------------|-----|
| `GET /api/content-graph/autopilot/readiness/:specKey` | `{ specKey, summary, topics }` | `{ error: "Spec not found" }` |
| `GET /api/content-graph/autopilot/readiness/:specKey/:topicKey` | Single topic readiness object | `{ error: "Topic not found" }` |

---

## 11. Autopilot Approval Queue

Admin review workflow for autopilot-generated draft content before it is approved/published. **Review + approval only**—no changes to generation logic, no auto-publish.

### What appears in the queue

Only items where:
- `status` is `draft`
- `metadata.generatedBy === "autopilot"`
- `isArchived` is not true

Supported item types: `flashcard`, `quizQuestion`, `examQuestion`.

### How approval works

- **Approve:** Updates `status` to `published`. Writes `metadata.reviewedBy`, `metadata.reviewedAt`, `metadata.reviewDecision: "approved"`.
- **TopicQuizQuestion** also sets `publishedBy` and `publishedAt`.

### How rejection works

- **Reject:** Sets `isArchived: true`. Writes `metadata.reviewedBy`, `metadata.reviewedAt`, `metadata.reviewDecision: "rejected"`, `metadata.reviewReason` (optional).

### Moderation status mapping

| Content type | Approve | Reject |
|--------------|---------|--------|
| TopicFlashcard | status → `published` | isArchived → `true` |
| TopicQuizQuestion | status → `published`, publishedBy, publishedAt | isArchived → `true` |
| ExamQuestion | status → `published` | isArchived → `true` |

All three use the same status enum: `draft` | `published`. There is no `rejected` status; rejection uses `isArchived`.

### Limits / assumptions

- Only autopilot-generated content appears; manual drafts are excluded.
- Bulk approve/reject processes items sequentially; partial failures are reported in the response.
- Unsupported item types (e.g. `lesson`) fail with a clear error.

### How admins use it

1. Open **Autopilot Approval** page (`/admin/autopilot-approval`)
2. Filter by spec, topic, or item type
3. Review drafts in the table; click a row for detail
4. Approve or reject individually, or select multiple and use bulk actions

### API endpoints

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `GET /api/content-graph/autopilot/drafts` | GET | `?specKey=&topicKey=&itemType=&status=` | List autopilot drafts |
| `POST /api/content-graph/autopilot/approve` | POST | `{ itemType, itemId }` | Approve one item |
| `POST /api/content-graph/autopilot/reject` | POST | `{ itemType, itemId, reason? }` | Reject one item |
| `POST /api/content-graph/autopilot/approve-bulk` | POST | `{ items: [{ itemType, itemId }] }` | Bulk approve |
| `POST /api/content-graph/autopilot/reject-bulk` | POST | `{ items, reason? }` | Bulk reject |

### 11.5. Draft Question Library

Bulk generation of flashcards and exam questions for every SpecStatement. **Copyright-safe:** uses ONLY SpecStatements (no external educational site scraping, no copying copyrighted teaching wording). See [AI Content Sourcing Policy](ai-content-sourcing-policy.md).

**What it does:**
- For each SpecStatement: generates 5–8 flashcards and 2–3 exam questions
- Uses `sourceType: "spec_statements_only"` — no KnowledgeDocument context
- Uses `generatorMode: "draft_library"` in metadata for traceability
- Spec-level: processes leaf topics only; skips topics with >100 flashcards or >40 exam questions
- Rejects non-leaf topicKey when passed
- Content appears in `/admin/autopilot-approval`; filter by `?generatorMode=draft_library`

**API endpoints:**
| Endpoint | Method | Body | Description |
|----------|--------|------|--------------|
| `POST /api/content-graph/draft-library/topic` | POST | `{ specKey, topicKey, dryRun?, promptPackId?, promptPackVersion?, limitFlashcards?, limitExamQuestions? }` | Generate for one topic |
| `POST /api/content-graph/draft-library/spec` | POST | `{ specKey, topicKeys?, limitPerTopic?, dryRun?, promptPackId?, promptPackVersion?, limitFlashcards?, limitExamQuestions? }` | Generate for entire spec |

**Topic Command Center:** `draftLibrary: { flashcards, examQuestions, lastGeneratedAt }` shows draft library counts per topic.

**Admin UI:** `/admin/draft-library` — spec selector, dry run toggle, topic/spec generation, copyright note.

---

## 12. Autopilot Run History

Durable audit trail for autopilot runs so admins can inspect past runs, understand what happened, and troubleshoot skipped/failed topics.

### What gets logged

Every topic and spec autopilot run creates an `AutopilotRun` record, including:
- **Dry runs** — planned actions are logged
- **Executed runs** — generated counts, skipped reasons, failed reasons
- **Per-topic results** — planned actions, executed actions (type, status, createdCount, reason), updated coverage snapshot

### Run status meanings

| Status | Meaning |
|--------|---------|
| **completed** | No failed actions; at least one generated or planned |
| **partial** | Some actions failed and some succeeded |
| **failed** | Top-level error (e.g. topic not found) or all actions failed/skipped with no success |

### Dry-run logging

Dry runs are logged the same as executed runs. `dryRun: true` is stored; all actions have status `planned`.

### How admins inspect past runs

1. Open **Autopilot Runs** page (`/admin/autopilot-runs`)
2. Filter by spec, topic, run type, status, or dry-run
3. Click a row or "View details" to open the detail drawer
4. Detail shows: requested actions, per-topic results, generated counts, skipped/failed reasons, updated coverage snapshots

### API endpoints

| Endpoint | Method | Query/Body | Description |
|----------|--------|------------|-------------|
| `GET /api/content-graph/autopilot/runs` | GET | `?specKey=&topicKey=&runType=&dryRun=&status=&limit=` | List runs |
| `GET /api/content-graph/autopilot/runs/:id` | GET | — | Get one run (full detail with topicResults) |

---

## 13. Autopilot Outcomes Dashboard

Shows admins whether Autopilot is delivering useful outcomes over time.

### What outcomes are tracked

- **Run counts:** Total runs, dry runs, live runs, completed/partial/failed
- **Generated items:** Flashcards, quizzes, exam questions from run logs
- **Approved/rejected:** Only items with `metadata.generatedBy === "autopilot"` (status published = approved, isArchived = rejected)
- **Repeated failures:** Topics that fail or get skipped repeatedly (from topicResults)
- **Coverage lift:** Topics with post-generation coverage snapshot from run logs

### Coverage Baseline Snapshots

Autopilot runs now store **true before/after coverage snapshots** per topic:

- **coverageBefore** — snapshot taken before executing autopilot actions (score, status, counts)
- **coverageAfter** — snapshot taken after generation and graph refresh
- **coverageLift** — `(coverageAfter.score || 0) - (coverageBefore.score || 0)`

**True lift vs estimated lift:**
- **True lift:** When `coverageLift` is present in run logs, the Outcomes Dashboard shows the actual before/after difference.
- **Estimated lift:** For legacy runs (no coverageBefore/coverageAfter stored), we fall back to `updatedCoverage.score` as a proxy. This is best-effort; exact before/after is unknown.

**Legacy run fallback:** Runs created before this feature have only `updatedCoverage`. The Outcomes service prefers `coverageLift` when available and uses `estimatedCoverageLift` only for legacy runs. The UI labels each row as "true" or "estimated" accordingly.

**Dry runs:** Store `coverageBefore`; `coverageAfter` equals `coverageBefore`; `coverageLift` is 0.

**Failed runs:** Store `coverageBefore` when available; `coverageAfter` only if refresh succeeded.

### How admins use failures/rejections

- **Repeated failures:** Identify topics where generation consistently fails (e.g. missing SpecStatements, drift). Improve prompts or add specification content.
- **Rejections:** Review rejected autopilot items to improve content quality or adjust generation parameters.
- **Coverage lift:** See which topics improved after autopilot; prioritize similar topics for future runs.

### API endpoints

| Endpoint | Query params | Description |
|----------|--------------|-------------|
| `GET /api/content-graph/autopilot/outcomes` | specKey, topicKey, days, limit | Full outcome summary |
| `GET /api/content-graph/autopilot/outcomes/spec/:specKey` | days, limit | Spec-level outcomes |
| `GET /api/content-graph/autopilot/outcomes/spec/:specKey/topic/:topicKey` | days, limit | Topic-level outcomes |

---

## 14. Autopilot Prompt Quality Feedback

Tracks whether autopilot-generated content is actually good enough, using approval/rejection outcomes and rejection reasons. **Analytics + feedback only**—no changes to generation or approval logic.

### What it tracks

- **Reviewed items:** Autopilot-generated content that has been approved (published) or rejected (archived)
- **Approval rate:** approved / (approved + rejected)
- **By type:** Flashcard, Quiz Question, Exam Question breakdown
- **Rejection patterns:** Normalized rejection reasons with counts
- **Weak topics:** Topics with low approval rates (prioritized for prompt improvement)

### Rejection reason normalization

Free-text `metadata.reviewReason` is normalized to codes for aggregation. Original reason is preserved. Codes:

| Code | Meaning |
|------|---------|
| `missing_accuracy` | Incorrect facts, wrong answer |
| `weak_explanation` | Poor or unclear explanation |
| `duplicate_content` | Duplicate or repetitive |
| `poor_exam_alignment` | Not aligned to spec/syllabus |
| `unclear_question` | Ambiguous or confusing question |
| `other` | Fallback for unknown reasons |

### How admins use it

1. Open **Autopilot Feedback** page (`/admin/autopilot-feedback`)
2. Filter by spec, topic, or days
3. Review summary cards: reviewed, approved, rejected, approval rate
4. Inspect rejection patterns to identify common issues
5. Use weak topics list to prioritize prompt improvements

### API endpoints

| Endpoint | Query params | Description |
|----------|--------------|-------------|
| `GET /api/content-graph/autopilot/feedback` | specKey, topicKey, days, limit | Full feedback summary |
| `GET /api/content-graph/autopilot/feedback/spec/:specKey` | days, limit | Spec-level feedback |
| `GET /api/content-graph/autopilot/feedback/spec/:specKey/topic/:topicKey` | days | Topic-level feedback |
| `GET /api/content-graph/autopilot/feedback/prompt-packs` | specKey, topicKey, days, limit | Feedback by prompt pack |
| `GET /api/content-graph/autopilot/outcomes/prompt-packs` | specKey, topicKey, days, limit | Outcomes by prompt pack |

---

## 15. Prompt Pack Versioning

Track which prompt pack / generation strategy produced each autopilot-generated item and each autopilot run. **Metadata tracking + analytics only**—no changes to generation behavior.

### Why prompt metadata matters

- Compare quality outcomes across prompt versions over time
- Identify which prompt packs perform best (approval rate, coverage lift)
- Prepare for future A/B testing and prompt iteration

### Where it is stored

- **Generated content:** `metadata.promptPackId`, `metadata.promptPackVersion`, `metadata.generatorMode`, `metadata.generatedAt` on TopicFlashcard, TopicQuizQuestion, ExamQuestion
- **Autopilot runs:** `promptPackId`, `promptPackVersion` on AutopilotRun; same fields on each `executedAction` in topicResults

### Current identifiers

- `promptPackId`: `"autopilot-core"`
- `promptPackVersion`: `"v1"`
- `generatorMode`: `"starter_pack"` (from starter pack generation)

Defined in `backend/services/autopilotPromptMetadata.js`; easy to change later.

### How prompt-pack feedback helps

1. **Autopilot Feedback** page shows "Prompt Pack Performance" table: Reviewed, Approved, Rejected, Approval Rate per pack
2. **Autopilot Outcomes** page shows runs, generated items, avg coverage lift per pack
3. Legacy content/runs without prompt metadata are excluded from pack aggregation (or grouped as "unknown" for runs)

---

## 16. Topic Evidence Dashboard

A Learning Evidence Layer that shows whether content is actually working for students, not just whether content exists. **Evidence aggregation + admin UI only**—no personalization, no changes to autopilot generation logic.

### What evidence is included

Evidence is aggregated from existing platform data:

| Source | What it provides |
|--------|------------------|
| **LessonIssueReport** | Open lesson issues (status: open) for lessons linked to the topic |
| **LessonRevisionDraft** | Teacher revision activity on linked lessons |
| **AutopilotRun** | Autopilot runs for the spec/topic (non–dry-run) |
| **TopicFlashcard / TopicQuizQuestion / ExamQuestion** | Autopilot approvals (published) and rejections (archived) for items with `metadata.generatedBy === "autopilot"` |

No student mastery or performance data is included yet.

### What evidenceHealth means

| Health | Meaning |
|--------|---------|
| **strong** | No open issues, approval rate ≥ 80% when enough reviewed items exist |
| **mixed** | Some issues, or approval rate 60–79%, or teacher revisions exist |
| **weak** | Open issues ≥ 3, or approval rate < 60% with ≥ 3 reviewed items |
| **unknown** | Not enough evidence yet (no issues, no revisions, little/no autopilot history) |

### Evidence signals

- **hasOpenIssues** — open issue count > 0
- **hasHighIssueVolume** — open issue count ≥ 3
- **hasTeacherRevisionActivity** — teacher revisions > 0
- **hasAutopilotHistory** — autopilot runs > 0
- **hasLowApprovalRate** — approval rate < 60% when reviewed items ≥ 3

### Limitations

- **No student mastery data yet** — evidence is based on issues, revisions, and autopilot outcomes only
- **No personalization** — this step is evidence aggregation only
- **Autopilot logic unchanged** — no changes to generation or approval flow

### How admins use the dashboard

1. Open **Content Coverage** page (`/admin/content-coverage`)
2. Select a spec and click **Topic Evidence**
3. Table shows per-topic: Evidence Health, Open Issues, Revisions, Approval Rate, Autopilot History, Summary
4. Click a row to open the detail drawer with counts, signals, derived metrics, blockers, recommendations
5. Use weak evidence topics to prioritize content review or autopilot quality improvements

### API endpoints

| Endpoint | Success (200) | 404 |
|----------|---------------|-----|
| `GET /api/content-graph/evidence/:specKey` | `{ specKey, summary, topics }` | `{ error: "Spec not found" }` |
| `GET /api/content-graph/evidence/:specKey/:topicKey` | Single topic evidence object | `{ error: "Topic not found" }` |

All evidence endpoints require admin (`requireAdmin` middleware).

---

## 17. Evidence-Aware Autopilot Gating

Autopilot decisions are now aware of Topic Evidence Health, so automation is safer and better targeted. **Decision/gating logic only**—no changes to generation logic, approval queue, or evidence sources.

### What gate statuses mean

| Gate Status | Meaning |
|-------------|---------|
| **allow** | Topic is ready and evidence is strong or unknown; all autopilot actions can run |
| **limited** | Evidence is mixed; only flashcards and quiz generation allowed; exam questions blocked |
| **review_required** | Evidence is weak or approval rate is low; no automatic execution; admin must inspect |
| **block** | Topic is not autopilot-ready, or evidence is weak with high open issues |

### How evidence health affects automation

- **Strong evidence + ready** → allow all actions
- **Unknown evidence + ready** → allow all actions (no negative signals yet)
- **Mixed evidence** → limited: flashcards and quiz only; exam questions blocked (higher risk)
- **Weak evidence** → review_required: no execution; admin inspects rejection reasons
- **Weak evidence + open issues ≥ 3** → block
- **Not ready** (missing SpecStatements, high issues, no topic node, etc.) → block

### Why some topics are limited / review-only / blocked

- **Limited:** Mixed evidence (some issues, moderate approval rate, or teacher revisions) suggests content quality is uncertain. Low-risk actions (flashcards, quiz) are allowed; exam questions are blocked.
- **Review required:** Weak evidence or low approval rate indicates autopilot output quality is poor. Admins should inspect rejection reasons before running more generation.
- **Blocked:** Topic lacks prerequisites (SpecStatements, graph node) or has severe evidence problems (high issues + weak evidence).

### API endpoints

| Endpoint | Success (200) | Description |
|----------|---------------|-------------|
| `GET /api/content-graph/autopilot/gate/:specKey/:topicKey` | `{ specKey, topicKey, gateStatus, reasons, allowedActions, blockedActions, summary }` | Get gate decision for a topic |

Topic and spec autopilot responses include `gateStatus`, `gateReasons`, `allowedActions`, `blockedActions`, and `gateSummary`.

### How admins use it

1. Open **Content Coverage** page (`/admin/content-coverage`)
2. In **Gap Priorities**, **Autopilot Readiness**, or **Topic Evidence**, click a topic to open the detail drawer
3. The **Autopilot gate** section shows gate status, summary, and allowed/blocked actions
4. If gate is **block** or **review_required**, the Run Autopilot button is disabled with a clear reason
5. If gate is **limited**, the button shows which actions will run (flashcards, quiz only)

---

## 18. Evidence Review Worklist

Admin worklist for topics that are **blocked** or **review_required** by Evidence-Aware Autopilot Gating. **Workflow + aggregation + UI only**—no new evidence sources, no changes to generation or approval logic.

### What enters the worklist

Only topics with gate status **block** or **review_required** appear. Topics with **allow** or **limited** are excluded.

### How priority is calculated

| Condition | Points |
|-----------|--------|
| block | +40 |
| review_required | +25 |
| open issues ≥ 3 | +20 |
| approval rate < 60% (with ≥ 3 reviewed items) | +20 |
| teacher revisions > 0 | +10 |
| autopilot rejections ≥ 3 | +15 |

Items are ranked by priority (higher first), then by topicKey for stability.

### Recommended actions

| Action | When shown |
|--------|------------|
| **resolve_open_issues** | Open issues > 0 |
| **review_content** | Open issues > 0 |
| **inspect_rejections** | Low approval rate with enough reviewed items |
| **improve_prompt_pack** | Low approval rate |
| **fix_topic_mapping** | Gate reasons mention mapping or topic node |
| **rebuild_graph** | Same as fix_topic_mapping |

### Relationship to gating

The worklist is a **filtered view** of gating outcomes. It aggregates topics that need human attention before autopilot can run safely. Resolving issues, inspecting rejections, or fixing mappings may change the gate status and remove the topic from the worklist.

### How admins use it

1. Open **Content Coverage** page (`/admin/content-coverage`)
2. Click **Evidence Review** tab
3. Table shows: Topic, Gate Status, Evidence Health, Priority, Reasons, Summary
4. Click a row to open the detail drawer with evidence summary, reasons, and recommended actions
5. Use action buttons to navigate: Review Content, Inspect Rejections, Resolve Issues, Rebuild Graph, etc.

### API endpoints

| Endpoint | Success (200) | 404 |
|----------|---------------|-----|
| `GET /api/content-graph/evidence-review/:specKey` | `{ specKey, summary, items }` | — |
| `GET /api/content-graph/evidence-review/:specKey/:topicKey` | Single review item | `{ error: "Topic not in review worklist" }` |

---

## 19. Student Learning Evidence

Captures student performance signals (quiz attempts, flashcard reviews, exam question attempts, lesson completions) and links them to topicKey so the system can measure real learning outcomes per topic. **Capture + aggregation only**—no personalization, no changes to autopilot or curriculum graph.

### How evidence is captured

Events are stored in **LearningEvidenceEvent** with:

- **eventType:** `quiz_attempt`, `flashcard_review`, `exam_question_attempt`, `lesson_completion`
- **userId**, **specKey**, **topicKey** (required)
- **correct**, **score**, **timeSpentSeconds**, **difficultyRating** (optional, per event type)
- **contentId** / **lessonId** for traceability

The **learningEvidenceService** provides:

- `recordQuizAttempt({ userId, specKey, topicKey, lessonId?, quizId?, correct?, score?, timeSpentSeconds? })`
- `recordFlashcardReview({ userId, specKey, topicKey, flashcardId?, difficultyRating? })`
- `recordExamQuestionAttempt({ userId, specKey, topicKey, questionId?, correct?, timeSpentSeconds? })`
- `recordLessonCompletion({ userId, specKey, topicKey, lessonId?, timeSpentSeconds? })`

These are lightweight and non-blocking. Integration into quiz/flashcard/exam/lesson flows is done by calling these from the relevant handlers.

### Where evidence is captured (real user flows)

| Flow | Handler | Fields captured |
|------|---------|-----------------|
| **Quiz submit** | `POST /api/quiz-attempts/:attemptId/submit` (quizAttempts.js) | userId, specKey, topicKey, lessonId, correct, score, timeSpentSeconds (from lesson context) |
| **Flashcard review** | `POST /api/progress/flashcard-review` (progress.routes.js) | userId, specKey, topicKey. No difficultyRating/flashcardId — UI does not collect yet |
| **Exam question attempt** | `POST /api/practice-attempts` when contentType=exam_question (practiceAttempts.js) | userId, specKey, topicKey, questionId, correct, timeSpentSeconds |
| **Lesson completion** | `POST /api/progress/lesson-view` (fires recordLessonCompletion) and `POST /api/progress/lesson-completion` | userId, specKey, topicKey, lessonId?, timeSpentSeconds? |

Evidence logging is fire-and-forget; failures are logged server-side only and never break the student flow.

### Event types still deferred

- **Assessment paper submit** (`POST /api/assessment-attempts/:id/submit`): Papers span multiple topics; per-question evidence would require iterating answers and resolving topicKey per question. Deferred.
- **difficultyRating for flashcards**: The flashcard-review flow does not collect difficulty/confidence. Record engagement only until UI adds a rating signal.

### What masteryScore represents

**masteryScore** is a weighted average of quiz accuracy and exam accuracy:

- When both exist: `(quizAccuracy + examAccuracy) / 2`
- When only one exists: that value
- When neither exists: `null`

Accuracy is `correct / attempts * 100` (rounded).

### How difficultyLevel is derived

| masteryScore (accuracy) | difficultyLevel |
|-------------------------|------------------|
| &lt; 50% | very_difficult |
| 50–65% | difficult |
| 65–80% | moderate |
| ≥ 80% | well_understood |
| unknown / null | unknown |

### How this informs curriculum improvement

- **very_difficult** topics: content may need simplification or better scaffolding
- **difficult** topics: consider more practice, worked examples, or revision
- **moderate** topics: adequate; monitor for drift
- **well_understood** topics: content appears effective; consider extending or linking to harder topics

Admins view this on the **Student Learning** tab of the Content Coverage page.

### API endpoints

| Endpoint | Success (200) | Description |
|----------|---------------|-------------|
| `GET /api/content-graph/learning-evidence/:specKey` | `{ specKey, topics }` | Spec-level learning evidence |
| `GET /api/content-graph/learning-evidence/:specKey/:topicKey` | Single topic learning evidence | Topic-level stats |

All admin-only.

---

## 20. Spec Document Ingestion

Turns official exam board specification documents into structured **SpecStatements** automatically, so LetsRevise can use them as the canonical curriculum input for AI generation.

### Purpose

- **Source of truth:** Official exam board specs (PDF, markdown, text) become structured curriculum statements
- **Curriculum-aligned:** Statements map to leaf topics in the taxonomy
- **Auditable:** Dry-run mode, unmapped review, duplicate-safe ingestion

### Source restrictions

- **Official exam board documents only.** No scraping of random educational websites.
- Supported formats: `.txt`, `.md`, `.pdf` (requires `pdf-parse`).
- Ingestion is from files provided to the system (upload or server path).

### How statements are mapped

1. **Extract:** Parse headings, subheadings, and bullet points from the document.
2. **Normalize:** Convert into candidate statements with `statementType` (core, required_practical, maths_skill, exam_skill, other).
3. **Map:** Match each statement to a leaf topic using:
   - Exact heading match → **high confidence** (auto-saved)
   - Heading contains topic / unit + text match → **medium confidence** (review)
   - No match → **unmapped** (review manually)

4. **Save:** Only high-confidence mappings are written to the DB. Duplicates are skipped via `canonicalStatementKey`.

### Dry run and review workflow

1. Upload a spec document on **Spec Statements** page (`/admin/spec-statements`).
2. Enable **Dry run** to preview parsed/mapped/unmapped counts without writing.
3. Review unmapped statements in the result; fix headings or taxonomy if needed.
4. Disable dry run and ingest to save high-confidence statements.
5. Re-run ingestion idempotently; duplicates are skipped.

### Limitation

- **Unmapped statements require manual review.** Medium/low confidence mappings are not auto-saved. Admins can manually add SpecStatements via the existing CRUD API or improve document structure for better heading match.

### API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/spec-statements/ingest` | POST | Ingest document (multipart: file, specKey, subject?, dryRun?) |
| `GET /api/spec-statements/:specKey` | GET | List stored SpecStatements for a spec |

Admin-only.

---

## 21. Topic Command Center

The **Topic Command Center** is a unified operational view that aggregates all signals about a single topic into one page. It serves as the operational brain of the system for each topic.

### Purpose

- **Single pane of glass:** Curriculum, coverage, gap, readiness, evidence, learning, autopilot, and prompt pack performance in one place
- **Actionable:** Recommended actions drive curriculum improvement
- **No duplication:** Orchestrates existing services only; no new logic or data models

### Signals aggregated

| Signal | Source |
|--------|--------|
| Curriculum | SpecStatement model, adminTaxonomyService |
| Coverage | contentCoverageService |
| Gap analysis | curriculumGapDetectionService |
| Autopilot readiness | autopilotReadinessService |
| Evidence health | topicEvidenceService |
| Evidence review | evidenceReviewWorklistService, autopilotGatingService |
| Student learning | studentTopicEvidenceService |
| Autopilot runs | autopilotOutcomesService |
| Prompt pack performance | autopilotFeedbackService, autopilotOutcomesService |

### How admins use it

1. Open **Content Coverage** (`/admin/content-coverage`)
2. Click a topic in any tab (Coverage, Gap Priorities, Topic Evidence, Evidence Review, Student Learning)
3. Click **Command Center** in the drawer, or navigate directly to `/admin/topic/:specKey/:topicKey`
4. Review aggregated signals and recommended actions
5. Use action buttons (Run Autopilot, Generate Flashcards, Inspect Rejections, Review Content, Fix Taxonomy, Open Evidence Review) to drive improvement

### Recommended action rules

| Condition | Action |
|-----------|--------|
| Gap priority high (≥30) | create_lesson, generate_flashcards, generate_quiz |
| Evidence health weak | review_content |
| Approval rate &lt; 60% | inspect_rejections |
| Mastery score &lt; 65% | revise_explanation |
| Zero autopilot runs, topic ready | run_autopilot |
| Mapping/graph problems | fix_taxonomy_mapping |
| Gate block/review_required | open_evidence_review |

### Autopilot Safe Mode Evidence Thresholds

Safe Mode requires all of the following before auto-publishing generated content:

- Evidence health = strong
- Approval rate ≥ 85%
- Prompt pack approval ≥ 80%
- Mastery score ≥ 70%
- No open issues
- Autopilot gate = allow
- **Minimum evidence sample:**
  - ≥ 3 autopilot runs (non–dry-run)
  - ≥ 10 reviewed generated items (published or archived)
  - ≥ 20 quiz attempts (LearningEvidenceEvent)

**Purpose:** Prevent early or statistically weak auto-publishing decisions. The Topic Command Center displays evidence sample counts and thresholds so admins can see why Safe Mode is enabled or disabled.

### How it drives curriculum improvement

Admins use the Command Center to:

- Identify weak topics (low coverage, high gap priority)
- See evidence health and approval rates before running autopilot
- Compare prompt pack performance per topic
- Act on student learning signals (low mastery → revise content)
- Navigate directly to existing workflows (flashcards, quizzes, taxonomy, evidence review)

### API endpoint

| Endpoint | Success (200) | 500 |
|----------|---------------|-----|
| `GET /api/content-graph/topic-command/:specKey/:topicKey` | TopicCommandCenter object | `{ error: string }` |

Admin-only.
