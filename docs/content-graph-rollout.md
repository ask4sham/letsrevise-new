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

## 6. Manual verification checklist (3 sample topics)

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

## API contracts

| Endpoint | Success (200) | 400 | 404 |
|----------|---------------|-----|-----|
| `GET /api/content-graph/topic/:specKey/:topicKey` | `{ topicNode, linkedNodes, edgeCount, countsByType }` | - | `{ error: "Topic not found" }` |
| `GET /api/content-graph/lesson/:lessonId` | `{ lessonNode, topicNodes, lesson }` | Invalid ObjectId | `{ error: "Lesson not found" }` |
| `GET /api/content-graph/coverage/:specKey/:topicKey` | `{ specKey, topicKey, counts, score, status, weakAreas, ... }` | - | `{ error: "Topic not found" }` |
| `GET /api/content-graph/spec-coverage/:specKey` | `{ specKey, topics, totalTopics }` | - | `{ error: "Spec not found" }` |
| `POST /api/content-graph/rebuild/lesson/:lessonId` | `{ ok: true, lessonId, lessonNode }` | Invalid ObjectId | `{ error: "Lesson not found" }` |
| `POST /api/content-graph/rebuild/topic` | `{ ok: true, topicNode, lessonCount, ... }` | `{ error: "specKey and topicKey required" }` | `{ error: "Topic not found" }` |

Errors are JSON `{ error: string }` only. No stack traces in responses.
