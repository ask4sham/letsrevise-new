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

**Commands:**

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

---

## AI Generation Jobs – Phase Boundary

- All structural groundwork for AI generation jobs is complete and safe to load in all environments.
- The next phase will introduce the first behavioral change: job creation endpoints and related logic.
- No further documentation-only groundwork changes are expected before behavioral features are added.



