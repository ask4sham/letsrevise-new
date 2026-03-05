## Maintenance scripts

One-off and recurring maintenance tasks run from the backend directory.

### Practice Source Deduplication

This script removes duplicated embedded lesson assessments when they substantially overlap with lesson practice questions.

**Default mode: DRY RUN.** Apply commands require you to type **`APPLY ALL`** or **`APPLY <SPEC_KEY>`** exactly (matching the run scope) unless `--force` or `--yes` is used. Passing `--spec` without `--specKey=...` aborts with exit code 2.

**Commands (from `backend/`):**

| Action | Command |
|--------|--------|
| Dry run all lessons | `npm run maintenance:dedup-practice` |
| Dry run for one spec | `npm run maintenance:dedup-practice:spec --specKey=AQA_GCSE_BIOLOGY` |
| Apply (prompts for `APPLY ALL`) | `npm run maintenance:dedup-practice:apply` |
| Apply, no prompt | `npm run maintenance:dedup-practice:apply:force` |
| Apply for one spec (prompts for `APPLY AQA_GCSE_BIOLOGY`) | `npm run maintenance:dedup-practice:spec:apply --specKey=AQA_GCSE_BIOLOGY` |
| Apply for one spec, no prompt | `npm run maintenance:dedup-practice:spec:apply:force --specKey=AQA_GCSE_BIOLOGY` |

**Examples:**

```bash
npm run maintenance:dedup-practice:apply
# Prompts: "This will MODIFY the database. To continue, type: APPLY ALL"
# You must type exactly: APPLY ALL

npm run maintenance:dedup-practice:apply:force
# No prompt (same as --yes in wrapper)

npm run maintenance:dedup-practice:spec:apply --specKey=AQA_GCSE_BIOLOGY
# Prompts: type exactly APPLY AQA_GCSE_BIOLOGY

npm run maintenance:dedup-practice:spec:apply:force --specKey=AQA_GCSE_BIOLOGY
# No prompt
```

**Optional flags (pass through wrapper or to script):**

- **`--force`** or **`--yes`** — Skip confirmation in apply mode.
- **`--threshold 0.6`** — Overlap ratio threshold (0–1). Default 0.6. Clear when `overlapRatio >= threshold`.
- **`--maxLessons N`** — In apply mode, stop after clearing N lessons (staged rollouts).

Reports are written to:

`reports/DEDUP_LESSON_PRACTICE_<date>.md`

---

## Question bank (Worksheet Builder)

Teachers need exam questions in the Question Bank to build worksheets. You can automate this in two ways:

1. **One-click (admin only)**  
   In the app, open **Worksheet Builder** as an admin user. In the Question Bank panel, click **Populate question bank**. The seed runs in the background; after about a minute, click **Refresh list** (or reload the page) to see questions for all AQA GCSE Biology topics.

2. **Deploy / first-time setup**  
   Run once per environment so the bank is pre-filled and teachers never see an empty list:
   ```bash
   npm run seed:bio:all
   ```
   Idempotent: existing topics are skipped. Uses `MONGO_URI` from `.env`.

## AI Generation Jobs (Groundwork)

- **Purpose**: Structural groundwork for AI generation jobs only; there is no execution or business logic yet.
- **Contracts**: Shared job contract, policy, type specs and error codes live under `backend/contracts/`.
- **Storage**: A minimal Mongoose model `AiGenerationJob` defines the persisted job shape.
- **Routing**: Public and admin route namespaces exist as empty placeholders (`routes/aiGenerationJobs.js`, `routes/adminAiGenerationJobs.js`), mounted but with no handlers.
- **Middleware**: `requireAiJobAccess` is a no-op middleware hook, exported from `backend/middleware/`, ready to be attached to future routes.
- **Not implemented**: No job creation APIs, no background workers or queues, no AI provider calls and no decision-making logic are present yet.

## AI Generation Jobs – Current Status

- Groundwork is complete: contracts, model, routes, and middleware are in place.
- All AI generation components are inert placeholders with no active behavior.
- There is no job execution, background worker infrastructure, or provider calls.
- Future phases will add behavior incrementally on top of this foundation.

## AI Tutor — Vector Store & Embeddings (PR-003)

**Environment variables** (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `VECTOR_DB_URL` | Postgres connection string for pgvector |
| `EMBEDDINGS_PROVIDER` | `mock` (dev) or `openai` |
| `EMBEDDINGS_API_KEY` | Required when provider=openai |
| `EMBEDDINGS_MODEL` | Optional; default `text-embedding-3-small` |

### Vector DB (local Docker, recommended)

Deterministic local pgvector — no manual Postgres setup. On a fresh machine with Docker:

```bash
# 1) Start pgvector (port 5433)
docker compose -f docker-compose.vector.yml up -d
# or: cd backend && npm run vector:up

# 2) Run migrations
node backend/scripts/runVectorMigrations.js
# or: npm run vector:migrate

# 3) Build knowledge index
node backend/scripts/buildKnowledgeIndex.js --apply --specKey aqa-gcse-biology

# 4) Embed documents
node backend/scripts/embedKnowledgeDocuments.js --apply --specKey aqa-gcse-biology

# 5) Test search
# GET /api/knowledge/search?q=cells&specKey=aqa-gcse-biology
```

Set in `backend/.env`:

```
VECTOR_DB_URL=postgresql://letsrevise_user:letsrevise_pass@localhost:5433/letsrevise
```

**npm scripts:** `vector:up`, `vector:down`, `vector:logs`, `vector:migrate`, `vector:reset` (destructive: removes volume).

**Common connection errors** (scripts print hints and exit 1):

- `password authentication failed` → Check credentials in `VECTOR_DB_URL`
- `does not exist` → Create DB or run `npm run vector:up` then `npm run vector:migrate`
- `ECONNREFUSED` → Start Docker (`npm run vector:up`) or ensure Postgres is running
- `extension "vector" is not available` → Use Docker pgvector image (`docker-compose.vector.yml`)

**Commands (manual Postgres):**

```bash
# Run pgvector migrations
node backend/scripts/runVectorMigrations.js

# Embed KnowledgeDocuments (dry run)
node backend/scripts/embedKnowledgeDocuments.js --specKey AQA_GCSE_BIOLOGY

# Embed KnowledgeDocuments (apply)
node backend/scripts/embedKnowledgeDocuments.js --apply --specKey AQA_GCSE_BIOLOGY

# Semantic search API (teacher + admin)
# GET /api/knowledge/search?q=...&specKey=...
```

**Dimension:** 1536 (config constant in `backend/config/vectorDb.js`).

### Knowledge refresh worker (PR-015)

When content is published (lesson, flashcards, quiz, exam), a background job is enqueued to refresh the knowledge index, embeddings, and coverage snapshots. Run the worker in a separate process:

```bash
# From backend/ or project root
npm run worker:knowledge-refresh
```

The worker polls every 5 seconds. If the vector DB is down, the job completes with the index and coverage updated; embeddings are skipped (logged). Jobs are deduplicated by specKey+topicKey. Admin endpoints: `GET /api/admin/jobs?type=KNOWLEDGE_REFRESH`, `POST /api/admin/jobs/enqueue-knowledge-refresh` (body: `{ specKey, topicKey? }`).

## Invalid JSON handling

Malformed JSON body returns **400** (not 500):

```bash
curl.exe -i -X POST http://localhost:5000/api/topic-summary/export \
  -H "Content-Type: application/json" --data-raw "{"
```

Expected: `HTTP/1.1 400` with `{"error":"Invalid JSON","message":"Malformed JSON body"}`.

**PowerShell:** Prefer string concatenation over `ConvertTo-Json` (which can emit BOM or mangle `{}`):

```powershell
$body = '{"topicSummaryLogId":"' + $id + '"}'
curl.exe ... -H "Content-Type: application/json" --data-raw $body
```

---

## Enquiry API (PR-004, PR-007)

**POST /api/enquiry** — RAG answer with citations. Teacher + admin always; students when `AI_TUTOR_ENABLED_SPECS` includes the spec.

**Rate limits:** student 5/min, teacher 10/min, admin 30/min.

```bash
# Smoke test (mock mode)
node backend/scripts/runEnquirySmokeTest.js
```

Body: `{ question, specKey, topicKey?, mode?, limit?, includePractice? }`

**PR-007 Student rollout:**

| Variable | Description |
|----------|-------------|
| `AI_TUTOR_ENABLED_SPECS` | Comma-separated specKeys (e.g. `aqa-gcse-biology`). Empty = disabled for students. |

**GET /api/feature-flags/ai-tutor?specKey=...** — auth required; returns `{ enabled: boolean }`.

---

## AI Generation Jobs – Phase Boundary

- All structural groundwork for AI generation jobs is complete and safe to load in all environments.
- The next phase will introduce the first behavioral change: job creation endpoints and related logic.
- No further documentation-only groundwork changes are expected before behavioral features are added.



